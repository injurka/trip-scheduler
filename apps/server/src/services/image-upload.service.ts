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
import { extractAndStructureMetadata, generateImageVariants } from '~/services/image-metadata.service'
import { fileUploadsCounter, fileUploadSizeBytesHistogram } from '~/services/metrics.service'
import { quotaService } from '~/services/quota.service'

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
  async afterSave({ entityId, placement }, { url, size, metadata, variants }) {
    return await imageService.create(
      entityId,
      url,
      metadata.originalName || 'file',
      placement as any,
      size,
      { ...metadata, variants },
    )
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
  async afterSave({ entityId }, { url, size, metadata, variants }) {
    return await postService.createMedia(entityId, url, metadata.originalName || 'file', size, { ...metadata, variants })
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

const handlers: Record<EntityType, IUploadHandler> = {
  trip: tripHandler,
  post: postHandler,
  blog: blogHandler,
  avatar: avatarHandler,
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
    let metadata: any = { originalName: ctx.file.name }

    const isImage = ctx.file.type.startsWith('image/') || /\.(?:jpg|jpeg|png|webp|avif|gif)$/i.test(fileName)

    if (isImage) {
      try {
        if (entityType === 'avatar') {
          processedBuffer = await sharp(ctx.buffer).resize({ width: 400, height: 400, fit: 'cover' }).webp({ quality: 90 }).toBuffer()
        }
        else {
          const metaResult = await extractAndStructureMetadata(ctx.buffer)
          metadata = { ...metadata, ...metaResult.metadata }
          variants = await generateImageVariants(ctx.buffer)
        }
      }
      catch (e: any) {
        console.error('Sharp error:', e)
        throw new HTTPException(415, { message: 'Ошибка обработки изображения.' })
      }
    }

    const variantUrls: Record<string, string> = {}
    let variantsTotalSize = 0

    await Promise.all(
      Object.entries(variants).map(async ([name, variantBuffer]) => {
        const vPaths = paths.getVariantPaths(name)
        await saveFile(vPaths, variantBuffer, 'image/webp')
        variantUrls[name] = vPaths
        variantsTotalSize += variantBuffer.length
      }),
    )

    const originalMime = entityType === 'avatar' ? 'image/webp' : ctx.file.type
    await saveFile(paths.path, processedBuffer, originalMime)

    const totalSize = processedBuffer.length + variantsTotalSize

    const dbRecord = await handler.afterSave(ctx, { url: paths.path, variants: variantUrls, size: totalSize, metadata })

    if (entityType !== 'avatar' && entityType !== 'blog') {
      await quotaService.incrementStorageUsage(ctx.userId, totalSize)
    }

    fileUploadsCounter.inc({ placement: entityType })
    fileUploadSizeBytesHistogram.observe({ placement: entityType }, totalSize)

    return { url: paths.path, variants: variantUrls, dbRecord, metadata }
  }
}

export const imageUploadService = new ImageUploadService()
