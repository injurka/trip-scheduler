import type { Transport } from '@limiteddissolve/obsidian-importer'
import type { z } from 'zod'
import type { CreateActivityInputSchema } from '~/modules/activity/activity.schemas'
import { geoService } from '~/modules/geo/geo.service'
import { metroService } from '~/modules/metro/metro.service'
import { tripService } from '~/modules/trip/trip.service'
import { activityRepository } from '~/repositories/activity.repository'
import { dayRepository } from '~/repositories/day.repository'
import { noteRepository } from '~/repositories/note.repository'
import { tripSectionRepository } from '~/repositories/trip-section.repository'
import { tripRepository } from '~/repositories/trip.repository'

async function ensureUniqueShareSlug(slug?: string, tripId?: string): Promise<string | undefined> {
  if (!slug)
    return undefined

  const normalized = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  if (!normalized)
    return undefined

  const available = await tripRepository.isShareSlugAvailable(normalized, tripId)
  if (available)
    return normalized

  return `${normalized.slice(0, 52)}-${crypto.randomUUID().slice(0, 6)}`
}

async function bestEffortEnrichFlightBookings(content: unknown): Promise<unknown> {
  if (!content || typeof content !== 'object' || Array.isArray(content))
    return content

  const record = content as Record<string, any>
  if (!Array.isArray(record.bookings))
    return content

  for (const booking of record.bookings) {
    if (booking?.type !== 'flight' || !Array.isArray(booking?.data?.segments))
      continue

    for (const segment of booking.data.segments) {
      for (const [cityKey, idKey] of [
        ['departureCity', 'departureCityId'],
        ['arrivalCity', 'arrivalCityId'],
      ] as const) {
        const label = typeof segment?.[cityKey] === 'string' ? segment[cityKey].trim() : ''
        if (!label || segment?.[idKey])
          continue

        try {
          const exact = await geoService.resolveExact({ label, kinds: ['settlement'] })
          if (exact.status === 'resolved' && exact.place && !exact.place.retired) {
            segment[idKey] = exact.place.id
            segment[cityKey] = exact.place.name
            continue
          }
          const topCandidate = exact.candidates?.find(c => c.place.kind === 'settlement' && !c.place.retired)?.place
          if (topCandidate) {
            segment[idKey] = topCandidate.id
            segment[cityKey] = topCandidate.name
          }
        }
        catch {
          // Best-effort enrichment; keep original text if geo lookup fails
        }
      }
    }
  }

  return content
}

/**
 * InProcess-реализация Transport импортера obsidian-importer: пишет данные
 * напрямую через серверные сервисы/репозитории, без REST-клиента (DIP —
 * интерфейс объявлен в пакете импортера, реализация живет у потребителя).
 *
 * @module
 */
export function createInProcessTransport(userId: string): Transport {
  return {
    listMetroSystems: () => metroService.listSystems(),
    getMetroSystemDetails: systemId => metroService.getDetails(systemId),
    resolveCity: label => geoService.resolveExact({ label }),
    getGeoPlacesByIds: ids => geoService.getByIds({ ids, locale: 'ru' }),
    searchGeoPlaces: query => geoService.search({ query, locale: 'ru', limit: 20 }),

    async createTrip(payload) {
      const shareSlug = await ensureUniqueShareSlug(payload.shareSlug)
      // tripService.create проверяет квоту, создает дефолтные разделы и «День 1»
      const trip = await tripService.create({
        title: payload.title,
        shareSlug,
        description: payload.description,
        startDate: payload.startDate,
        endDate: payload.endDate,
      }, userId)
      return { id: trip.id, title: trip.title }
    },

    async updateTrip(id, details) {
      const nextDetails = { ...(details as Record<string, any>) }
      if (typeof nextDetails.shareSlug === 'string') {
        nextDetails.shareSlug = await ensureUniqueShareSlug(nextDetails.shareSlug, id)
      }
      await tripService.update(id, nextDetails as any, userId, 'user')
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
      const enrichedContent = payload.type === 'bookings'
        ? await bestEffortEnrichFlightBookings(payload.content)
        : payload.content

      await tripSectionRepository.create({
        tripId: payload.tripId,
        type: payload.type as any,
        title: payload.title,
        icon: payload.icon ?? null,
        content: enrichedContent ?? null,
      })
    },

    async updateTripSection(id, payload) {
      const update: Record<string, unknown> = {
        title: payload.title,
      }
      if (payload.icon !== undefined)
        update.icon = payload.icon
      if (payload.content !== undefined) {
        update.content = await bestEffortEnrichFlightBookings(payload.content)
      }
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
