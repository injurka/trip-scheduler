import { expect, it, mock } from 'bun:test'

let release!: () => void
const gate = new Promise<void>((resolve) => {
  release = resolve
})
let extractionStarted!: () => void
const started = new Promise<void>((resolve) => {
  extractionStarted = resolve
})
const capture = { takenAt: new Date('2026-11-16T07:12:00Z'), metadata: { timezoneOffset: 480 } }
mock.module('db', () => ({ db: {} }))
mock.module('~/modules/blog/blog.service', () => ({ blogService: {} }))
mock.module('~/modules/image/image.service', () => ({ imageService: { create: async (...args: unknown[]) => ({ id: 'image', ...args[5] as object }) } }))
mock.module('~/modules/post/post.service', () => ({ postService: {} }))
mock.module('~/repositories/blog.repository', () => ({ blogRepository: {} }))
mock.module('~/repositories/memory.repository', () => ({ applyImportedImageRating: () => {} }))
mock.module('~/repositories/post.repository', () => ({ postRepository: {} }))
mock.module('~/repositories/trip.repository', () => ({ tripRepository: { getById: async () => ({ userId: 'owner' }) } }))
mock.module('~/repositories/user.repository', () => ({ userRepository: {} }))
mock.module('~/services/file-storage.service', () => ({ generateFilePaths: () => {}, saveFile: () => {} }))
mock.module('~/services/image-metadata.service', () => ({
  extractAndStructureMetadata: async () => {
    extractionStarted()
    await gate
    return { metadata: capture, embeddedThumbnailBuffer: null }
  },
  generateImageVariants: () => {},
  generateThumbHash: () => {},
}))
mock.module('~/services/metrics.service', () => ({ fileUploadsCounter: { inc: () => {} }, fileUploadSizeBytesHistogram: { observe: () => {} } }))
mock.module('~/services/quota.service', () => ({ quotaService: { checkStorageQuota: async () => {}, incrementStorageUsage: async () => {} } }))
mock.module('~/services/s3.service', () => ({ s3Service: { completeMultipartUpload: async () => {}, getFile: async () => ({ buffer: Buffer.from('original') }) } }))
mock.module('~/services/storage-cleanup.service', () => ({ trackPendingPostUpload: () => {} }))
mock.module('~/services/video-processing.service', () => ({ videoProcessingService: {} }))

const { ImageUploadService } = await import('./image-upload.service')

it('returns capture metadata before previews finish, after delayed EXIF extraction', async () => {
  const service = new ImageUploadService()
  let finishPreviews!: () => void
  const previews = new Promise<void>((resolve) => {
    finishPreviews = resolve
  })
  service.processImageBackground = async () => previews
  let returned = false
  const completion = service.completeMultipart('trip', {
    userId: 'owner',
    userRole: 'user',
    entityId: 'trip',
    placement: 'memories',
    uploadId: 'upload',
    key: 'trips/trip/memories/photo.jpg',
    parts: [],
    fileName: 'photo.jpg',
    fileSize: 100,
  }).then((result) => {
    returned = true
    return result
  })
  await started
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(returned).toBe(false)
  release()
  try {
    const result = await completion
    expect(result.dbRecord).toMatchObject(capture)
  }
  finally { finishPreviews() }
})
