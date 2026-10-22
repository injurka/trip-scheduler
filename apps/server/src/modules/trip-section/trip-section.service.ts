import type { z } from 'zod'
import type { CreateTripSectionInputSchema, ReorderTripSectionsInputSchema, TripSectionType, UpdateTripSectionInputSchema } from './trip-section.schemas'
import { FinancesSectionContentSchema } from '@injurka/finance-contract'
import { createTRPCError } from '~/lib/trpc'
import { CityIdsInputSchema } from '~/modules/geo/geo.schemas'
import { geoRepository } from '~/repositories/geo.repository'
import { tripSectionRepository } from '~/repositories/trip-section.repository'
import { tripRepository } from '~/repositories/trip.repository'

interface TripSectionResult {
  id: string
  tripId: string
  type: TripSectionType
  title: string
  icon: string | null
  content: any
  order: number
  createdAt: Date
  updatedAt: Date
}

async function canonicalizeFlightCities(contentValue: unknown, existingContent?: unknown) {
  if (!contentValue || typeof contentValue !== 'object' || Array.isArray(contentValue))
    return contentValue

  const content = JSON.parse(JSON.stringify(contentValue)) as Record<string, any>
  if (!Array.isArray(content.bookings))
    return contentValue

  const segments = content.bookings
    .filter((booking: any) => booking?.type === 'flight' && Array.isArray(booking?.data?.segments))
    .flatMap((booking: any) => booking.data.segments)
  const previousBookings = existingContent && typeof existingContent === 'object' && !Array.isArray(existingContent)
    ? (existingContent as Record<string, any>).bookings
    : undefined

  for (const [bookingIndex, booking] of content.bookings.entries()) {
    if (booking?.type !== 'flight' || !Array.isArray(booking?.data?.segments))
      continue

    const previousBooking = Array.isArray(previousBookings)
      ? previousBookings.find((candidate: any) => booking.id && candidate?.id === booking.id) ?? previousBookings[bookingIndex]
      : undefined
    const previousSegments = previousBooking?.type === 'flight' && Array.isArray(previousBooking?.data?.segments)
      ? previousBooking.data.segments
      : []

    for (const [segmentIndex, segment] of booking.data.segments.entries()) {
      const previous = previousSegments[segmentIndex]
      for (const [cityField, idField] of [
        ['departureCity', 'departureCityId'],
        ['arrivalCity', 'arrivalCityId'],
      ] as const) {
        const label = typeof segment?.[cityField] === 'string' ? segment[cityField].trim() : ''
        if (segment?.[idField] || !label)
          continue

        const previousLabel = typeof previous?.[cityField] === 'string' ? previous[cityField].trim() : ''
        if (label === previousLabel && previous?.[idField]) {
          segment[idField] = previous[idField]
          continue
        }
        if (label === previousLabel && !previous?.[idField])
          continue

        const resolution = await geoRepository.resolveExact({ label, kinds: ['settlement'] })
        if (resolution.status !== 'resolved' || !resolution.place) {
          const message = resolution.status === 'needs_review'
            ? `Город «${label}» в авиасегменте неоднозначен. Выберите его в обновлённой версии приложения.`
            : `Город «${label}» в авиасегменте не найден в справочнике.`
          throw createTRPCError('BAD_REQUEST', message)
        }
        segment[idField] = resolution.place.id
        segment[cityField] = resolution.place.name
      }
    }
  }

  const ids = [...new Set(segments.flatMap((segment: any) => [segment?.departureCityId, segment?.arrivalCityId]
    .filter((id: unknown): id is string => typeof id === 'string')))]

  if (ids.length === 0)
    return contentValue

  const parsedIds = CityIdsInputSchema.safeParse(ids)
  if (!parsedIds.success)
    throw createTRPCError('BAD_REQUEST', 'Некорректный ID города в авиасегменте.')

  const previousIds = new Set<string>()
  for (const booking of Array.isArray(previousBookings) ? previousBookings : []) {
    if (booking?.type !== 'flight' || !Array.isArray(booking?.data?.segments))
      continue
    for (const segment of booking.data.segments) {
      if (typeof segment?.departureCityId === 'string')
        previousIds.add(segment.departureCityId)
      if (typeof segment?.arrivalCityId === 'string')
        previousIds.add(segment.arrivalCityId)
    }
  }

  const places = await geoRepository.getByIds({ ids: parsedIds.data, locale: 'ru' })
  const selectableIds = new Set(await geoRepository.getSelectableIds(parsedIds.data))
  const placesById = new Map(places.map(place => [place.id, place]))
  if (places.length !== parsedIds.data.length || places.some(place => place.kind !== 'settlement')) {
    throw createTRPCError('BAD_REQUEST', 'В авиасегменте выбранный город не найден в справочнике.')
  }
  if (parsedIds.data.some(id => !selectableIds.has(id) && !previousIds.has(id))) {
    throw createTRPCError('BAD_REQUEST', 'Для авиасегментов можно выбирать только действующие города из справочника.')
  }

  for (const segment of segments) {
    if (segment.departureCityId)
      segment.departureCity = placesById.get(segment.departureCityId)?.name
    if (segment.arrivalCityId)
      segment.arrivalCity = placesById.get(segment.arrivalCityId)?.name
  }

  return content
}

export const tripSectionService = {
  async create(data: z.infer<typeof CreateTripSectionInputSchema>, userId: string, userRole: string) {
    const trip = await tripRepository.getById(data.tripId)
    if (!trip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${data.tripId} не найдено.`)

    if (trip.userId !== userId && userRole !== 'admin')
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на добавление раздела в это путешествие.')

    const result = await tripSectionRepository.create({
      ...data,
      ...(data.content !== undefined && { content: await canonicalizeFlightCities(data.content) }),
    })
    return result as unknown as TripSectionResult
  },

  async update(data: z.infer<typeof UpdateTripSectionInputSchema>, userId: string, userRole: string) {
    const section = await tripSectionRepository.findByIdWithOwner(data.id)
    if (!section)
      throw createTRPCError('NOT_FOUND', `Раздел с ID ${data.id} не найден.`)

    if (section.trip.userId !== userId && userRole !== 'admin')
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на изменение этого раздела.')

    const { id, expectedUpdatedAt, ...updateData } = data
    if (expectedUpdatedAt && section.updatedAt.getTime() !== expectedUpdatedAt.getTime())
      throw createTRPCError('CONFLICT', 'Раздел изменён в другой вкладке. Обновите страницу и повторите действие.')

    if (section.type === 'finances' && updateData.content !== undefined)
      updateData.content = FinancesSectionContentSchema.parse(updateData.content)
    if (section.type === 'bookings' && updateData.content !== undefined)
      updateData.content = await canonicalizeFlightCities(updateData.content, section.content)
    const updatedSection = await tripSectionRepository.update(id, updateData)
    if (!updatedSection)
      throw createTRPCError('NOT_FOUND', `Раздел с ID ${id} не найден.`)

    return updatedSection as unknown as TripSectionResult
  },

  async delete(id: string, userId: string, userRole: string) {
    const section = await tripSectionRepository.findByIdWithOwner(id)
    if (!section)
      throw createTRPCError('NOT_FOUND', `Раздел с ID ${id} не найден.`)

    if (section.trip.userId !== userId && userRole !== 'admin')
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на удаление этого раздела.')

    const deletedSection = await tripSectionRepository.delete(id)
    if (!deletedSection)
      throw createTRPCError('NOT_FOUND', `Раздел с ID ${id} не найден.`)

    return deletedSection as unknown as TripSectionResult
  },

  async reorder(data: z.infer<typeof ReorderTripSectionsInputSchema>, userId: string, userRole: string) {
    const trip = await tripRepository.getById(data.tripId)
    if (!trip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${data.tripId} не найдено.`)

    if (trip.userId !== userId && userRole !== 'admin')
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на изменение порядка разделов в этом путешествии.')

    await tripSectionRepository.reorder(data.tripId, data.updates)
    return { success: true }
  },
}
