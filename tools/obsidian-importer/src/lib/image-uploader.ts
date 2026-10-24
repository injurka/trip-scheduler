import type { ParsedTripData } from '../types'
import type { ImageCacheEntry } from './cache'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import { lookupImageCache, saveImageUploadCache, setImageCache } from './cache'
import { pMap } from './concurrency'

export interface ImageUploader {
  uploadImage: (tripId: string, filePath: string, placement?: 'route' | 'memories' | 'notes' | 'documents') => Promise<string>
}

export interface BatchUploadOptions {
  concurrency?: number
  onProgress?: (msg: string) => void
  uploadImages?: boolean
}

export interface BatchUploadResult {
  total: number
  cached: number
  uploaded: number
}

/**
 * Resolves an image name or wikilink to an absolute file path using imageIndex.
 */
export function resolveImageFromIndex(
  imageName: string,
  imageIndex: Map<string, string>,
): string | undefined {
  if (typeof imageName !== 'string')
    return undefined

  let clean = imageName
    .trim()
    .replace(/^!*\[\[/, '')
    .replace(/\]\]$/, '')
    .split('|')[0]
    .trim()
    .replace(/^\.\//, '')

  if (!clean)
    return undefined

  // Decode URI component if encoded
  try {
    clean = decodeURIComponent(clean)
  }
  catch {
    // ignore decoding errors
  }

  const direct = imageIndex.get(clean)
    || imageIndex.get(clean.toLowerCase())
    || imageIndex.get(clean.split('/').at(-1) ?? '')
    || imageIndex.get((clean.split('/').at(-1) ?? '').toLowerCase())

  if (direct && existsSync(direct)) {
    return direct
  }

  return undefined
}

/**
 * Collects all unique local image file paths referenced across cover, bookings, and day activities.
 */
export function collectTripImagePaths(
  tripData: ParsedTripData,
  imageIndex: Map<string, string>,
): string[] {
  const result = new Set<string>()

  // 1. Cover image
  if (tripData.coverImagePath && existsSync(tripData.coverImagePath)) {
    result.add(tripData.coverImagePath)
  }

  // 2. Booking photos
  if (tripData.bookingsContent?.bookings) {
    for (const booking of tripData.bookingsContent.bookings) {
      const data = booking.data as any
      const rawPhotos: string[] = data?.photos || data?.imageUrls || []
      if (!Array.isArray(rawPhotos))
        continue

      for (const photo of rawPhotos) {
        if (typeof photo !== 'string' || /^https?:\/\//i.test(photo))
          continue
        const resolved = resolveImageFromIndex(photo, imageIndex)
        if (resolved) {
          result.add(resolved)
        }
      }
    }
  }

  // 3. Day activities & galleries
  if (tripData.days) {
    for (const day of tripData.days) {
      const content = day.rawContent || ''
      if (!content)
        continue

      // Wikilinks: ![[image.jpg]] or ![[image.jpg|title]]
      const wikilinkRegex = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
      let m: RegExpExecArray | null
      while ((m = wikilinkRegex.exec(content)) !== null) {
        const resolved = resolveImageFromIndex(m[1], imageIndex)
        if (resolved) {
          result.add(resolved)
        }
      }

      // Standard markdown images: ![alt](path/to/image.jpg)
      const mdImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g
      while ((m = mdImageRegex.exec(content)) !== null) {
        const path = m[1].trim()
        if (/^https?:\/\//i.test(path))
          continue
        const resolved = resolveImageFromIndex(path, imageIndex)
        if (resolved) {
          result.add(resolved)
        }
      }

      // Gallery blocks: ```gallery ... ```
      const galleryRegex = /```gallery[\t ]*\n([\s\S]*?)```/gi
      while ((m = galleryRegex.exec(content)) !== null) {
        const lines = m[1].split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#'))
            continue
          const resolved = resolveImageFromIndex(trimmed, imageIndex)
          if (resolved) {
            result.add(resolved)
          }
        }
      }
    }
  }

  return Array.from(result)
}

// In-flight map for deduping concurrent upload requests for identical files
const inFlightUploads = new Map<string, Promise<string>>()

/**
 * Uploads a single image on-demand with caching and in-flight deduplication.
 */
export async function uploadSingleImage(
  tripId: string,
  filePath: string,
  uploader: ImageUploader,
  uploadCache: Map<string, string>,
  persistentCache?: Map<string, ImageCacheEntry>,
  placement: 'route' | 'memories' | 'notes' | 'documents' = 'route',
): Promise<string> {
  // 1. In-memory upload cache hit
  if (uploadCache.has(filePath)) {
    return uploadCache.get(filePath)!
  }

  // 2. Persistent disk cache hit
  if (persistentCache) {
    const cachedUrl = lookupImageCache(tripId, filePath, persistentCache)
    if (cachedUrl) {
      uploadCache.set(filePath, cachedUrl)
      return cachedUrl
    }
  }

  // 3. In-flight promise deduplication
  const inFlightKey = `${tripId}::${filePath}`
  if (inFlightUploads.has(inFlightKey)) {
    const url = await inFlightUploads.get(inFlightKey)!
    uploadCache.set(filePath, url)
    return url
  }

  const uploadPromise = (async () => {
    try {
      const url = await uploader.uploadImage(tripId, filePath, placement)
      if (url) {
        uploadCache.set(filePath, url)
        if (persistentCache) {
          setImageCache(tripId, filePath, url, persistentCache)
          saveImageUploadCache(persistentCache)
        }
      }
      return url
    }
    finally {
      inFlightUploads.delete(inFlightKey)
    }
  })()

  inFlightUploads.set(inFlightKey, uploadPromise)
  return await uploadPromise
}

/**
 * Pre-uploads a batch of trip images concurrently with disk caching and progress reporting.
 */
export async function batchUploadTripImages(
  tripId: string,
  imagePaths: string[],
  uploader: ImageUploader,
  uploadCache: Map<string, string>,
  persistentCache: Map<string, ImageCacheEntry>,
  options: BatchUploadOptions = {},
): Promise<BatchUploadResult> {
  if (options.uploadImages === false || imagePaths.length === 0) {
    return { total: imagePaths.length, cached: 0, uploaded: 0 }
  }

  const concurrency = options.concurrency ?? 5
  const toUpload: string[] = []
  let cachedCount = 0

  for (const filePath of imagePaths) {
    if (uploadCache.has(filePath)) {
      cachedCount++
      continue
    }

    const cachedUrl = lookupImageCache(tripId, filePath, persistentCache)
    if (cachedUrl) {
      uploadCache.set(filePath, cachedUrl)
      cachedCount++
      continue
    }

    toUpload.push(filePath)
  }

  if (toUpload.length === 0) {
    if (imagePaths.length > 0) {
      options.onProgress?.(`⚡ Все фото (${imagePaths.length}) уже в кеше (0 загрузок)`)
    }
    return { total: imagePaths.length, cached: cachedCount, uploaded: 0 }
  }

  if (cachedCount > 0) {
    options.onProgress?.(`⚡ Найдено в кеше: ${cachedCount} из ${imagePaths.length} фото`)
  }

  options.onProgress?.(`📸 Загрузка медиа (${toUpload.length} фото, параллельно по ${concurrency})...`)

  let uploadedCount = 0
  let completed = 0

  await pMap(
    toUpload,
    async (filePath) => {
      const fileName = basename(filePath)
      try {
        const url = await uploadSingleImage(
          tripId,
          filePath,
          uploader,
          uploadCache,
          persistentCache,
          'route',
        )
        if (url) {
          uploadedCount++
        }
        completed++
        options.onProgress?.(`  📸 [${completed}/${toUpload.length}] ${fileName}`)
      }
      catch (err: any) {
        options.onProgress?.(`  ⚠ Ошибка загрузки ${fileName}: ${err?.message || err}`)
        throw err
      }
    },
    concurrency,
  )

  saveImageUploadCache(persistentCache)

  return {
    total: imagePaths.length,
    cached: cachedCount,
    uploaded: uploadedCount,
  }
}
