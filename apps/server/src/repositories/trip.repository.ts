import type { z } from 'zod'
import type { CreateTripInputSchema, ListTripsInputSchema, UpdateTripInputSchema } from '~/modules/trip/trip.schemas'
import { and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { measureDbQuery } from '~/lib/db-monitoring'
import { db } from '../../db'
import { activities, days, tripParticipants, trips, tripSections } from '../../db/schema'

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

export const tripRepository = {
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
      if (filters?.userIds && filters.userIds.length > 0) {
        const subquery = db
          .selectDistinct({ tripId: tripParticipants.tripId })
          .from(tripParticipants)
          .where(inArray(tripParticipants.userId, filters.userIds))
        conditions.push(inArray(trips.id, subquery))
      }

      const result = await db.query.trips.findMany({
        where: and(...conditions),
        orderBy: (trips, { desc }) => [desc(trips.createdAt)],
        with: withParticipants,
      })

      return result.map(mapTripParticipants)
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
      const tagExpression = sql<string>`jsonb_array_elements_text(${trips.tags})`

      const baseQuery = db
        .selectDistinct({ tag: tagExpression })
        .from(trips)
        .orderBy(tagExpression)
        .limit(20)

      if (query) {
        baseQuery.where(ilike(tagExpression, `%${query}%`))
      }

      const result = await baseQuery
      return result.map(row => row.tag).filter(Boolean)
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

      return mapTripParticipants(result)
    })
  },

  /**
   * Получает путешествие со всеми прикрепленными изображениями (для подсчета квот).
   */
  async getByIdWithImages(id: string) {
    return measureDbQuery('trips', 'select', async () => {
      return await db.query.trips.findFirst({
        where: eq(trips.id, id),
        with: {
          images: {
            columns: {
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

      return mapTripParticipants(result)
    })
  },

  /**
   * Обновляет детали путешествия.
   * @returns Обновленный объект путешествия или null.
   */
  async update(id: string, details: z.infer<typeof UpdateTripInputSchema>['details']) {
    return measureDbQuery('trips', 'update', async () => {
      const { startDate, endDate, participantIds, ...restDetails } = details

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

      return mapTripParticipants(updatedTrip)
    })
  },

  /**
   * Создает новое путешествие.
   * @returns Созданный объект путешествия.
   */
  async create(data: z.infer<typeof CreateTripInputSchema>, userId: string) {
    return measureDbQuery('trips', 'insert', async () => {
      const { startDate, endDate, ...restData } = data

      const newStartDate = (startDate ? new Date(startDate) : new Date()).toISOString().split('T')[0]
      const newEndDate = (endDate ? new Date(endDate) : new Date(newStartDate)).toISOString().split('T')[0]

      const newTrip = await db.transaction(async (tx) => {
        const [createdTrip] = await tx
          .insert(trips)
          .values({
            id: uuidv4(),
            ...restData,
            userId,
            startDate: newStartDate,
            endDate: newEndDate,
          })
          .returning()

        await tx.insert(tripParticipants).values({
          tripId: createdTrip.id,
          userId,
        })

        return createdTrip
      })

      const result = await db.query.trips.findFirst({
        where: eq(trips.id, newTrip.id),
        with: withFullTripData,
      })

      return mapTripParticipants(result)
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
        where: inArray(trips.id, userTripsSubquery),
        orderBy: (trips, { desc }) => [desc(trips.createdAt)],
        limit,
        with: withParticipants,
      })
      return result.map(mapTripParticipants)
    })
  },
}
