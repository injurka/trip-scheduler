import type { z } from 'zod'
import type { CreateActivityInputSchema, UpdateActivityInputSchema } from './activity.schemas'
import { createTRPCError } from '~/lib/trpc'
import { activityRepository } from '~/repositories/activity.repository'
import { dayRepository } from '~/repositories/day.repository'

export const activityService = {
  async create(data: z.infer<typeof CreateActivityInputSchema>, userId: string) {
    const day = await dayRepository.findByIdWithOwner(data.dayId)
    if (!day)
      throw createTRPCError('NOT_FOUND', `День с ID ${data.dayId} не найден.`)

    if (day.trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на добавление активности в этот день.')

    return await activityRepository.create(data)
  },

  async update(data: z.infer<typeof UpdateActivityInputSchema>, userId: string) {
    const activity = await activityRepository.findByIdWithOwner(data.id)
    if (!activity)
      throw createTRPCError('NOT_FOUND', `Активность с ID ${data.id} не найдена.`)

    if (activity.day.trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на изменение этой активности.')

    const updatedActivity = await activityRepository.update(data)
    if (!updatedActivity)
      throw createTRPCError('NOT_FOUND', `Активность с ID ${data.id} не найдена.`)

    return updatedActivity
  },

  async delete(id: string, userId: string) {
    const activity = await activityRepository.findByIdWithOwner(id)
    if (!activity)
      throw createTRPCError('NOT_FOUND', `Активность с ID ${id} не найдена.`)

    if (activity.day.trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на удаление этой активности.')

    const deletedActivity = await activityRepository.delete(id)
    if (!deletedActivity)
      throw createTRPCError('NOT_FOUND', `Активность с ID ${id} не найдена.`)

    return deletedActivity
  },
}
