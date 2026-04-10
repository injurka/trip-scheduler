import type { z } from 'zod'
import type { CreateNoteInputSchema, ReorderNotesInputSchema, UpdateNoteInputSchema } from './note.schemas'
import { createTRPCError } from '~/lib/trpc'
import { noteRepository } from '~/repositories/note.repository'
import { tripRepository } from '~/repositories/trip.repository'

function formatNote(note: any) {
  const { noteImages, trip, ...rest } = note
  const images = (noteImages || []).filter((ni: any) => ni.image).map((ni: any) => {
    const sources: Record<string, string> = { original: ni.image.url }
    if (ni.image.variants) {
      Object.assign(sources, ni.image.variants)
    }
    return {
      id: ni.imageId,
      sources,
    }
  })
  return { ...rest, images }
}

export const noteService = {
  async getByTripId(tripId: string) {
    const trip = await tripRepository.getById(tripId)
    if (!trip)
      throw createTRPCError('NOT_FOUND', 'Путешествие не найдено')
    const notes = await noteRepository.getByTripId(tripId)
    return notes.map(formatNote)
  },

  async create(data: z.infer<typeof CreateNoteInputSchema>, userId: string, userRole: string) {
    const trip = await tripRepository.getById(data.tripId)
    if (!trip)
      throw createTRPCError('NOT_FOUND', 'Путешествие не найдено')
    if (trip.userId !== userId && userRole !== 'admin')
      throw createTRPCError('FORBIDDEN', 'Нет прав')

    const note = await noteRepository.create(data)
    return formatNote(note)
  },

  async update(data: z.infer<typeof UpdateNoteInputSchema>, userId: string, userRole: string) {
    const note = await noteRepository.getById(data.id)
    if (!note)
      throw createTRPCError('NOT_FOUND', 'Заметка не найдена')
    if (note.trip.userId !== userId && userRole !== 'admin')
      throw createTRPCError('FORBIDDEN', 'Нет прав')

    if (data.parentId) {
      const hasCycle = await noteRepository.checkCycle(data.id, data.parentId)
      if (hasCycle)
        throw createTRPCError('BAD_REQUEST', 'Нельзя переместить папку саму в себя или в свои подпапки')
    }

    await noteRepository.update(data.id, data)

    const updated = await noteRepository.getById(data.id)
    if (!updated)
      throw createTRPCError('NOT_FOUND', 'Заметка не найдена после обновления')
    return formatNote(updated)
  },

  async delete(id: string, userId: string, userRole: string) {
    const note = await noteRepository.getById(id)
    if (!note)
      throw createTRPCError('NOT_FOUND', 'Заметка не найдена')
    if (note.trip.userId !== userId && userRole !== 'admin')
      throw createTRPCError('FORBIDDEN', 'Нет прав')

    const deleted = await noteRepository.delete(id)
    if (!deleted)
      throw createTRPCError('NOT_FOUND', 'Не удалось удалить заметку')
    return formatNote(deleted)
  },

  async reorder(data: z.infer<typeof ReorderNotesInputSchema>, userId: string, userRole: string) {
    const trip = await tripRepository.getById(data.tripId)
    if (!trip)
      throw createTRPCError('NOT_FOUND', 'Путешествие не найдено')
    if (trip.userId !== userId && userRole !== 'admin')
      throw createTRPCError('FORBIDDEN', 'Нет прав')

    await noteRepository.reorder(data.tripId, data.updates)
    return { success: true }
  },

  async getImagesUsage(tripId: string) {
    const trip = await tripRepository.getById(tripId)
    if (!trip)
      throw createTRPCError('NOT_FOUND', 'Путешествие не найдено')

    const images = await noteRepository.getImagesUsage(tripId)
    return images.map((img) => {
      const sources: Record<string, string> = { original: img.url }
      if (img.variants) {
        Object.assign(sources, img.variants as Record<string, string>)
      }
      return {
        id: img.id,
        width: img.width,
        height: img.height,
        sources,
        usedIn: img.noteImages.map((ni: any) => ({
          id: ni.note.id,
          title: ni.note.title,
          type: ni.note.type,
        })),
      }
    })
  },
}
