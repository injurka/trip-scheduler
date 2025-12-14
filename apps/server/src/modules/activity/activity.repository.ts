import type { z } from 'zod'
import type { CreateActivityInputSchema, UpdateActivityInputSchema } from './activity.schemas'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/db'
import { measureDbQuery } from '~/lib/db-monitoring'
import { mapActivity } from './activity.helpers'

// Локальный хелпер, если import { cleanId } from '~/lib/helpers' недоступен,
// иначе раскомментируйте импорт выше.
const cleanId = (id: string) => id.includes(':') ? id.split(':')[1] : id

export const activityRepository = {
  /**
   * Создает новую активность.
   */
  async create(data: z.infer<typeof CreateActivityInputSchema>) {
    return measureDbQuery('activities', 'insert', async () => {
      const id = uuidv4()
      // SurrealDB автоматически обработает JSON-массив для sections
      const query = `
        CREATE activities CONTENT {
          id: type::thing('activities', $id),
          dayId: type::thing('days', $dayId),
          title: $title,
          startTime: $startTime,
          endTime: $endTime,
          tag: $tag,
          sections: $sections
        }
      `

      const [result] = await db.query<[any[]]>(query, {
        id,
        dayId: cleanId(data.dayId), // Гарантируем чистый UUID
        title: data.title,
        startTime: data.startTime,
        endTime: data.endTime,
        tag: data.tag ?? null,
        sections: data.sections ?? [],
      })

      return mapActivity(result?.[0])
    })
  },

  /**
   * Обновляет существующую активность.
   */
  async update(data: z.infer<typeof UpdateActivityInputSchema>) {
    return measureDbQuery('activities', 'update', async () => {
      const { id, ...updateData } = data

      // Используем MERGE для частичного обновления
      const [result] = await db.query<[any[]]>(`
        UPDATE type::thing('activities', $id) MERGE $data RETURN AFTER
      `, {
        id: cleanId(id),
        data: updateData,
      })

      return mapActivity(result?.[0])
    })
  },

  /**
   * Удаляет активность по ее ID.
   */
  async delete(id: string) {
    return measureDbQuery('activities', 'delete', async () => {
      const [result] = await db.query<[any[]]>(`
        DELETE type::thing('activities', $id) RETURN BEFORE
      `, { id: cleanId(id) })

      return mapActivity(result?.[0])
    })
  },

  /**
   * Находит активность по ID и возвращает ее вместе с вложенными данными (day -> trip -> user)
   * для проверки прав доступа.
   */
  async findByIdWithOwner(id: string) {
    return measureDbQuery('activities', 'select', async () => {
      // FETCH позволяет "подтянуть" данные по ссылкам (Record Links)
      // dayId - ссылка на таблицу days
      // dayId.tripId - ссылка внутри дня на таблицу trips
      const query = `
        SELECT 
          *,
          dayId
        FROM type::thing('activities', $id)
        FETCH dayId, dayId.tripId
      `

      const [result] = await db.query<[any[]]>(query, { id: cleanId(id) })
      const activity = result?.[0]

      if (!activity)
        return null

      // activity.dayId теперь не просто ID, а полный объект дня (из-за FETCH)
      // activity.dayId.tripId теперь полный объект путешествия

      const mapped = mapActivity(activity)

      // Конструируем объект, который ожидает сервис.
      // Важно проверить существование вложенных полей, чтобы не упасть, если база неконсистентна.
      const dayObj = activity.dayId
      const tripObj = dayObj?.tripId

      return {
        ...mapped,
        day: {
          id: dayObj ? cleanId(dayObj.id.toString()) : '',
          trip: {
            id: tripObj ? cleanId(tripObj.id.toString()) : '',
            userId: tripObj ? cleanId(tripObj.userId.toString()) : '',
          },
        },
      }
    })
  },
}
