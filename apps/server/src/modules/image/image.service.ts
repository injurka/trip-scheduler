import type { tripImagePlacementEnum } from 'db/schema'
import type { EntityType } from '~/models/image-upload'
import type { ImageMetadata } from '~/repositories/image.repository'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createTRPCError } from '~/lib/trpc'
import { imageRepository } from '~/repositories/image.repository'
import { postRepository } from '~/repositories/post.repository'
import { deleteFileWithVariants } from '~/services/file-storage.service'
import { quotaService } from '~/services/quota.service'

type Placement = (typeof tripImagePlacementEnum.enumValues)[number]

interface ServiceImageResult {
  id: string
  tripId?: string
  url: string
  originalName: string
  placement?: 'route' | 'memories' | 'content' | 'cover'
  createdAt: Date
  sizeBytes: number
  width?: number | null
  height?: number | null
  metadata?: any | null
  variants?: any | null
  takenAt?: Date | null
  latitude?: number | null
  longitude?: number | null
}

export const imageService = {
  /**
   * Сервисный метод для создания изображения.
   */
  async create(
    tripId: string,
    url: string,
    originalName: string,
    placement: Placement,
    sizeBytes: number,
    metadata: ImageMetadata,
  ) {
    return await imageRepository.create(
      tripId,
      url,
      originalName,
      placement,
      sizeBytes,
      metadata,
    )
  },

  async getMetadata(imageId: string) {
    return await imageRepository.getMetadata(imageId)
  },

  /**
   * Универсальный метод получения изображений.
   */
  async getByEntity(entityId: string, entityType: EntityType, placement?: string): Promise<ServiceImageResult[]> {
    if (entityType === 'trip') {
      return await imageRepository.getByTripId(entityId, placement as Placement)
    }

    if (entityType === 'post') {
      const media = await postRepository.getMediaByPostId(entityId)
      return media.map(m => ({
        id: m.id,
        tripId: '',
        url: m.url,
        originalName: m.originalName,
        placement: 'content',
        createdAt: new Date(),
        sizeBytes: 0,
        width: m.width,
        height: m.height,
        metadata: m.metadata,
      }))
    }

    if (entityType === 'blog') {
      try {
        const staticRoot = process.env.STATIC_PATH || 'static'
        const targetPlacement = placement || 'content'
        const dirPath = join(process.cwd(), staticRoot, 'blogs', entityId, targetPlacement)

        const files = await readdir(dirPath)
        const images: ServiceImageResult[] = []

        for (const file of files) {
          if (!file.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i))
            continue

          if (file.includes('-small') || file.includes('-medium') || file.includes('-large'))
            continue

          const stats = await stat(join(dirPath, file))

          images.push({
            id: file,
            tripId: '',
            url: `blogs/${entityId}/${targetPlacement}/${file}`,
            originalName: file,
            placement: targetPlacement as any,
            createdAt: stats.ctime,
            sizeBytes: stats.size,
          })
        }

        return images.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      }
      catch {
        return []
      }
    }

    return []
  },

  async getByTripId(tripId: string, placement?: Placement) {
    return await imageRepository.getByTripId(tripId, placement)
  },

  async getAll(userId: string) {
    return await imageRepository.getAllByUserId(userId)
  },

  async delete(fileId: string, userId: string) {
    const tripImage = await imageRepository.getById(fileId)
    if (tripImage) {
      if (tripImage.trip?.userId !== userId) {
        throw createTRPCError('FORBIDDEN', 'У вас нет прав на удаление этого файла.')
      }
      await deleteFileWithVariants(tripImage)
      await imageRepository.delete(fileId)
      await quotaService.decrementStorageUsage(userId, tripImage.sizeBytes)
      return { success: true, id: fileId }
    }

    throw createTRPCError('NOT_FOUND', 'Файл не найден в базе данных.')
  },
}
