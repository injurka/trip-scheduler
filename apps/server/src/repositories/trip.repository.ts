import type { z } from 'zod'
import type { GeoPlaceRef, TripCityRef, UnresolvedTripCity } from '~/modules/geo/geo.schemas'
import type { CreateTripInputSchema, ListTripsInputSchema, UpdateTripInputSchema } from '~/modules/trip/trip.schemas'
import { randomBytes } from 'node:crypto'
import { and, asc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { measureDbQuery } from '~/lib/db-monitoring'
import { geoRepository } from '~/repositories/geo.repository'
import { db } from '../../db'
import { activities, days, tripGeoPlaces, tripParticipants, trips, tripSections } from '../../db/schema'

const RU_TO_EN_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

function createTripShareSlug(title: string): string {
  const titleSlug = title
    .toLowerCase()
    .split('')
    .map(char => RU_TO_EN_MAP[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
  const randomToken = randomBytes(9).toString('hex')

  return `${titleSlug || 'trip'}-${randomToken}`
}

const withParticipants = {
  participants: {
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  },
}

const withFullTripData = {
  ...withParticipants,
  sections: {
    orderBy: asc(tripSections.order),
  },
}

function mapTripParticipants<T extends { participants: Array<{ user: any }> }>(trip: T | null | undefined) {
  if (!trip)
    return null

  return {
    ...trip,
    participants: trip.participants.map(p => p.user),
  }
}

async function hydrateTripCities<T extends { id: string, cities: string[] }>(items: T[]) {
  if (!items.length)
    return items.map(trip => ({ ...trip, cityRefs: [] as TripCityRef[], unresolvedCities: [] as UnresolvedTripCity[] }))

  const tripIds = items.map(trip => trip.id)
  const links = await db.select({
    tripId: tripGeoPlaces.tripId,
    position: tripGeoPlaces.position,
    placeId: tripGeoPlaces.placeId,
    legacyLabel: tripGeoPlaces.legacyLabel,
    status: tripGeoPlaces.status,
  })
    .from(tripGeoPlaces)
    .where(inArray(tripGeoPlaces.tripId, tripIds))
    .orderBy(asc(tripGeoPlaces.tripId), asc(tripGeoPlaces.position))

  const placeIds = [...new Set(links.flatMap(link => link.placeId ? [link.placeId] : []))]
  const places = await geoRepository.getByIds({ ids: placeIds, locale: 'ru' })
  const placesById = new Map<string, Omit<GeoPlaceRef, 'id'> & { id: string }>(places.map(place => [place.id, place]))
  const linksByTripId = new Map<string, typeof links>()
  for (const link of links) {
    const tripLinks = linksByTripId.get(link.tripId) ?? []
    tripLinks.push(link)
    linksByTripId.set(link.tripId, tripLinks)
  }

  return items.map((trip) => {
    const tripLinks = linksByTripId.get(trip.id) ?? []
    if (!tripLinks.length) {
      const unresolvedCities = trip.cities.flatMap((label, position) => label.trim()
        ? [{ position, label, status: 'unresolved' as const }]
        : [])
      return { ...trip, cityRefs: [] as TripCityRef[], unresolvedCities }
    }

    const cityRefs: TripCityRef[] = []
    const unresolvedCities: UnresolvedTripCity[] = []
    const cities: string[] = []

    for (const link of tripLinks) {
      const place = link.placeId ? placesById.get(link.placeId) : undefined
      if (link.status === 'resolved' && place) {
        cityRefs.push({ ...place, position: link.position })
        cities.push(place.name)
        continue
      }

      const label = link.legacyLabel?.trim() || trip.cities[link.position]?.trim()
      if (!label)
        continue

      const status = link.status === 'needs_review' ? 'needs_review' : 'unresolved'
      unresolvedCities.push({ position: link.position, label, status })
      cities.push(label)
    }

    return { ...trip, cities, cityRefs, unresolvedCities }
  })
}

export const tripRepository = {
  /**
   * Проверяет, имеет ли пользователь полный доступ к путешествию
   * (является ли он создателем или добавленным участником).
   */
  async hasAccess(tripId: string, userId: string): Promise<boolean> {
    return measureDbQuery('trips', 'select', async () => {
      // 1. Проверяем, является ли пользователь создателем
      const trip = await db.query.trips.findFirst({
        where: eq(trips.id, tripId),
        columns: { userId: true }, // Берем только userId для экономии памяти
      })

      if (trip?.userId === userId) {
        return true
      }

      // 2. Если не создатель, проверяем, есть ли он в таблице участников
      const participant = await db.query.tripParticipants.findFirst({
        where: and(
          eq(tripParticipants.tripId, tripId),
          eq(tripParticipants.userId, userId),
        ),
        columns: { userId: true },
      })

      return !!participant
    })
  },

  /**
   * Получает все путешествия с применением фильтров.
   */
  async getAll(filters?: z.infer<typeof ListTripsInputSchema>, userId?: string) {
    return measureDbQuery('trips', 'select', async () => {
      const conditions = []

      if (filters?.tab === 'public') {
        conditions.push(eq(trips.visibility, 'public'))
      }
      else if (filters?.tab === 'my' && userId) {
        const userTripsSubquery = db
          .select({ tripId: tripParticipants.tripId })
          .from(tripParticipants)
          .where(eq(tripParticipants.userId, userId))
        conditions.push(inArray(trips.id, userTripsSubquery))
      }

      if (filters?.search) {
        const searchPattern = `%${filters.search}%`
        conditions.push(or(
          ilike(trips.title, searchPattern),
          ilike(trips.description, searchPattern),
        ))
      }
      if (filters?.statuses && filters.statuses.length > 0) {
        conditions.push(inArray(trips.status, filters.statuses))
      }
      if (filters?.tags && filters.tags.length > 0) {
        const tagsArray = `{${filters.tags.join(',')}}`
        conditions.push(sql`${trips.tags} ?| ${tagsArray}`)
      }
      if (filters?.cities && filters.cities.length > 0) {
        const citiesArray = `{${filters.cities.join(',')}}`
        conditions.push(sql`${trips.cities} ?| ${citiesArray}`)
      }
      if (filters?.cityIds && filters.cityIds.length > 0) {
        const tripsWithSelectedCities = db
          .selectDistinct({ tripId: tripGeoPlaces.tripId })
          .from(tripGeoPlaces)
          .where(inArray(tripGeoPlaces.placeId, filters.cityIds))
        conditions.push(inArray(trips.id, tripsWithSelectedCities))
      }
      if (filters?.userIds && filters.userIds.length > 0) {
        const subquery = db
          .selectDistinct({ tripId: tripParticipants.tripId })
          .from(tripParticipants)
          .where(inArray(tripParticipants.userId, filters.userIds))
        conditions.push(inArray(trips.id, subquery))
      }

      const result = await db.query.trips.findMany({
        where: and(...conditions),
        orderBy: (trips, { desc }) => [desc(trips.startDate), desc(trips.createdAt)],
        with: withParticipants,
      })

      const mapped = result.map(mapTripParticipants).filter((trip): trip is NonNullable<typeof trip> => !!trip)
      return await hydrateTripCities(mapped)
    })
  },

  /**
   * Получает список уникальных городов из всех путешествий.
   */
  async getUniqueCities() {
    return measureDbQuery('trips', 'select', async () => {
      const cityExpression = sql<string>`jsonb_array_elements_text(${trips.cities})`

      const result = await db
        .selectDistinct({ city: cityExpression })
        .from(trips)
        .orderBy(cityExpression)

      return result.map(row => row.city).filter(Boolean)
    })
  },

  /**
   * Получает список уникальных тегов, опционально фильтруя по поисковому запросу.
   */
  async getUniqueTags(query?: string) {
    return measureDbQuery('trips', 'select', async () => {
      const searchParam = query ? `%${query}%` : '%'
      const result = await db.execute(sql`
        SELECT DISTINCT tag
        FROM ${trips}, jsonb_array_elements_text(${trips.tags}) AS tag
        WHERE tag ILIKE ${searchParam}
        ORDER BY tag
        LIMIT 20
      `)
      return result.rows.map(row => row.tag as string).filter(Boolean)
    })
  },

  /**
   * Получает путешествие по ID.
   */
  async getById(id: string) {
    return measureDbQuery('trips', 'select', async () => {
      const result = await db.query.trips.findFirst({
        where: eq(trips.id, id),
        with: withFullTripData,
      })

      const mapped = mapTripParticipants(result)
      if (!mapped)
        return null
      const [hydrated] = await hydrateTripCities([mapped])
      return hydrated
    })
  },

  /**
   * Получает путешествие со всеми прикрепленными изображениями (для подсчета квот и удаления файлов).
   */
  async getByIdWithImages(id: string) {
    return measureDbQuery('trips', 'select', async () => {
      return await db.query.trips.findFirst({
        where: eq(trips.id, id),
        with: {
          images: {
            columns: {
              url: true,
              variants: true,
              sizeBytes: true,
            },
          },
        },
      })
    })
  },

  /**
   * Получает путешествие со всеми днями и активностями.
   */
  async getByIdWithDays(id: string) {
    return measureDbQuery('trips', 'select', async () => {
      const result = await db.query.trips.findFirst({
        where: eq(trips.id, id),
        with: {
          ...withFullTripData,
          days: {
            orderBy: days.date,
            with: {
              activities: {
                orderBy: activities.startTime,
              },
            },
          },
        },
      })

      const mapped = mapTripParticipants(result)
      if (!mapped)
        return null
      const [hydrated] = await hydrateTripCities([mapped])
      return hydrated
    })
  },

  async getByShareSlug(shareSlug: string) {
    return measureDbQuery('trips', 'select', async () => {
      const result = await db.query.trips.findFirst({
        where: eq(trips.shareSlug, shareSlug),
        with: {
          ...withFullTripData,
          days: {
            orderBy: days.date,
            with: {
              activities: {
                orderBy: activities.startTime,
              },
            },
          },
        },
      })

      const mapped = mapTripParticipants(result)
      if (!mapped)
        return null
      const [hydrated] = await hydrateTripCities([mapped])
      return hydrated
    })
  },

  async isShareSlugAvailable(shareSlug: string, exceptTripId?: string): Promise<boolean> {
    return measureDbQuery('trips', 'select', async () => {
      const where = exceptTripId
        ? and(eq(trips.shareSlug, shareSlug), ne(trips.id, exceptTripId))
        : eq(trips.shareSlug, shareSlug)
      const matchingTrip = await db.query.trips.findFirst({
        where,
        columns: { id: true },
      })

      return !matchingTrip
    })
  },

  async getOrCreateShareSlug(id: string, title: string): Promise<string | null> {
    return measureDbQuery('trips', 'update', async () => {
      const currentTrip = await db.query.trips.findFirst({
        where: eq(trips.id, id),
        columns: { shareSlug: true },
      })

      if (!currentTrip)
        return null

      if (currentTrip.shareSlug)
        return currentTrip.shareSlug

      const [updatedTrip] = await db
        .update(trips)
        .set({ shareSlug: createTripShareSlug(title) })
        .where(and(eq(trips.id, id), isNull(trips.shareSlug)))
        .returning({ shareSlug: trips.shareSlug })

      if (updatedTrip?.shareSlug)
        return updatedTrip.shareSlug

      // A concurrent share request may have filled this field first.
      const concurrentTrip = await db.query.trips.findFirst({
        where: eq(trips.id, id),
        columns: { shareSlug: true },
      })

      return concurrentTrip?.shareSlug ?? null
    })
  },

  /**
   * Обновляет детали путешествия.
   * @returns Обновленный объект путешествия или null.
   */
  async update(
    id: string,
    details: z.infer<typeof UpdateTripInputSchema>['details'],
    selectedPlaces?: GeoPlaceRef[],
  ) {
    return measureDbQuery('trips', 'update', async () => {
      const { startDate, endDate, participantIds, cityIds, ...restDetails } = details

      const updatePayload = {
        ...restDetails,
        updatedAt: new Date(),
        ...(startDate && {
          startDate: startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate,
        }),
        ...(endDate && {
          endDate: endDate instanceof Date ? endDate.toISOString().split('T')[0] : endDate,
        }),
      }

      const updatedTrip = await db.transaction(async (tx) => {
        if (Object.keys(restDetails).length > 0 || startDate || endDate) {
          await tx
            .update(trips)
            .set(updatePayload)
            .where(eq(trips.id, id))
        }

        if (cityIds !== undefined || details.cities !== undefined) {
          await tx.delete(tripGeoPlaces).where(eq(tripGeoPlaces.tripId, id))

          if (cityIds !== undefined && cityIds.length > 0) {
            await tx.insert(tripGeoPlaces).values(cityIds.map((placeId, position) => ({
              tripId: id,
              position,
              placeId,
              legacyLabel: null,
              status: 'resolved' as const,
            })))
            await tx.update(trips)
              .set({ cities: cityIds.map(placeId => selectedPlaces?.find(place => place.id === placeId)?.name ?? '') })
              .where(eq(trips.id, id))
          }
          else if (cityIds !== undefined) {
            await tx.update(trips).set({ cities: [] }).where(eq(trips.id, id))
          }
          else if (details.cities) {
            const legacyCities = details.cities.filter(city => city.trim().length > 0)
            if (legacyCities.length > 0) {
              await tx.insert(tripGeoPlaces).values(legacyCities.map((legacyLabel, position) => ({
                tripId: id,
                position,
                placeId: null,
                legacyLabel,
                status: 'unresolved' as const,
              })))
            }
          }
        }

        if (participantIds) {
          const currentParticipants = await tx.query.tripParticipants.findMany({
            where: eq(tripParticipants.tripId, id),
            columns: { userId: true },
          })
          const currentParticipantIds = currentParticipants.map(p => p.userId)

          const idsToAdd = participantIds.filter(pid => !currentParticipantIds.includes(pid))
          const idsToRemove = currentParticipantIds.filter(pid => !participantIds.includes(pid))

          if (idsToRemove.length > 0) {
            await tx
              .delete(tripParticipants)
              .where(and(
                eq(tripParticipants.tripId, id),
                inArray(tripParticipants.userId, idsToRemove),
              ))
          }

          if (idsToAdd.length > 0) {
            await tx
              .insert(tripParticipants)
              .values(idsToAdd.map(userId => ({ tripId: id, userId })))
          }
        }

        const result = await tx.query.trips.findFirst({
          where: eq(trips.id, id),
          with: withFullTripData,
        })

        return result
      })

      const mapped = mapTripParticipants(updatedTrip)
      if (!mapped)
        return null
      const [hydrated] = await hydrateTripCities([mapped])
      return hydrated
    })
  },

  async updateWeatherPayload(
    id: string,
    payload: {
      weatherData: Record<string, unknown>
      weatherByPlaceId: Record<string, unknown>
    },
  ) {
    return measureDbQuery('trips', 'update', async () => {
      await db.update(trips)
        .set({
          weatherData: payload.weatherData as any,
          weatherByPlaceId: payload.weatherByPlaceId as any,
          updatedAt: new Date(),
        })
        .where(eq(trips.id, id))
    })
  },

  /**
   * Добавляет участника в путешествие.
   */
  async addParticipant(tripId: string, userId: string) {
    return measureDbQuery('tripParticipants', 'insert', async () => {
      await db.insert(tripParticipants)
        .values({ tripId, userId })
        .onConflictDoNothing()
    })
  },

  /**
   * Создает новое путешествие.
   * @returns Созданный объект путешествия.
   */
  async create(data: z.infer<typeof CreateTripInputSchema>, userId: string, selectedPlaces: GeoPlaceRef[] = []) {
    return measureDbQuery('trips', 'insert', async () => {
      const { startDate, endDate, cityIds: _cityIds, ...restData } = data

      const newStartDate = (startDate ? new Date(startDate) : new Date()).toISOString().split('T')[0]
      const newEndDate = (endDate ? new Date(endDate) : new Date(newStartDate)).toISOString().split('T')[0]

      const newTrip = await db.transaction(async (tx) => {
        const [createdTrip] = await tx
          .insert(trips)
          .values({
            id: uuidv4(),
            ...restData,
            cities: selectedPlaces.map(place => place.name),
            userId,
            startDate: newStartDate,
            endDate: newEndDate,
          })
          .returning()

        await tx.insert(tripParticipants).values({
          tripId: createdTrip.id,
          userId,
        })

        if (selectedPlaces.length > 0) {
          await tx.insert(tripGeoPlaces).values(selectedPlaces.map((place, position) => ({
            tripId: createdTrip.id,
            position,
            placeId: place.id,
            legacyLabel: null,
            status: 'resolved' as const,
          })))
        }

        return createdTrip
      })

      const result = await db.query.trips.findFirst({
        where: eq(trips.id, newTrip.id),
        with: withFullTripData,
      })

      const mapped = mapTripParticipants(result)
      if (!mapped)
        return null
      const [hydrated] = await hydrateTripCities([mapped])
      return hydrated
    })
  },

  /**
   * Удаляет путешествие по ID.
   * @returns Удаленный объект или null.
   */
  async delete(id: string) {
    return measureDbQuery('trips', 'delete', async () => {
      const [deletedTrip] = await db.delete(trips).where(eq(trips.id, id)).returning()
      return deletedTrip || null
    })
  },

  /**
   * Получает последние N путешествий пользователя.
   */
  async listByUser(userId: string, limit: number) {
    return measureDbQuery('trips', 'select', async () => {
      const userTripsSubquery = db
        .select({ tripId: tripParticipants.tripId })
        .from(tripParticipants)
        .where(eq(tripParticipants.userId, userId))

      const result = await db.query.trips.findMany({
        where: and(
          inArray(trips.id, userTripsSubquery),
          eq(trips.visibility, 'public'),
        ),
        orderBy: (trips, { desc }) => [desc(trips.startDate), desc(trips.createdAt)],
        limit,
        with: withParticipants,
      })
      const mapped = result.map(mapTripParticipants).filter((trip): trip is NonNullable<typeof trip> => !!trip)
      return await hydrateTripCities(mapped)
    })
  },
}
