import type { tripImagePlacementEnum } from 'db/schema'
import type { EntityType } from '~/models/image-upload'
import type { ImageMetadata } from '~/repositories/image.repository'
import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createTRPCError } from '~/lib/trpc'
import { imageRepository } from '~/repositories/image.repository'
import { postRepository } from '~/repositories/post.repository'
import { deleteFileWithVariants } from '~/services/file-storage.service'
import { quotaService } from '~/services/quota.service'
import { s3Service } from '~/services/s3.service'

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
        const targetPlacement = placement || 'content'
        const imagesMap = new Map<string, ServiceImageResult>()

        // 2. Ищем в S3 (новые файлы)
        const prefix = `blogs/${entityId}/${targetPlacement}/`
        const s3Objects = await s3Service.listDirectory(prefix)

        for (const obj of s3Objects) {
          if (!obj.Key || !obj.Key.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i))
            continue
          if (obj.Key.includes('-small') || obj.Key.includes('-medium') || obj.Key.includes('-large'))
            continue

          const fileName = obj.Key.split('/').pop()!
          imagesMap.set(fileName, {
            id: fileName,
            tripId: '',
            url: obj.Key,
            originalName: fileName,
            placement: targetPlacement as any,
            createdAt: obj.LastModified || new Date(),
            sizeBytes: obj.Size || 0,
          })
        }

        // 3. Возвращаем объединенный массив, сортируя по дате
        return Array.from(imagesMap.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      }
      catch (error) {
        console.error('Error fetching blog images:', error)
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
