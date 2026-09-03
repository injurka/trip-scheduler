import type { z } from 'zod'
import type { TripWeatherData } from '../../../db/schema.type'
import type { CreateTripInputSchema, ListTripsInputSchema, TripWithDaysSchema, UpdateTripInputSchema } from './trip.schemas'
import { createTRPCError } from '~/lib/trpc'
import { commentRepository } from '~/repositories/comment.repository'
import { dayRepository } from '~/repositories/day.repository'
import { tripSectionRepository } from '~/repositories/trip-section.repository'
import { tripRepository } from '~/repositories/trip.repository'
import { userRepository } from '~/repositories/user.repository'
import { accessControlService } from '~/services/access-control.service'
import { deleteTripFiles } from '~/services/file-storage.service'
import { weatherGenerationService } from '~/services/llm/weather-generation.service'
import { quotaService } from '~/services/quota.service'
import { TripSectionType } from '../trip-section/trip-section.schemas'

export const tripService = {
  async getAll(filters?: z.infer<typeof ListTripsInputSchema>, userId?: string) {
    const trips = await tripRepository.getAll(filters, userId)
    return trips as NonNullable<typeof trips[number]>[]
  },

  async getUniqueCities() {
    return await tripRepository.getUniqueCities()
  },

  async getUniqueTags(query?: string) {
    return await tripRepository.getUniqueTags(query)
  },

  async getById(id: string) {
    const trip = await tripRepository.getById(id)
    if (!trip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${id} не найдено.`)

    return trip
  },

  async getByIdWithDays(id: string) {
    const trip = await tripRepository.getByIdWithDays(id)
    if (!trip)
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${id} не найдено.`)

    return trip as unknown as z.infer<typeof TripWithDaysSchema>
  },

  async create(data: z.infer<typeof CreateTripInputSchema>, userId: string) {
    await quotaService.checkTripCreationQuota(userId)

    const newTrip = await tripRepository.create(data, userId)

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

    // Если обновляются города или дата, но не передана погода, пробуем дополнить из кэша БД
    if (details.cities && details.cities.length > 0 && !details.weatherData) {
      try {
        const targetDate = details.startDate ? new Date(details.startDate) : new Date(existingTrip.startDate)
        const month = targetDate.getMonth() + 1
        const cachedBatch = await weatherGenerationService.getBatchWeatherFromCache(details.cities, month)
        if (Object.keys(cachedBatch).length > 0) {
          details.weatherData = {
            ...((existingTrip.weatherData as any) || {}),
            ...cachedBatch,
          }
        }
      }
      catch (error) {
        console.warn('Не удалось автоматически подгрузить погоду из кэша БД:', error)
      }
    }

    const updatedTrip = await tripRepository.update(id, details)
    if (!updatedTrip) {
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${id} не найдено.`)
    }
    return updatedTrip
  },

  async generateWeather(
    tripId: string,
    city: string | undefined,
    forceRefresh: boolean,
    userId: string,
    userRole: string,
  ) {
    await accessControlService.getTripAndVerifyAccess(tripId, userId, userRole)
    const tripData = await tripRepository.getById(tripId)
    if (!tripData) {
      throw createTRPCError('NOT_FOUND', `Путешествие с ID ${tripId} не найдено.`)
    }

    const citiesToProcess = city ? [city] : (tripData.cities || [])
    if (citiesToProcess.length === 0) {
      throw createTRPCError('BAD_REQUEST', 'В путешествии не указаны города для генерации сводки погоды.')
    }

    const startDate = tripData.startDate ? new Date(tripData.startDate) : new Date()
    const month = startDate.getMonth() + 1 // 1-12

    const currentWeatherData = (tripData.weatherData || {}) as TripWeatherData
    const updatedWeatherData: TripWeatherData = { ...currentWeatherData }
    let hasGeneratedAny = false

    for (const c of citiesToProcess) {
      const { data, fromCache } = await weatherGenerationService.generateOrGetCityWeather(
        c,
        month,
        userId,
        forceRefresh,
      )
      updatedWeatherData[c] = data
      if (!fromCache) {
        hasGeneratedAny = true
      }
    }

    await tripRepository.update(tripId, {
      weatherData: updatedWeatherData,
    })

    return {
      weatherData: updatedWeatherData,
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
