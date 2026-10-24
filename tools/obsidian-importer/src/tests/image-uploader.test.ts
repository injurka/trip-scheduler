import type { ParsedTripData } from '../types'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { lookupImageCache, setImageCache } from '../lib/cache'
import { pMap } from '../lib/concurrency'
import {
  batchUploadTripImages,
  collectTripImagePaths,
  resolveImageFromIndex,
  uploadSingleImage,
} from '../lib/image-uploader'

describe('Concurrency Helper (pMap)', () => {
  it('preserves order of results with concurrency limit', async () => {
    const items = [50, 10, 30, 20, 5]
    const activeTasks: number[] = []
    let maxConcurrent = 0

    const results = await pMap(
      items,
      async (ms, index) => {
        activeTasks.push(index)
        maxConcurrent = Math.max(maxConcurrent, activeTasks.length)
        await new Promise(resolve => setTimeout(resolve, ms))
        activeTasks.splice(activeTasks.indexOf(index), 1)
        return ms * 2
      },
      2,
    )

    expect(results).toEqual([100, 20, 60, 40, 10])
    expect(maxConcurrent).toBeLessThanOrEqual(2)
  })

  it('handles empty input gracefully', async () => {
    const results = await pMap([], async () => 'test')
    expect(results).toEqual([])
  })
})

describe('Image Uploader & Disk Cache', () => {
  it('correctly manages image cache entries matching file stats', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'img-cache-test-'))
    const filePath = join(tempDir, 'photo.jpg')
    writeFileSync(filePath, 'dummy-image-content')

    try {
      const cache = new Map()
      const tripId = 'trip-123'

      expect(lookupImageCache(tripId, filePath, cache)).toBeNull()

      setImageCache(tripId, filePath, 'https://s3.example.com/photo.jpg', cache)

      const cached = lookupImageCache(tripId, filePath, cache)
      expect(cached).toBe('https://s3.example.com/photo.jpg')

      // Keyed by tripId, another trip doesn't get the same entry
      expect(lookupImageCache('trip-456', filePath, cache)).toBeNull()

      // Modifying the file invalidates the cache
      writeFileSync(filePath, 'modified-image-content-longer')
      expect(lookupImageCache(tripId, filePath, cache)).toBeNull()
    }
    finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('resolves image paths from imageIndex with various formats', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'img-res-test-'))
    const photoPath = join(tempDir, 'Fuji.jpg')
    writeFileSync(photoPath, 'content')

    try {
      const index = new Map<string, string>()
      index.set('fuji.jpg', photoPath)
      index.set('japan/fuji.jpg', photoPath)

      expect(resolveImageFromIndex('![[Fuji.jpg]]', index)).toBe(photoPath)
      expect(resolveImageFromIndex('[[Fuji.jpg|Mount Fuji]]', index)).toBe(photoPath)
      expect(resolveImageFromIndex('./Fuji.jpg', index)).toBe(photoPath)
      expect(resolveImageFromIndex('japan/fuji.jpg', index)).toBe(photoPath)
      expect(resolveImageFromIndex('missing.png', index)).toBeUndefined()
    }
    finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('collects all image paths from cover, bookings, and day activities', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'img-collect-test-'))
    const coverPath = join(tempDir, 'cover.jpg')
    const hotelPath = join(tempDir, 'hotel.jpg')
    const dayPhotoPath = join(tempDir, 'temple.jpg')
    const galleryPhotoPath = join(tempDir, 'ramen.jpg')

    writeFileSync(coverPath, 'cover')
    writeFileSync(hotelPath, 'hotel')
    writeFileSync(dayPhotoPath, 'temple')
    writeFileSync(galleryPhotoPath, 'ramen')

    try {
      const imageIndex = new Map<string, string>([
        ['cover.jpg', coverPath],
        ['hotel.jpg', hotelPath],
        ['temple.jpg', dayPhotoPath],
        ['ramen.jpg', galleryPhotoPath],
      ])

      const tripData: ParsedTripData = {
        title: 'Japan Trip',
        cities: ['Tokyo'],
        days: [
          {
            dayNumber: 1,
            fileName: 'Day 1.md',
            date: '2026-11-01',
            title: 'Arrival',
            rawContent: 'Walk to temple ![[temple.jpg]] and then dinner:\n```gallery\nramen.jpg\n```',
          },
        ],
        coverImagePath: coverPath,
        bookingsContent: {
          bookings: [
            {
              id: 'b1',
              title: 'Tokyo Hotel',
              type: 'hotel',
              data: {
                photos: ['[[hotel.jpg]]'],
              },
            },
          ],
        },
      } as unknown as ParsedTripData

      const paths = collectTripImagePaths(tripData, imageIndex)
      expect(paths).toContain(coverPath)
      expect(paths).toContain(hotelPath)
      expect(paths).toContain(dayPhotoPath)
      expect(paths).toContain(galleryPhotoPath)
      expect(paths).toHaveLength(4)
    }
    finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('batch uploads images concurrently and deduplicates requests', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'img-batch-test-'))
    const img1 = join(tempDir, '1.jpg')
    const img2 = join(tempDir, '2.jpg')
    const img3 = join(tempDir, '3.jpg')
    writeFileSync(img1, '1')
    writeFileSync(img2, '2')
    writeFileSync(img3, '3')

    try {
      const uploadedCalls: string[] = []
      const uploader = {
        uploadImage: async (_tripId: string, filePath: string) => {
          uploadedCalls.push(filePath)
          return `https://s3.example.com/${filePath.split('/').pop()}`
        },
      }

      const uploadCache = new Map<string, string>()
      const persistentCache = new Map()
      const tripId = 'trip-batch'

      // First batch: all 3 uploaded
      const res1 = await batchUploadTripImages(
        tripId,
        [img1, img2, img3],
        uploader,
        uploadCache,
        persistentCache,
        { concurrency: 3 },
      )

      expect(res1.uploaded).toBe(3)
      expect(res1.cached).toBe(0)
      expect(uploadedCalls).toHaveLength(3)

      // Second batch with a new uploadCache (simulating next run): all 3 served from persistentCache
      const freshUploadCache = new Map<string, string>()
      const res2 = await batchUploadTripImages(
        tripId,
        [img1, img2, img3],
        uploader,
        freshUploadCache,
        persistentCache,
      )

      expect(res2.uploaded).toBe(0)
      expect(res2.cached).toBe(3)
      expect(uploadedCalls).toHaveLength(3) // No new uploads!
      expect(freshUploadCache.get(img1)).toBe('https://s3.example.com/1.jpg')
    }
    finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('deduplicates simultaneous in-flight uploads for the same file', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'img-inflight-test-'))
    const img = join(tempDir, 'shared.jpg')
    writeFileSync(img, 'shared')

    try {
      let networkCalls = 0
      const uploader = {
        uploadImage: async () => {
          networkCalls++
          await new Promise(resolve => setTimeout(resolve, 20))
          return 'https://s3.example.com/shared.jpg'
        },
      }

      const uploadCache = new Map<string, string>()
      const [u1, u2, u3] = await Promise.all([
        uploadSingleImage('trip-inflight', img, uploader, uploadCache),
        uploadSingleImage('trip-inflight', img, uploader, uploadCache),
        uploadSingleImage('trip-inflight', img, uploader, uploadCache),
      ])

      expect(networkCalls).toBe(1)
      expect(u1).toBe('https://s3.example.com/shared.jpg')
      expect(u2).toBe('https://s3.example.com/shared.jpg')
      expect(u3).toBe('https://s3.example.com/shared.jpg')
    }
    finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
