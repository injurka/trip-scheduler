import type { z } from 'zod'
import type { CreateActivityInputSchema, UpdateActivityInputSchema } from './activity.schemas'
import { createTRPCError } from '~/lib/trpc'
import { activityRepository } from '~/repositories/activity.repository'
import { dayRepository } from '~/repositories/day.repository'
import { accessControlService } from '~/services/access-control.service'

export const activityService = {
  async create(data: z.infer<typeof CreateActivityInputSchema>, userId: string, userRole: string) {
    const day = await dayRepository.findByIdWithOwner(data.dayId)
    if (!day)
      throw createTRPCError('NOT_FOUND', `День с ID ${data.dayId} не найден.`)
    await accessControlService.getTripAndVerifyAccess(day.tripId, userId, userRole)
    return await activityRepository.create(data)
  },

  async update(data: z.infer<typeof UpdateActivityInputSchema>, userId: string, userRole: string) {
    await accessControlService.getActivityAndVerifyAccess(data.id, userId, userRole)
    const updatedActivity = await activityRepository.update(data)
    if (!updatedActivity) {
      throw createTRPCError('NOT_FOUND', `Активность с ID ${data.id} не найдена.`)
    }
    return updatedActivity
  },

  async delete(id: string, userId: string, userRole: string) {
    await accessControlService.getActivityAndVerifyAccess(id, userId, userRole)
    const deletedActivity = await activityRepository.delete(id)
    if (!deletedActivity) {
      throw createTRPCError('NOT_FOUND', `Активность с ID ${id} не найдена.`)
    }
    return deletedActivity
  },
}
