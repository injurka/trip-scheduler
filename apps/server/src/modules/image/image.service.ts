import type { tripImagePlacementEnum } from 'db/schema'
import type { ImageMetadata } from '~/repositories/image.repository'
import { createTRPCError } from '~/lib/trpc'
import { imageRepository } from '~/repositories/image.repository'
import { deleteFileWithVariants } from '~/services/file-storage.service'
import { quotaService } from '~/services/quota.service'

type Placement = (typeof tripImagePlacementEnum.enumValues)[number]

export const imageService = {
  /**
   * Сервисный метод для создания изображения.
   * Принимает все данные и передает их в репозиторий.
   */
  async create(
    tripId: string,
    url: string,
    originalName: string,
    placement: Placement,
    sizeBytes: number,
    metadata: ImageMetadata,
  ) {
    return await imageRepository.create(tripId, url, originalName, placement, sizeBytes, metadata)
  },

  /**
   * Получает все изображения для путешествия.
   */
  async getByTripId(tripId: string, placement?: Placement) {
    return await imageRepository.getByTripId(tripId, placement)
  },

  /**
   * Получает все файлы, принадлежащие пользователю.
   */
  async getAll(userId: string) {
    return await imageRepository.getAllByUserId(userId)
  },

  /**
   * Удаляет файл.
   */
  async delete(fileId: string, userId: string) {
    const file = await imageRepository.getById(fileId)

    if (!file) {
      throw createTRPCError('NOT_FOUND', 'Файл не найден.')
    }

    if (file.trip?.userId !== userId) {
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на удаление этого файла.')
    }

    await deleteFileWithVariants(file)
    await imageRepository.delete(fileId)
    await quotaService.decrementStorageUsage(userId, file.sizeBytes)

    return { success: true, id: fileId }
  },
}
