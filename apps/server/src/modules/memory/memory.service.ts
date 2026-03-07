import type { z } from 'zod'
import type { CreateMemoryInputSchema, GetMemoriesInputSchema, UpdateMemoryInputSchema } from '~/modules/memory/memory.schemas'
import { createTRPCError } from '~/lib/trpc'
import { imageRepository } from '~/repositories/image.repository'
import { memoryRepository } from '~/repositories/memory.repository'
import { tripRepository } from '~/repositories/trip.repository'
import { deleteFileWithVariants } from '~/services/file-storage.service'
import { quotaService } from '~/services/quota.service'

export const memoryService = {
  async create(data: z.infer<typeof CreateMemoryInputSchema>, userId: string) {
    const trip = await tripRepository.getById(data.tripId)
    if (!trip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${data.tripId} не найдено.`)

    if (trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на добавление воспоминания в это путешествие.')

    const result = await memoryRepository.create(data)
    return result || null
  },

  async update(data: z.infer<typeof UpdateMemoryInputSchema>, userId: string) {
    const memory = await memoryRepository.findByIdWithOwner(data.id)
    if (!memory)
      throw createTRPCError('NOT_FOUND', `Воспоминание с ID ${data.id} не найдено.`)

    if (memory.trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на изменение этого воспоминания.')

    const updatedMemory = await memoryRepository.update(data)
    if (!updatedMemory)
      throw createTRPCError('NOT_FOUND', `Воспоминание с ID ${data.id} не найдено.`)

    return updatedMemory
  },

  async delete(id: string, userId: string) {
    const memory = await memoryRepository.findByIdWithOwner(id)
    if (!memory)
      throw createTRPCError('NOT_FOUND', `Воспоминание с ID ${id} не найдено.`)

    if (memory.trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на удаление этого воспоминания.')

    const deletedMemory = await memoryRepository.delete(id)
    if (!deletedMemory)
      throw createTRPCError('NOT_FOUND', `Воспоминание с ID ${id} не найдено.`)

    const imageToDelete = deletedMemory.image
    if (deletedMemory.imageId && imageToDelete) {
      try {
        if (imageToDelete.sizeBytes)
          await quotaService.decrementStorageUsage(userId, imageToDelete.sizeBytes)

        await imageRepository.delete(deletedMemory.imageId)
        await deleteFileWithVariants(imageToDelete)
      }
      catch (error) {
        console.error(`Ошибка при удалении файлов изображения для воспоминания ${id}:`, error)
      }
    }

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
