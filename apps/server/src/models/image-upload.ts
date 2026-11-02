import type { ImageMetadata } from '~/repositories/image.repository'

export type EntityType = 'trip' | 'post' | 'blog' | 'avatar' | 'user-cover' | 'review' | 'highlight'

export interface UploadContext {
  userId: string
  userRole?: string
  entityId: string
  file: Pick<File, 'name' | 'size' | 'type'>
  buffer: Buffer
  placement?: string | null
  customMetadata?: Record<string, unknown>
}

export interface UploadResult {
  url: string
  variants?: Record<string, string>
  metadata?: Partial<ImageMetadata>
  dbRecord?: Record<string, unknown>
}

export interface IUploadHandler {
  validate: (ctx: UploadContext) => Promise<void>
  getFolderPath: (ctx: UploadContext) => string
  afterSave: (ctx: UploadContext, fileData: { url: string, variants: Record<string, string>, size: number, metadata: UploadMetadata, mediaType?: 'image' | 'video' }) => Promise<Record<string, unknown>>
}

export interface UploadMetadata extends Partial<ImageMetadata> {
  originalName?: string
  mediaType?: 'image' | 'video'
  isPrivate?: boolean
  thumbhash?: string
}
