import type { tripImagePlacementEnum } from 'db/schema'
import type { DocumentMetadata } from '~/models/image'
import type { EntityType } from '~/models/image-upload'
import type { ImageMetadata } from '~/repositories/image.repository'
import { createTRPCError } from '~/lib/trpc'
import { imageRepository } from '~/repositories/image.repository'
import { postRepository } from '~/repositories/post.repository'
import { tripRepository } from '~/repositories/trip.repository'
import { deleteFileWithVariants } from '~/services/file-storage.service'
import { quotaService } from '~/services/quota.service'
import { s3Service } from '~/services/s3.service'

type Placement = (typeof tripImagePlacementEnum.enumValues)[number]

interface ServiceImageResult {
  id: string
  tripId?: string
  url: string
  originalName: string
  placement?: 'route' | 'memories' | 'content' | 'cover' | 'notes'
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

        const prefix = `blogs/${entityId}/${targetPlacement}/`
        const s3Objects = await s3Service.listDirectory(prefix)

        for (const obj of s3Objects) {
          if (!obj.Key || !/\.(jpg|jpeg|png|webp|gif|avif)$/i.test(obj.Key))
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

        // eslint-disable-next-line e18e/prefer-spread-syntax
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

  async delete(fileId: string, userId: string, userRole: string) {
    const tripImage = await imageRepository.getById(fileId)
    if (tripImage) {
      if (tripImage.trip?.userId !== userId && userRole !== 'admin') {
        throw createTRPCError('FORBIDDEN', 'У вас нет прав на удаление этого файла.')
      }
      await deleteFileWithVariants(tripImage)
      await imageRepository.delete(fileId)
      await quotaService.decrementStorageUsage(userId, tripImage.sizeBytes)
      return { success: true, id: fileId }
    }

    throw createTRPCError('NOT_FOUND', 'Файл не найден в базе данных.')
  },

  async listDocuments(tripId: string, userId?: string, userRole?: string) {
    let isParticipantOrOwner = false

    if (userId) {
      if (userRole === 'admin') {
        isParticipantOrOwner = true
      }
      else {
        isParticipantOrOwner = await tripRepository.hasAccess(tripId, userId)
      }
    }

    const documents = await imageRepository.listDocuments(tripId)

    if (isParticipantOrOwner) {
      return documents
    }
    else {
      return documents.filter(doc => doc.metadata.access === 'public')
    }
  },

  async updateDocumentMeta(id: string, newMetadata: Partial<DocumentMetadata>, userId: string, userRole: string) {
    const image = await imageRepository.getById(id)
    if (!image) {
      throw createTRPCError('NOT_FOUND', 'Файл не найден')
    }

    const hasAccess = await tripRepository.hasAccess(image.tripId, userId)
    if (!hasAccess && userRole !== 'admin') {
      throw createTRPCError('FORBIDDEN', 'Нет прав для редактирования')
    }

    const updated = await imageRepository.updateDocumentMeta(id, newMetadata)
    if (!updated) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось обновить файл')
    }

    return updated
  },

}
