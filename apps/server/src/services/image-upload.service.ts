import type { EntityType, IUploadHandler, UploadContext, UploadResult } from '../models/image-upload'
import { tripImagePlacementEnum } from 'db/schema'
import { HTTPException } from 'hono/http-exception'
import sharp from 'sharp'
import { blogService } from '~/modules/blog/blog.service'
import { imageService } from '~/modules/image/image.service'

import { postService } from '~/modules/post/post.service'
import { blogRepository } from '~/repositories/blog.repository'
import { postRepository } from '~/repositories/post.repository'
// Импорт репозиториев и сервисов
import { tripRepository } from '~/repositories/trip.repository'
import { userRepository } from '~/repositories/user.repository'
import { generateFilePaths, saveFile } from '~/services/file-storage.service'
import { extractAndStructureMetadata, generateImageVariants } from '~/services/image-metadata.service'
import { fileUploadsCounter, fileUploadSizeBytesHistogram } from '~/services/metrics.service'
import { quotaService } from '~/services/quota.service'

/**
 * Стратегия для Путешествий
 */
const tripHandler: IUploadHandler = {
  async validate({ userId, entityId, placement, buffer }) {
    if (!placement || !tripImagePlacementEnum.enumValues.includes(placement as any)) {
      throw new HTTPException(400, { message: 'Некорректный тип размещения (route или memories).' })
    }
    const trip = await tripRepository.getById(entityId)
    if (!trip)
      throw new HTTPException(404, { message: 'Путешествие не найдено.' })
    if (trip.userId !== userId)
      throw new HTTPException(403, { message: 'Нет прав.' })

    await quotaService.checkStorageQuota(userId, buffer.length)
  },

  getFolderPath: ({ entityId, placement }) => `trips/${entityId}/${placement}`,

  async afterSave({ entityId, placement }, { url, size, metadata, variants }) {
    return await imageService.create(
      entityId,
      url,
      metadata.originalName || 'image',
      placement as 'route' | 'memories',
      size,
      { ...metadata, variants },
    )
  },
}

/**
 * Стратегия для Постов
 */
const postHandler: IUploadHandler = {
  async validate({ userId, entityId, buffer }) {
    const post = await postRepository.findById(entityId)
    if (!post)
      throw new HTTPException(404, { message: 'Пост не найден.' })
    if (post.userId !== userId)
      throw new HTTPException(403, { message: 'Нет прав.' })

    await quotaService.checkStorageQuota(userId, buffer.length)
  },

  getFolderPath: ({ entityId }) => `posts/${entityId}`,

  async afterSave({ entityId }, { url, size, metadata, variants }) {
    return await postService.createMedia(
      entityId,
      url,
      metadata.originalName || 'image',
      size,
      { ...metadata, variants },
    )
  },
}

/**
 * Стратегия для Блога
 */
const blogHandler: IUploadHandler = {
  async validate({ userId, entityId }) {
    const user = await userRepository.getById(userId)
    if (user?.role !== 'admin')
      throw new HTTPException(403, { message: 'Доступ запрещен' })

    const blog = await blogRepository.findById(entityId)
    if (!blog)
      throw new HTTPException(404, { message: 'Блог не найден.' })
  },

  getFolderPath: ({ entityId, placement }) => {
    const subFolder = placement === 'cover' ? 'cover' : 'content'
    return `blogs/${entityId}/${subFolder}`
  },

  async afterSave({ entityId, placement }, { url, variants, metadata }) {
    if (placement === 'cover') {
      await blogService.updateCoverImage(entityId, url)
    }

    return { url, variants, metadata }
  },
}

/**
 * Стратегия для Аватара
 */
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

// Реестр хендлеров
const handlers: Record<EntityType, IUploadHandler> = {
  trip: tripHandler,
  post: postHandler,
  blog: blogHandler,
  avatar: avatarHandler,
}

/**
 * Основной класс сервиса загрузок
 */
export class ImageUploadService {
  /**
   * Центральный метод обработки загрузки
   */
  async processUpload(entityType: EntityType, ctx: UploadContext): Promise<UploadResult> {
    const handler = handlers[entityType]
    if (!handler) {
      throw new HTTPException(400, { message: 'Неизвестный тип сущности.' })
    }

    // 1. Валидация (права, квоты, существование)
    await handler.validate(ctx)

    // 2. Генерация путей
    const folderPath = handler.getFolderPath(ctx)
    // Для аватара имя фиксированное, для остальных - оригинальное или UUID
    const fileName = entityType === 'avatar' ? 'avatar.webp' : ctx.file.name
    const paths = generateFilePaths(folderPath, fileName)

    // 3. Обработка изображения (Sharp)
    let processedBuffer = ctx.buffer
    let variants: Record<string, Buffer> = {}
    let metadata: any = {}

    try {
      if (entityType === 'avatar') {
        // Специфичная логика для аватара: ресайз + конвертация в webp
        processedBuffer = await sharp(ctx.buffer)
          .resize({ width: 400, height: 400, fit: 'cover' })
          .webp({ quality: 90 })
          .toBuffer()
      }
      else {
        // Общая логика: метаданные + варианты
        const metaResult = await extractAndStructureMetadata(ctx.buffer)
        metadata = metaResult.metadata
        variants = await generateImageVariants(ctx.buffer)
      }
    }
    catch (e: any) {
      console.error('Sharp error:', e)
      throw new HTTPException(415, { message: 'Ошибка обработки изображения.' })
    }

    // 4. Сохранение на диск (или S3)
    const variantUrls: Record<string, string> = {}
    let variantsTotalSize = 0

    // Сохраняем варианты
    await Promise.all(
      Object.entries(variants).map(async ([name, variantBuffer]) => {
        const vPaths = paths.getVariantPaths(name)
        await saveFile(vPaths.diskPath, variantBuffer)
        variantUrls[name] = vPaths.dbPath
        variantsTotalSize += variantBuffer.length
      }),
    )

    // Сохраняем оригинал (или обработанный оригинал для аватара)
    await saveFile(paths.original.diskPath, processedBuffer)

    const totalSize = processedBuffer.length + variantsTotalSize

    // 5. Пост-обработка (Запись в БД, обновление квот)
    const dbRecord = await handler.afterSave(ctx, {
      url: paths.original.dbPath,
      variants: variantUrls,
      size: totalSize,
      metadata,
    })

    // Обновляем метрики и квоты (если применимо)
    if (entityType !== 'avatar' && entityType !== 'blog') {
      // Обычно блоги и аватары не едят пользовательскую квоту так же как файлы постов/трипов
      await quotaService.incrementStorageUsage(ctx.userId, totalSize)
    }

    fileUploadsCounter.inc({ placement: entityType })
    fileUploadSizeBytesHistogram.observe({ placement: entityType }, totalSize)

    return {
      url: paths.original.dbPath,
      variants: variantUrls,
      dbRecord,
      metadata,
    }
  }
}

export const imageUploadService = new ImageUploadService()
