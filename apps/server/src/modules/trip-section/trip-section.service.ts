import type { z } from 'zod'
import type { CreateTripSectionInputSchema, ReorderTripSectionsInputSchema, UpdateTripSectionInputSchema } from './trip-section.schemas'
import { createTRPCError } from '~/lib/trpc'
import { tripSectionRepository } from '~/repositories/trip-section.repository'
import { tripRepository } from '~/repositories/trip.repository'

export const tripSectionService = {
  async create(data: z.infer<typeof CreateTripSectionInputSchema>, userId: string) {
    const trip = await tripRepository.getById(data.tripId)
    if (!trip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${data.tripId} не найдено.`)

    if (trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на добавление раздела в это путешествие.')

    return await tripSectionRepository.create(data)
  },

  async update(data: z.infer<typeof UpdateTripSectionInputSchema>, userId: string) {
    const section = await tripSectionRepository.findByIdWithOwner(data.id)
    if (!section)
      throw createTRPCError('NOT_FOUND', `Раздел с ID ${data.id} не найден.`)

    if (section.trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на изменение этого раздела.')

    const { id, ...updateData } = data
    const updatedSection = await tripSectionRepository.update(id, updateData)
    if (!updatedSection)
      throw createTRPCError('NOT_FOUND', `Раздел с ID ${id} не найден.`)

    return updatedSection
  },

  async delete(id: string, userId: string) {
    const section = await tripSectionRepository.findByIdWithOwner(id)
    if (!section)
      throw createTRPCError('NOT_FOUND', `Раздел с ID ${id} не найден.`)

    if (section.trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на удаление этого раздела.')

    const deletedSection = await tripSectionRepository.delete(id)
    if (!deletedSection)
      throw createTRPCError('NOT_FOUND', `Раздел с ID ${id} не найден.`)

    return deletedSection
  },

  async reorder(data: z.infer<typeof ReorderTripSectionsInputSchema>, userId: string) {
    const trip = await tripRepository.getById(data.tripId)
    if (!trip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${data.tripId} не найдено.`)

    if (trip.userId !== userId)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на изменение порядка разделов в этом путешествии.')

    await tripSectionRepository.reorder(data.tripId, data.updates)
    return { success: true }
  },
}
