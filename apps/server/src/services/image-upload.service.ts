import type { EntityType, IUploadHandler, UploadContext, UploadResult } from '../models/image-upload'
import { tripImagePlacementEnum } from 'db/schema'
import { HTTPException } from 'hono/http-exception'
import sharp from 'sharp'
import { blogService } from '~/modules/blog/blog.service'
import { imageService } from '~/modules/image/image.service'
import { postService } from '~/modules/post/post.service'
import { blogRepository } from '~/repositories/blog.repository'
import { postRepository } from '~/repositories/post.repository'
import { tripRepository } from '~/repositories/trip.repository'
import { userRepository } from '~/repositories/user.repository'
import { generateFilePaths, saveFile } from '~/services/file-storage.service'
import { extractAndStructureMetadata, generateImageVariants, generateThumbHash } from '~/services/image-metadata.service'
import { fileUploadsCounter, fileUploadSizeBytesHistogram } from '~/services/metrics.service'
import { quotaService } from '~/services/quota.service'
import { s3Service } from '~/services/s3.service'
import { trackPendingPostUpload } from '~/services/storage-cleanup.service'
import { videoProcessingService } from '~/services/video-processing.service'

const tripHandler: IUploadHandler = {
  async validate({ userId, userRole, entityId, placement, buffer }) {
    if (!placement || !tripImagePlacementEnum.enumValues.includes(placement as any))
      throw new HTTPException(400, { message: 'Некорректный тип размещения.' })
    const trip = await tripRepository.getById(entityId)
    if (!trip)
      throw new HTTPException(404, { message: 'Путешествие не найдено.' })
    if (trip.userId !== userId && userRole !== 'admin')
      throw new HTTPException(403, { message: 'Нет прав.' })
    await quotaService.checkStorageQuota(userId, buffer.length)
  },
  getFolderPath: ({ entityId, placement }) => `trips/${entityId}/${placement}`,
  async afterSave({ entityId, placement }, { url, size, metadata, variants, mediaType }) {
    return await imageService.create(entityId, url, metadata.originalName || 'file', placement as any, size, { ...metadata, variants }, mediaType)
  },
}

const postHandler: IUploadHandler = {
  async validate({ userId, userRole, entityId, buffer }) {
    const post = await postRepository.findById(entityId)
    if (!post)
      throw new HTTPException(404, { message: 'Пост не найден.' })
    if (post.userId !== userId && userRole !== 'admin')
      throw new HTTPException(403, { message: 'Нет прав.' })
    await quotaService.checkStorageQuota(userId, buffer.length)
  },
  getFolderPath: ({ entityId }) => `posts/${entityId}`,
  async afterSave({ entityId }, { url, size, metadata, variants, mediaType }) {
    return await postService.createMedia(entityId, url, metadata.originalName || 'file', size, { ...metadata, variants, mediaType })
  },
}

const blogHandler: IUploadHandler = {
  async validate({ userRole, entityId }) {
    if (userRole !== 'admin')
      throw new HTTPException(403, { message: 'Доступ запрещен' })
    const blog = await blogRepository.findById(entityId)
    if (!blog)
      throw new HTTPException(404, { message: 'Блог не найден.' })
  },
  getFolderPath: ({ entityId, placement }) => `blogs/${entityId}/${placement === 'cover' ? 'cover' : 'content'}`,
  async afterSave({ entityId, placement }, { url, variants, metadata }) {
    if (placement === 'cover')
      await blogService.updateCoverImage(entityId, url)
    return { url, variants, metadata }
  },
}

const avatarHandler: IUploadHandler = {
  async validate({ userId, entityId }) {
    if (userId !== entityId)
      throw new HTTPException(403, { message: 'Нельзя менять чужой аватар.' })
  },
  getFolderPath: ({ userId }) => `avatars/${userId}`,
  async afterSave({ userId }, { url }) {
    return await userRepository.update(userId, { avatarUrl: url })
  },
}

const userCoverHandler: IUploadHandler = {
  async validate({ userId, entityId, buffer }) {
    if (userId !== entityId)
      throw new HTTPException(403, { message: 'Нельзя менять чужую обложку.' })
    await quotaService.checkStorageQuota(userId, buffer.length)
  },
  getFolderPath: ({ userId }) => `covers/${userId}`,
  async afterSave({ userId }, { url }) {
    const currentUser = await userRepository.getById(userId)
    const oldCoverUrl = currentUser?.coverUrl
    if (oldCoverUrl && !oldCoverUrl.startsWith('http://') && !oldCoverUrl.startsWith('https://')) {
      try {
        await s3Service.deleteFiles([oldCoverUrl])
      }
      catch (e) {
        console.error('[Upload] Failed to delete old user cover:', e)
      }
    }
    return await userRepository.update(userId, { coverUrl: url })
  },
}

const reviewHandler: IUploadHandler = {
  async validate({ userId }) {
    await quotaService.checkStorageQuota(userId, 5 * 1024 * 1024)
  },
  getFolderPath: ({ userId }) => `reviews/${userId}/covers`,
  async afterSave(ctx, { url, variants, metadata }) {
    return { url, variants, metadata }
  },
}

const highlightHandler: IUploadHandler = {
  async validate({ userId, buffer }) {
    await quotaService.checkStorageQuota(userId, buffer.length)
  },
  getFolderPath: ({ userId }) => `highlights/${userId}`,
  async afterSave(ctx, { url, variants, metadata }) {
    // Возвращаем просто URL, сохраняться в БД будет через отдельный метод TRPC
    return { url, variants, metadata }
  },
}

const handlers: Record<EntityType, IUploadHandler> = {
  'trip': tripHandler,
  'post': postHandler,
  'blog': blogHandler,
  'avatar': avatarHandler,
  'user-cover': userCoverHandler,
  'review': reviewHandler,
  'highlight': highlightHandler,
}

export class ImageUploadService {
  async processUpload(entityType: EntityType, ctx: UploadContext): Promise<UploadResult> {
    const handler = handlers[entityType]
    if (!handler)
      throw new HTTPException(400, { message: 'Неизвестный тип сущности.' })

    await handler.validate(ctx)

    const folderPath = handler.getFolderPath(ctx)
    const fileName = entityType === 'avatar' ? 'avatar.webp' : ctx.file.name
    const paths = generateFilePaths(folderPath, fileName)

    let processedBuffer = ctx.buffer
    let variants: Record<string, Buffer> = {}
    const isVideo = ctx.file.type.startsWith('video/') || /\.(?:mp4|webm|mov|mkv|avi|ogg|quicktime)$/i.test(fileName)
    const isImage = !isVideo && (ctx.file.type.startsWith('image/') || /\.(?:jpg|jpeg|png|webp|avif|gif)$/i.test(fileName))
    const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image'
    let metadata: any = { originalName: ctx.file.name, mediaType, ...ctx.customMetadata }

    if (isImage) {
      try {
        if (entityType === 'avatar') {
          processedBuffer = await sharp(ctx.buffer).resize({ width: 400, height: 400, fit: 'cover' }).webp({ quality: 90 }).toBuffer()
          const thumbhash = await generateThumbHash(processedBuffer)
          if (thumbhash) {
            metadata.thumbhash = thumbhash
            metadata.metadata = { ...(metadata.metadata || {}), thumbhash }
          }
        }
        else {
          const metaResult = await extractAndStructureMetadata(ctx.buffer)
          metadata = { ...metadata, ...metaResult.metadata }
          metadata.metadata = {
            ...(metaResult.metadata?.metadata || {}),
            ...ctx.customMetadata,
          }
          variants = await generateImageVariants(ctx.buffer)
        }
      }
      catch (e: any) {
        console.error('Sharp error:', e)
        throw new HTTPException(415, { message: 'Ошибка обработки изображения.' })
      }
    }
    else {
      metadata.metadata = {
        ...ctx.customMetadata,
      }
    }

    const variantUrls: Record<string, string> = {}
    let variantsTotalSize = 0

    if (entityType === 'post')
      await trackPendingPostUpload([paths.path, ...Object.keys(variants).map(paths.getVariantPaths)], paths.path)

    await Promise.all(
      Object.entries(variants).map(async ([name, variantBuffer]) => {
        const vPaths = paths.getVariantPaths(name)
        await saveFile(vPaths, variantBuffer, 'image/webp')
        variantUrls[name] = vPaths
        variantsTotalSize += variantBuffer.length
      }),
    )

    const resolvedThumbhash = metadata.metadata?.thumbhash || metadata.thumbhash
    if (resolvedThumbhash) {
      variantUrls.thumbhash = resolvedThumbhash
    }

    const originalMime = entityType === 'avatar' ? 'image/webp' : ctx.file.type
    await saveFile(paths.path, processedBuffer, originalMime)

    const totalSize = processedBuffer.length + variantsTotalSize

    const dbRecord = await handler.afterSave(ctx, { url: paths.path, variants: variantUrls, size: totalSize, metadata, mediaType })

    if (mediaType === 'video' && dbRecord && 'id' in dbRecord && typeof dbRecord.id === 'string') {
      videoProcessingService.processVideoBackground(dbRecord.id, paths.path).catch((err) => {
        console.error('[Upload] Error in background video processing:', err)
      })
    }

    if (entityType !== 'avatar' && entityType !== 'blog' && entityType !== 'post') {
      await quotaService.incrementStorageUsage(ctx.userId, totalSize)
    }

    fileUploadsCounter.inc({ placement: entityType })
    fileUploadSizeBytesHistogram.observe({ placement: entityType }, totalSize)

    return { url: paths.path, variants: variantUrls, dbRecord, metadata }
  }

  async initiateMultipart(
    entityType: EntityType,
    ctx: {
      userId: string
      userRole: string
      entityId: string
      placement?: string | null
      fileName: string
      fileSize: number
      fileType: string
    },
  ) {
    const handler = handlers[entityType]
    if (!handler)
      throw new HTTPException(400, { message: 'Неизвестный тип сущности.' })

    await handler.validate({
      userId: ctx.userId,
      userRole: ctx.userRole,
      entityId: ctx.entityId,
      placement: ctx.placement,
      buffer: Buffer.alloc(0),
      file: { name: ctx.fileName, size: ctx.fileSize, type: ctx.fileType } as any,
    })

    await quotaService.checkStorageQuota(ctx.userId, ctx.fileSize)

    const folderPath = handler.getFolderPath({
      userId: ctx.userId,
      userRole: ctx.userRole,
      entityId: ctx.entityId,
      placement: ctx.placement,
      buffer: Buffer.alloc(0),
      file: { name: ctx.fileName, size: ctx.fileSize, type: ctx.fileType } as any,
    })

    const paths = generateFilePaths(folderPath, ctx.fileName)
    const uploadId = await s3Service.createMultipartUpload(paths.path, ctx.fileType)
    if (entityType === 'post') {
      try {
        await trackPendingPostUpload([paths.path], paths.path, uploadId)
      }
      catch (error) {
        await s3Service.abortMultipartUpload(paths.path, uploadId)
        throw error
      }
    }

    return {
      uploadId,
      key: paths.path,
      chunkSize: 10 * 1024 * 1024, // 10MB
    }
  }

  private async validatePostKey(key: string, userId: string, userRole: string) {
    if (!key.startsWith('posts/'))
      return
    const post = await postRepository.findById(key.split('/')[1])
    if (!post || (post.userId !== userId && userRole !== 'admin'))
      throw new HTTPException(403, { message: 'Нет доступа к медиатеке поста.' })
  }

  async uploadChunk(key: string, uploadId: string, partNumber: number, chunkBuffer: Buffer | Uint8Array, userId: string, userRole: string) {
    await this.validatePostKey(key, userId, userRole)
    return await s3Service.uploadPart(key, uploadId, partNumber, chunkBuffer)
  }

  async completeMultipart(
    entityType: EntityType,
    ctx: {
      userId: string
      userRole: string
      entityId: string
      placement?: string | null
      uploadId: string
      key: string
      parts: { PartNumber: number, ETag: string }[]
      fileName: string
      fileSize: number
      customMetadata?: Record<string, any>
    },
  ) {
    const handler = handlers[entityType]
    if (!handler)
      throw new HTTPException(400, { message: 'Неизвестный тип сущности.' })

    const validationContext: UploadContext = {
      userId: ctx.userId,
      userRole: ctx.userRole,
      entityId: ctx.entityId,
      placement: ctx.placement,
      file: { name: ctx.fileName, size: ctx.fileSize, type: 'application/octet-stream' } as File,
      buffer: Buffer.alloc(0),
    }
    await handler.validate(validationContext)
    const expectedFolder = `${handler.getFolderPath(validationContext)}/`
    if (!ctx.key.startsWith(expectedFolder) || ctx.key.slice(expectedFolder.length).includes('/'))
      throw new HTTPException(403, { message: 'Файл не принадлежит этой сущности.' })
    await s3Service.completeMultipartUpload(ctx.key, ctx.uploadId, ctx.parts)

    const isVideo = /\.(?:mp4|webm|mov|mkv|avi|ogg|quicktime)$/i.test(ctx.fileName)
    const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image'
    const metadata = {
      originalName: ctx.fileName,
      mediaType,
      ...ctx.customMetadata,
    }

    const uploadCtx: UploadContext = {
      userId: ctx.userId,
      userRole: ctx.userRole,
      entityId: ctx.entityId,
      placement: ctx.placement,
      buffer: Buffer.alloc(0),
      file: { name: ctx.fileName, size: ctx.fileSize, type: isVideo ? 'video/mp4' : 'application/octet-stream' } as any,
      customMetadata: ctx.customMetadata,
    }

    const dbRecord = await handler.afterSave(uploadCtx, {
      url: ctx.key,
      variants: {},
      size: ctx.fileSize,
      metadata,
      mediaType,
    })

    if (mediaType === 'video' && dbRecord && 'id' in dbRecord && typeof dbRecord.id === 'string') {
      videoProcessingService.processVideoBackground(dbRecord.id, ctx.key).catch((err) => {
        console.error('[MultipartUpload] Error in background video processing:', err)
      })
    }

    if (entityType !== 'avatar' && entityType !== 'blog' && entityType !== 'post') {
      await quotaService.incrementStorageUsage(ctx.userId, ctx.fileSize)
    }

    fileUploadsCounter.inc({ placement: entityType })
    fileUploadSizeBytesHistogram.observe({ placement: entityType }, ctx.fileSize)

    return { url: ctx.key, variants: {}, dbRecord, metadata }
  }

  async abortMultipart(key: string, uploadId: string, userId: string, userRole: string) {
    await this.validatePostKey(key, userId, userRole)
    await s3Service.abortMultipartUpload(key, uploadId)
  }
}

export const imageUploadService = new ImageUploadService()
