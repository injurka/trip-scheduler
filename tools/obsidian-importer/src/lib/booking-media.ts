import type { Booking } from '../types'
import { existsSync } from 'node:fs'

export interface BookingImageUploader {
  uploadImage: (tripId: string, filePath: string, placement?: 'route' | 'memories' | 'notes' | 'documents') => Promise<string>
}

export interface ResolveBookingPhotosOptions {
  uploadImages?: boolean
  onLog?: (message: string) => void
}

export interface ResolveBookingPhotosResult {
  totalUploaded: number
  bookingsUpdated: number
}

/**
 * Разрешает локальные ссылки на изображения в бронированиях (из Obsidian Vault)
 * и загружает их на сервер через uploader (API клиент), если включена загрузка медиа.
 */
export async function resolveAndUploadBookingPhotos(
  bookings: Booking[],
  imageIndex: Map<string, string>,
  uploader: BookingImageUploader | null,
  tripId: string | null,
  uploadCache: Map<string, string>,
  options: ResolveBookingPhotosOptions = {},
): Promise<ResolveBookingPhotosResult> {
  const shouldUpload = options.uploadImages !== false && uploader !== null && tripId !== null
  let totalUploaded = 0
  let bookingsUpdated = 0

  for (const booking of bookings) {
    const data = booking.data as any
    const rawPhotos: string[] = data?.photos || data?.imageUrls || []
    if (!Array.isArray(rawPhotos) || rawPhotos.length === 0)
      continue

    const resolvedPhotos: string[] = []

    for (let i = 0; i < rawPhotos.length; i++) {
      let photo = rawPhotos[i]
      if (typeof photo !== 'string')
        continue

      photo = photo.trim().replace(/^!*\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim()
      if (!photo)
        continue

      // 1. Уже готовый URL (http / https)
      if (/^https?:\/\//i.test(photo)) {
        if (!resolvedPhotos.includes(photo))
          resolvedPhotos.push(photo)
        continue
      }

      // 2. Локальный файл из вольта Obsidian
      const cleanName = photo.replace(/^\.\//, '')
      const localPath = imageIndex.get(cleanName)
        || imageIndex.get(cleanName.toLowerCase())
        || imageIndex.get(cleanName.split('/').at(-1) ?? '')
        || imageIndex.get((cleanName.split('/').at(-1) ?? '').toLowerCase())

      if (localPath && existsSync(localPath)) {
        if (shouldUpload && uploader && tripId) {
          try {
            if (uploadCache.has(localPath)) {
              const cachedUrl = uploadCache.get(localPath)!
              if (!resolvedPhotos.includes(cachedUrl))
                resolvedPhotos.push(cachedUrl)
            }
            else {
              options.onLog?.(`📸 Загрузка фото бронирования [${booking.title}]: ${cleanName}`)
              const uploadedUrl = await uploader.uploadImage(tripId, localPath, 'route')
              if (uploadedUrl) {
                uploadCache.set(localPath, uploadedUrl)
                if (!resolvedPhotos.includes(uploadedUrl))
                  resolvedPhotos.push(uploadedUrl)
                totalUploaded++
              }
            }
          }
          catch (err: any) {
            options.onLog?.(`⚠ Ошибка загрузки фото бронирования «${cleanName}»: ${err?.message || err}`)
            throw err
          }
        }
        else {
          if (!resolvedPhotos.includes(photo))
            resolvedPhotos.push(photo)
        }
      }
      else {
        // Файл не найден в imageIndex, оставляем исходную строку
        if (!resolvedPhotos.includes(photo))
          resolvedPhotos.push(photo)
      }
    }

    if (resolvedPhotos.length > 0) {
      data.photos = resolvedPhotos
      data.imageUrls = resolvedPhotos
      bookingsUpdated++
    }
  }

  return { totalUploaded, bookingsUpdated }
}
