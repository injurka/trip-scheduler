import type { z } from 'zod'
import type { CreateTripInputSchema, ListTripsInputSchema, UpdateTripInputSchema } from './trip.schemas'
import { createTRPCError } from '~/lib/trpc'
import { dayRepository } from '~/repositories/day.repository'
import { tripRepository } from '~/repositories/trip.repository'
import { quotaService } from '~/services/quota.service'

export const tripService = {
  async getAll(filters?: z.infer<typeof ListTripsInputSchema>, userId?: string) {
    const trips = await tripRepository.getAll(filters, userId)
    return trips as NonNullable<typeof trips[number]>[]
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
    await quotaService.checkTripCreationQuota(userId)

    const newTrip = await tripRepository.create(data, userId)

    if (!newTrip) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось создать путешествие.')
    }

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

    await quotaService.incrementTripCount(userId)

    return newTrip
  },

  async update(
    id: string,
    details: z.infer<typeof UpdateTripInputSchema>['details'],
    userId: string,
    userRole: string,
  ) {
    const trip = await tripRepository.getById(id)
    if (!trip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${id} не найдено.`)

    if (trip.userId !== userId && userRole !== 'admin')
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на изменение этого путешествия.')

    const updatedTrip = await tripRepository.update(id, details)
    if (!updatedTrip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${id} не найдено.`)

    return updatedTrip
  },

  async delete(id: string, userId: string, userRole: string) {
    const tripToDelete = await tripRepository.getByIdWithImages(id)
    if (!tripToDelete)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${id} для удаления не найдено.`)

    if (tripToDelete.userId !== userId && userRole !== 'admin')
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на удаление этого путешествия.')

    const deletedTrip = await tripRepository.delete(id)
    if (!deletedTrip) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', `Не удалось удалить путешествие с ID ${id}.`)
    }

    await quotaService.decrementTripCount(tripToDelete.userId)

    const totalImageSize = tripToDelete.images.reduce((sum, image) => sum + (image.sizeBytes || 0), 0)
    if (totalImageSize > 0)
      await quotaService.decrementStorageUsage(tripToDelete.userId, totalImageSize)

    return deletedTrip
  },

  async listByUser(userId: string, limit: number) {
    const trips = await tripRepository.listByUser(userId, limit)
    return trips as NonNullable<typeof trips[number]>[]
  },
}
