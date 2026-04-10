import type { z } from 'zod'
import type { CreateDayInputSchema, UpdateDayInputSchema } from './day.schemas'
import { createTRPCError } from '~/lib/trpc'
import { dayRepository } from '~/repositories/day.repository'
import { accessControlService } from '~/services/access-control.service'

export const dayService = {
  async getNote(dayId: string) {
    const note = await dayRepository.getNote(dayId)
    return note
  },

  async getByTripId(id: string) {
    const day = await dayRepository.getByTripId(id)
    if (!day)
      throw createTRPCError('NOT_FOUND', `День с ID ${id} не найден.`)

    return day
  },

  async create(data: z.infer<typeof CreateDayInputSchema>, userId: string, userRole: string) {
    await accessControlService.getTripAndVerifyAccess(data.tripId, userId, userRole)
    return await dayRepository.create(data)
  },

  async update(id: string, details: z.infer<typeof UpdateDayInputSchema>['details'], userId: string, userRole: string) {
    await accessControlService.getDayAndVerifyAccess(id, userId, userRole)
    const updatedDay = await dayRepository.update(id, details)
    if (!updatedDay) {
      throw createTRPCError('NOT_FOUND', `День с ID ${id} не найден.`)
    }
    return updatedDay
  },

  async delete(id: string, userId: string, userRole: string) {
    await accessControlService.getDayAndVerifyAccess(id, userId, userRole)
    const deletedDay = await dayRepository.delete(id)
    if (!deletedDay) {
      throw createTRPCError('NOT_FOUND', `День с ID ${id} не найден.`)
    }
    return deletedDay
  },
}
