import type { Transport } from '@limiteddissolve/obsidian-importer'
import type { z } from 'zod'
import type { CreateActivityInputSchema } from '~/modules/activity/activity.schemas'
import { tripService } from '~/modules/trip/trip.service'
import { activityRepository } from '~/repositories/activity.repository'
import { dayRepository } from '~/repositories/day.repository'
import { noteRepository } from '~/repositories/note.repository'
import { tripSectionRepository } from '~/repositories/trip-section.repository'
import { tripRepository } from '~/repositories/trip.repository'

/**
 * InProcess-реализация Transport импортера obsidian-importer: пишет данные
 * напрямую через серверные сервисы/репозитории, без REST-клиента (DIP —
 * интерфейс объявлен в пакете импортера, реализация живет у потребителя).
 *
 * @module
 */
export function createInProcessTransport(userId: string): Transport {
  return {
    async createTrip(payload) {
      // tripService.create проверяет квоту, создает дефолтные разделы и «День 1»
      const trip = await tripService.create({
        title: payload.title,
        description: payload.description,
        startDate: payload.startDate,
        endDate: payload.endDate,
      }, userId)
      return { id: trip.id, title: trip.title }
    },

    async updateTrip(id, details) {
      await tripRepository.update(id, details as any)
    },

    async deleteTrip(id) {
      await tripRepository.delete(id)
    },

    async getTripDetails(tripId) {
      const trip = await tripRepository.getById(tripId) as any
      if (!trip)
        return null
      return {
        sections: (trip.sections || []).map((s: any) => ({ id: s.id, type: String(s.type), title: s.title })),
      }
    },

    async getDaysByTripId(tripId) {
      const days = await dayRepository.getByTripId(tripId)
      return (days || []).map(d => ({ id: d.id, date: String(d.date ?? ''), title: d.title }))
    },

    async createDay(payload) {
      const day = await dayRepository.create({
        tripId: payload.tripId,
        title: payload.title,
        description: payload.description ?? null,
        date: payload.date,
      })
      return { id: day.id, title: day.title }
    },

    async updateDay(id, details) {
      await dayRepository.update(id, details as any)
    },

    async deleteDay(id) {
      await dayRepository.delete(id)
    },

    async createActivity(payload) {
      await activityRepository.create(payload as z.infer<typeof CreateActivityInputSchema>)
    },

    async createTripSection(payload) {
      await tripSectionRepository.create({
        tripId: payload.tripId,
        type: payload.type as any,
        title: payload.title,
        icon: payload.icon ?? null,
        content: payload.content ?? null,
      })
    },

    async updateTripSection(id, payload) {
      const update: Record<string, unknown> = {
        title: payload.title,
      }
      if (payload.icon !== undefined)
        update.icon = payload.icon
      if (payload.content !== undefined)
        update.content = payload.content
      await tripSectionRepository.update(id, update as any)
    },

    async createNote(payload) {
      const note = await noteRepository.create(payload)
      return { id: note.id, title: note.title }
    },

    async updateNote(id, payload) {
      await noteRepository.update(id, payload as any)
    },
  }
}
