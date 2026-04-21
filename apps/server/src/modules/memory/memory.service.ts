import type { z } from 'zod'
import type { CreateMemoryInputSchema, GetMemoriesInputSchema, UpdateMemoryInputSchema } from '~/modules/memory/memory.schemas'
import { createTRPCError } from '~/lib/trpc'
import { imageRepository } from '~/repositories/image.repository'
import { memoryRepository } from '~/repositories/memory.repository'
import { accessControlService } from '~/services/access-control.service'
import { deleteFileWithVariants } from '~/services/file-storage.service'
import { quotaService } from '~/services/quota.service'

export const memoryService = {
  async create(data: z.infer<typeof CreateMemoryInputSchema>, userId: string, userRole: string) {
    await accessControlService.getTripAndVerifyAccess(data.tripId, userId, userRole)
    const result = await memoryRepository.create(data)
    return result || null
  },

  async update(data: z.infer<typeof UpdateMemoryInputSchema>, userId: string, userRole: string) {
    await accessControlService.getMemoryAndVerifyAccess(data.id, userId, userRole)
    const updatedMemory = await memoryRepository.update(data)
    if (!updatedMemory)
      throw createTRPCError('NOT_FOUND', `Воспоминание с ID ${data.id} не найдено.`)

    return updatedMemory
  },

  /**
   * Удаляет воспоминание по ID.
   * Сначала проверяет права доступа, затем удаляет запись из БД,
   * а также связанные с ней файлы и обновляет квоту хранилища.
   */
  async delete(id: string, userId: string, userRole: string) {
    // Шаг 1: Проверяем права доступа и получаем объект воспоминания.
    // Если прав нет или объект не найден, сервис выбросит ошибку.
    const memory = await accessControlService.getMemoryAndVerifyAccess(id, userId, userRole)
    const ownerId = memory.trip.userId

    // Шаг 2: Удаляем запись из репозитория. Репозиторий вернет полный
    // объект с данными об изображении, чтобы мы могли его удалить из хранилища.
    const deletedMemory = await memoryRepository.delete(id)
    if (!deletedMemory) {
      throw createTRPCError('NOT_FOUND', `Воспоминание с ID ${id} не найдено или уже удалено.`)
    }

    // Шаг 3: Выполняем побочные эффекты (удаление файла и обновление квоты).
    const imageToDelete = deletedMemory.image
    if (deletedMemory.imageId && imageToDelete) {
      try {
        // Уменьшаем квоту на хранилище у ВЛАДЕЛЬЦА путешествия
        if (imageToDelete.sizeBytes) {
          await quotaService.decrementStorageUsage(ownerId, imageToDelete.sizeBytes)
        }

        // Удаляем запись об изображении из таблицы tripImages
        await imageRepository.delete(deletedMemory.imageId)

        // Удаляем сам файл и его варианты из S3
        await deleteFileWithVariants(imageToDelete)
      }
      catch (error) {
        // Логируем ошибку, но не прерываем операцию, так как
        // основная запись (воспоминание) уже удалена.
        console.error(`Ошибка при удалении файлов изображения для воспоминания ${id}:`, error)
      }
    }

    // Шаг 4: Возвращаем удаленный объект, как того ожидает процедура.
    return deletedMemory
  },

  async getByTripId(input: z.infer<typeof GetMemoriesInputSchema>) {
    return await memoryRepository.getByTripId(input)
  },

  async applyTakenAt(id: string) {
    const result = await memoryRepository.applyTakenAtTimestamp(id)
    return result || null
  },

  async unassignDate(id: string) {
    const result = await memoryRepository.unassignTimestamp(id)
    return result || null
  },
}
