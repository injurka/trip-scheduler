import type { z } from 'zod'
import type { CreateDayInputSchema, UpdateDayInputSchema } from './day.schemas'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/db'
import { measureDbQuery } from '~/lib/db-monitoring'
import { cleanId } from '~/lib/helpers'
import { mapDay } from './day.helpers'

export const dayRepository = {
  /**
   * Получает все дни для конкретного путешествия.
   */
  async getByTripId(tripId: string) {
    return measureDbQuery('days', 'select', async () => {
      const cleanTripId = cleanId(tripId)

      const [results] = await db.query<[any[]]>(`
        SELECT 
          *,
          id,
          (
            SELECT * FROM activities 
            WHERE dayId = $parent.id 
            ORDER BY startTime ASC
          ) as activities
        FROM days
        WHERE tripId = type::thing('trips', $tripId)
        ORDER BY date ASC
      `, { tripId: cleanTripId })

      return (results || []).map(mapDay)
    })
  },

  /**
   * Получает заметку дня.
   */
  async getNote(dayId: string) {
    return measureDbQuery('days', 'select', async () => {
      const cleanDayId = cleanId(dayId)

      const [results] = await db.query<[any[]]>(`
        SELECT note FROM type::thing('days', $dayId)
      `, { dayId: cleanDayId })

      return results?.[0]?.note ?? null
    })
  },

  /**
   * Находит день по ID и возвращает его вместе с ID владельца путешествия.
   * Нужно для проверки прав доступа.
   */
  async findByIdWithOwner(id: string) {
    return measureDbQuery('days', 'select', async () => {
      const cleanDayId = cleanId(id)

      // Используем dot-notation для доступа к связанной записи tripId (Record Link)
      const [results] = await db.query<[any[]]>(`
        SELECT 
          *,
          tripId.userId as ownerId
        FROM type::thing('days', $id)
      `, { id: cleanDayId })

      const day = results?.[0]
      if (!day)
        return null

      const mappedDay = mapDay(day)

      // Возвращаем структуру, совместимую с сервисом (trip: { userId: ... })
      return {
        ...mappedDay,
        trip: {
          userId: cleanId(day.ownerId.toString()),
        },
      }
    })
  },

  /**
   * Создает новый день для путешествия.
   */
  async create(dayData: z.infer<typeof CreateDayInputSchema>) {
    return measureDbQuery('days', 'insert', async () => {
      const { date, tripId, ...rest } = dayData
      const cleanTripId = cleanId(tripId)
      const newDayId = uuidv4()

      const newDate = date instanceof Date ? date.toISOString().split('T')[0] : date

      const [results] = await db.query<[any[]]>(`
        CREATE days CONTENT {
          id: type::thing('days', $id),
          tripId: type::thing('trips', $tripId),
          date: $date,
          title: $title,
          description: $description,
          meta: [],
          createdAt: time::now(),
          updatedAt: time::now()
        }
      `, {
        id: newDayId,
        tripId: cleanTripId,
        date: newDate,
        title: rest.title,
        description: rest.description || null,
      })

      const createdDay = results?.[0]
      return createdDay ? { ...mapDay(createdDay), activities: [] } : null
    })
  },

  /**
   * Обновляет детали дня.
   */
  async update(id: string, details: z.infer<typeof UpdateDayInputSchema>['details']) {
    return measureDbQuery('days', 'update', async () => {
      const cleanDayId = cleanId(id)
      const { date, ...rest } = details

      const updateData: Record<string, any> = {
        updatedAt: new Date(),
        ...rest,
      }

      if (date) {
        updateData.date = date instanceof Date ? date.toISOString().split('T')[0] : date
      }

      const [results] = await db.query<[any[]]>(`
        UPDATE type::thing('days', $id) MERGE $data RETURN AFTER
      `, {
        id: cleanDayId,
        data: updateData,
      })

      return mapDay(results?.[0])
    })
  },

  /**
   * Удаляет день по его ID.
   */
  async delete(id: string) {
    return measureDbQuery('days', 'delete', async () => {
      const cleanDayId = cleanId(id)

      // Сначала удаляем активности, связанные с днем (если нет каскадного удаления)
      // Затем удаляем сам день
      const [results] = await db.query<[any[]]>(`
        BEGIN TRANSACTION;
        DELETE FROM activities WHERE dayId = type::thing('days', $id);
        DELETE type::thing('days', $id) RETURN BEFORE;
        COMMIT TRANSACTION;
      `, { id: cleanDayId })

      // Ищем результат DELETE days
      // В транзакции результаты приходят массивом массивов.
      // Нам нужен тот, который вернул удаленный объект.
      const deletedDay = results.flat().find((r: any) => r && r.id && r.id.toString().includes('days:'))

      return mapDay(deletedDay)
    })
  },
}
