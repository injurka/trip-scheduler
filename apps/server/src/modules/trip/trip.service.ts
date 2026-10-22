import type { z } from 'zod'
import type { TripWeatherData } from '../../../db/schema.type'
import type { CreateTripInputSchema, ListTripsInputSchema, TripWithDaysSchema, UpdateTripInputSchema } from './trip.schemas'
import { createTRPCError } from '~/lib/trpc'
import { commentRepository } from '~/repositories/comment.repository'
import { dayRepository } from '~/repositories/day.repository'
import { geoRepository } from '~/repositories/geo.repository'
import { tripSectionRepository } from '~/repositories/trip-section.repository'
import { tripRepository } from '~/repositories/trip.repository'
import { userRepository } from '~/repositories/user.repository'
import { accessControlService } from '~/services/access-control.service'
import { deleteTripFiles } from '~/services/file-storage.service'
import { weatherGenerationService } from '~/services/llm/weather-generation.service'
import { quotaService } from '~/services/quota.service'
import { TripSectionType } from '../trip-section/trip-section.schemas'

function isUniqueConstraintViolation(error: unknown): boolean {
  let current = error
  while (current && typeof current === 'object') {
    if ('code' in current && (current as { code?: unknown }).code === '23505')
      return true
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined
  }
  return false
}

export const tripService = {
  async getAll(filters?: z.infer<typeof ListTripsInputSchema>, userId?: string) {
    const trips = await tripRepository.getAll(filters, userId)
    return trips as NonNullable<typeof trips[number]>[]
  },

  async getUniqueTags(query?: string) {
    return await tripRepository.getUniqueTags(query)
  },

  async getById(id: string) {
    const trip = await tripRepository.getById(id)
    if (!trip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${id} не найдено.`)

    if (trip.weatherByPlaceId)
      trip.weatherByPlaceId = weatherGenerationService.sanitizeTripWeatherPayload(trip.weatherByPlaceId, trip.startDate)

    return trip
  },

  async getByIdWithDays(id: string) {
    const trip = await tripRepository.getByIdWithDays(id)
    if (!trip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${id} не найдено.`)

    if (trip.weatherByPlaceId)
      trip.weatherByPlaceId = weatherGenerationService.sanitizeTripWeatherPayload(trip.weatherByPlaceId, trip.startDate)

    return trip as unknown as z.infer<typeof TripWithDaysSchema>
  },

  async getByShareSlug(shareSlug: string) {
    const trip = await tripRepository.getByShareSlug(shareSlug)
    if (!trip)
      throw createTRPCError('NOT_FOUND', 'Путешествие по этой ссылке не найдено.')

    if (trip.weatherByPlaceId)
      trip.weatherByPlaceId = weatherGenerationService.sanitizeTripWeatherPayload(trip.weatherByPlaceId, trip.startDate)

    return trip as unknown as z.infer<typeof TripWithDaysSchema>
  },

  async getOrCreateShareSlug(tripId: string, userId: string, userRole: string) {
    const trip = await tripRepository.getById(tripId)
    if (!trip)
      throw createTRPCError('NOT_FOUND', 'Путешествие не найдено.')

    const canShare = userRole === 'admin'
      || trip.userId === userId
      || await tripRepository.hasAccess(tripId, userId)

    if (!canShare)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на создание ссылки для этого путешествия.')

    const shareSlug = await tripRepository.getOrCreateShareSlug(tripId, trip.title)
    if (!shareSlug)
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось создать ссылку для путешествия.')

    return shareSlug
  },

  async checkShareSlugAvailability(tripId: string, shareSlug: string, userId: string, userRole: string) {
    const trip = await tripRepository.getById(tripId)
    if (!trip)
      throw createTRPCError('NOT_FOUND', 'Путешествие не найдено.')

    const canShare = userRole === 'admin'
      || trip.userId === userId
      || await tripRepository.hasAccess(tripId, userId)

    if (!canShare)
      throw createTRPCError('FORBIDDEN', 'У вас нет прав на создание ссылки для этого путешествия.')

    return tripRepository.isShareSlugAvailable(shareSlug, tripId)
  },

  async create(data: z.infer<typeof CreateTripInputSchema>, userId: string) {
    await quotaService.checkTripCreationQuota(userId)

    const selectedPlaces = await geoRepository.getByIds({ ids: data.cityIds ?? [], locale: 'ru' })
    const selectableIds = await geoRepository.getSelectableIds(data.cityIds ?? [])
    if (selectedPlaces.length !== (data.cityIds?.length ?? 0) || selectableIds.length !== selectedPlaces.length) {
      throw createTRPCError('BAD_REQUEST', 'Выберите города из загруженного справочника.')
    }

    if (data.shareSlug && !await tripRepository.isShareSlugAvailable(data.shareSlug)) {
      throw createTRPCError('CONFLICT', 'Этот slug уже занят. Выберите другой.')
    }

    let newTrip
    try {
      newTrip = await tripRepository.create(data, userId, selectedPlaces)
    }
    catch (error) {
      if (isUniqueConstraintViolation(error) && data.shareSlug) {
        throw createTRPCError('CONFLICT', 'Этот slug уже занят. Выберите другой.')
      }
      throw error
    }

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

    // Создаем все разделы по умолчанию для нового путешествия
    const defaultSections = [
      { type: TripSectionType.BOOKINGS, title: 'Бронирования', icon: 'mdi:book-multiple-outline' },
      { type: TripSectionType.CHECKLIST, title: 'Чек-листы', icon: 'mdi:format-list-checks' },
      { type: TripSectionType.FINANCES, title: 'Финансы', icon: 'mdi:cash-multiple' },
      { type: TripSectionType.MEMORIES, title: 'Галерея воспоминаний', icon: 'mdi:image-filter-hdr' },
      { type: TripSectionType.NOTES, title: 'Заметки', icon: 'mdi:note-edit-outline' },
      { type: TripSectionType.DOCUMENTS, title: 'Документы', icon: 'mdi:file-document-outline' },
    ]

    for (const sec of defaultSections) {
      try {
        await tripSectionRepository.create({
          tripId: newTrip.id,
          type: sec.type,
          title: sec.title,
          icon: sec.icon,
          content: null,
        })
      }
      catch (error) {
        console.error(`Failed to create default section ${sec.type} for trip ${newTrip.id}:`, error)
      }
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
    const existingTrip = await accessControlService.getTripAndVerifyAccess(id, userId, userRole)

    if (details.cityIds !== undefined) {
      const selectedPlaces = await geoRepository.getByIds({ ids: details.cityIds, locale: 'ru' })
      const selectableIds = await geoRepository.getSelectableIds(details.cityIds)
      const existingPlaceIds = new Set(existingTrip.cityRefs?.map(place => place.id) ?? [])
      const selectableIdSet = new Set(selectableIds)
      const invalidPlaces = selectedPlaces.length !== details.cityIds.length
        || details.cityIds.some(placeId => !selectableIdSet.has(placeId) && !existingPlaceIds.has(placeId))

      if (invalidPlaces) {
        throw createTRPCError('BAD_REQUEST', 'Выберите города из загруженного справочника.')
      }
    }

    if (details.shareSlug && !await tripRepository.isShareSlugAvailable(details.shareSlug, id)) {
      throw createTRPCError('CONFLICT', 'Этот slug уже занят. Выберите другой.')
    }

    let updatedTrip
    try {
      updatedTrip = await tripRepository.update(id, details)
    }
    catch (error) {
      if (isUniqueConstraintViolation(error) && details.shareSlug) {
        throw createTRPCError('CONFLICT', 'Этот slug уже занят. Выберите другой.')
      }
      throw error
    }
    if (!updatedTrip) {
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${id} не найдено.`)
    }

    if (updatedTrip.weatherByPlaceId) {
      updatedTrip.weatherByPlaceId = weatherGenerationService.sanitizeTripWeatherPayload(
        updatedTrip.weatherByPlaceId,
        updatedTrip.startDate,
      )
    }

    return updatedTrip
  },

  async generateWeather(
    tripId: string,
    placeId: string | undefined,
    placeIds: string[] | undefined,
    forceRefresh: boolean,
    userId: string,
    userRole: string,
  ) {
    await accessControlService.getTripAndVerifyAccess(tripId, userId, userRole)
    const tripData = await tripRepository.getById(tripId)
    if (!tripData) {
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${tripId} не найдено.`)
    }

    const startDate = tripData.startDate ? new Date(tripData.startDate) : new Date()
    const month = startDate.getMonth() + 1 // 1-12
    const currentWeatherByPlaceId = (tripData.weatherByPlaceId || {}) as TripWeatherData
    const updatedWeatherByPlaceId: TripWeatherData = { ...currentWeatherByPlaceId }
    let hasGeneratedAny = false

    if (placeId || placeIds?.length || tripData.cityRefs?.length) {
      const allPlaces = tripData.cityRefs ?? []
      const requestedIds = placeId ? [placeId] : placeIds?.length ? placeIds : allPlaces.map(place => place.id)
      const placesById = new Map(allPlaces.map(place => [place.id, place]))
      const requestedPlaces = requestedIds.map(id => placesById.get(id))
      if (requestedPlaces.some(place => !place)) {
        throw createTRPCError('BAD_REQUEST', 'Погоду можно запросить только для города, выбранного в этом путешествии.')
      }

      for (const place of requestedPlaces) {
        if (!place)
          continue
        const { data, fromCache } = await weatherGenerationService.generateOrGetPlaceWeather(place, month, userId, forceRefresh)
        updatedWeatherByPlaceId[place.id] = data
        if (!fromCache)
          hasGeneratedAny = true
      }
    }
    else {
      throw createTRPCError('BAD_REQUEST', 'В путешествии не указаны города из справочника для генерации сводки погоды.')
    }

    await tripRepository.updateWeatherPayload(tripId, {
      weatherByPlaceId: updatedWeatherByPlaceId,
    })

    return {
      weatherByPlaceId: updatedWeatherByPlaceId,
      fromCache: !hasGeneratedAny,
    }
  },

  async addParticipant(tripId: string, participantId: string, currentUserId: string, userRole: string) {
    await accessControlService.getTripAndVerifyAccess(tripId, currentUserId, userRole)
    const userToAdd = await userRepository.getById(participantId)
    if (!userToAdd) {
      throw createTRPCError('NOT_FOUND', `Пользователь не найден.`)
    }
    await tripRepository.addParticipant(tripId, userToAdd.id)
  },

  async delete(id: string, userId: string, userRole: string) {
    const tripToDelete = await accessControlService.getTripAndVerifyAccess(id, userId, userRole)
    const tripWithDays = await tripRepository.getByIdWithDays(id)
    const tripWithImages = await tripRepository.getByIdWithImages(id)

    // 1. Очистка файлов из S3 (папка trips/{id} и возможные дополнительные файлы/обложка)
    try {
      await deleteTripFiles(
        id,
        tripWithImages?.images || [],
        tripToDelete.imageUrl,
      )
    }
    catch (storageError) {
      console.error(`Ошибка при удалении файлов путешествия ${id} из S3:`, storageError)
    }

    // 2. Очистка полиморфных комментариев (к путешествию и его дням)
    try {
      const parentIds = [id, ...(tripWithDays?.days?.map(d => d.id) || [])]
      await commentRepository.deleteByParentIds(parentIds)
    }
    catch (commentError) {
      console.error(`Ошибка при удалении комментариев путешествия ${id}:`, commentError)
    }

    // 3. Удаление путешествия из БД (каскадно удаляет связанные секции, заметки, дни, активности, воспоминания и изображения)
    const deletedTrip = await tripRepository.delete(id)
    if (!deletedTrip) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', `Не удалось удалить путешествие с ID ${id}.`)
    }

    // 4. Пересчет квот пользователя
    await quotaService.decrementTripCount(tripToDelete.userId)
    const totalImageSize = tripWithImages?.images.reduce((sum, image) => sum + (image.sizeBytes || 0), 0) ?? 0
    if (totalImageSize > 0) {
      await quotaService.decrementStorageUsage(tripToDelete.userId, totalImageSize)
    }
    return deletedTrip
  },

  async listByUser(userId: string, limit: number) {
    const trips = await tripRepository.listByUser(userId, limit)
    return trips as NonNullable<typeof trips[number]>[]
  },
}
