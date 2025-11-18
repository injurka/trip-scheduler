import type { z } from 'zod'
import type { CreateDayInputSchema, UpdateDayInputSchema } from './day.schemas'
import { createTRPCError } from '~/lib/trpc'
import { dayRepository } from '~/repositories/day.repository'
import { tripRepository } from '~/repositories/trip.repository'

export const dayService = {
  async getByTripId(id: string) {
    const day = await dayRepository.getByTripId(id)
    if (!day)
      throw createTRPCError('NOT_FOUND', `День с ID ${id} не найден.`)

    return day
  },

  async create(data: z.infer<typeof CreateDayInputSchema>, userId: string) {
    const trip = await tripRepository.getById(data.tripId)
    if (!trip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${data.tripId} не найдено.`)

    if (trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на добавление дня в это путешествие.')

    return await dayRepository.create(data)
  },

  async update(id: string, details: z.infer<typeof UpdateDayInputSchema>['details'], userId: string) {
    const day = await dayRepository.findByIdWithOwner(id)
    if (!day)
      throw createTRPCError('NOT_FOUND', `День с ID ${id} не найден.`)

    if (day.trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на изменение этого дня.')

    const updatedDay = await dayRepository.update(id, details)
    if (!updatedDay)
      throw createTRPCError('NOT_FOUND', `День с ID ${id} не найден.`)

    return updatedDay
  },

  async delete(id: string, userId: string) {
    const day = await dayRepository.findByIdWithOwner(id)
    if (!day)
      throw createTRPCError('NOT_FOUND', `День с ID ${id} не найден.`)

    if (day.trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на удаление этого дня.')

    const deletedDay = await dayRepository.delete(id)
    if (!deletedDay)
      throw createTRPCError('NOT_FOUND', `День с ID ${id} не найден.`)

    return deletedDay
  },
}
