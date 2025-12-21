import type { ImageMetadata } from '~/repositories/image.repository'

export type EntityType = 'trip' | 'post' | 'blog' | 'avatar'

export interface UploadContext {
  userId: string
  entityId: string
  file: File
  buffer: Buffer
  placement?: string | null
}

export interface UploadResult {
  url: string
  variants?: Record<string, string>
  metadata?: Partial<ImageMetadata>
  dbRecord?: any
}

export interface IUploadHandler {
  validate: (ctx: UploadContext) => Promise<void>
  getFolderPath: (ctx: UploadContext) => string
  afterSave: (ctx: UploadContext, fileData: { url: string, variants: Record<string, string>, size: number, metadata: any }) => Promise<any>
}
