import type { z } from 'zod'
import type { CreateTripInputSchema, ListTripsInputSchema, UpdateTripInputSchema } from './trip.schemas'
import { createTRPCError } from '~/lib/trpc'
import { dayRepository } from '~/repositories/day.repository'
import { tripRepository } from '~/repositories/trip.repository'
import { quotaService } from '~/services/quota.service'

export const tripService = {
  async getAll(filters?: z.infer<typeof ListTripsInputSchema>, userId?: string) {
    return await tripRepository.getAll(filters, userId)
  },

  async getUniqueCities() {
    return await tripRepository.getUniqueCities()
  },

  async getUniqueTags(query?: string) {
    return await tripRepository.getUniqueTags(query)
  },

  async getById(id: string) {
    const trip = await tripRepository.getById(id)
    if (!trip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${id} не найдено.`)

    return trip
  },

  async getByIdWithDays(id: string) {
    const trip = await tripRepository.getByIdWithDays(id)
    if (!trip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${id} не найдено.`)

    return trip
  },

  async create(data: z.infer<typeof CreateTripInputSchema>, userId: string) {
    // Проверка квоты перед созданием
    await quotaService.checkTripCreationQuota(userId)

    const newTrip = await tripRepository.create(data, userId)

    // Автоматически создаем первый день для нового путешествия
    if (newTrip) {
      try {
        await dayRepository.create({
          tripId: newTrip.id,
          date: newTrip.startDate,
          title: 'День 1',
          description: 'Начало вашего удивительного путешествия!',
        })
      }
      catch (error) {
        console.error(`Failed to create initial day for trip ${newTrip.id}:`, error)
      }
    }
    // Увеличение счетчика после успешного создания
    await quotaService.incrementTripCount(userId)

    return newTrip
  },

  async update(id: string, details: z.infer<typeof UpdateTripInputSchema>['details'], userId: string) {
    const trip = await tripRepository.getById(id)
    if (!trip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${id} не найдено.`)

    if (trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на изменение этого путешествия.')

    const updatedTrip = await tripRepository.update(id, details)
    if (!updatedTrip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${id} не найдено.`)

    return updatedTrip
  },

  async delete(id: string, userId: string) {
    // Сначала получаем данные о путешествии, чтобы знать userId и кол-во изображений
    const tripToDelete = await tripRepository.getByIdWithImages(id)
    if (!tripToDelete)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${id} для удаления не найдено.`)

    if (tripToDelete.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на удаление этого путешествия.')

    const deletedTrip = await tripRepository.delete(id)
    if (!deletedTrip) {
      // Этого не должно произойти, если мы нашли его выше, но для надежности
      throw createTRPCError('INTERNAL_SERVER_ERROR', `Не удалось удалить путешествие с ID ${id}.`)
    }

    // Уменьшаем счетчик путешествий
    await quotaService.decrementTripCount(tripToDelete.userId)

    // Уменьшаем счетчик занимаемого места
    const totalImageSize = tripToDelete.images.reduce((sum, image) => sum + (image.sizeBytes || 0), 0)
    if (totalImageSize > 0)
      await quotaService.decrementStorageUsage(tripToDelete.userId, totalImageSize)

    return deletedTrip
  },

  async listByUser(userId: string, limit: number) {
    return await tripRepository.listByUser(userId, limit)
  },
}
