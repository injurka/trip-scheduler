import type { z } from 'zod'
import type { CreateTripSectionInputSchema, UpdateTripSectionInputSchema } from './trip-section.schemas'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/db'
import { measureDbQuery } from '~/lib/db-monitoring'

const cleanId = (id: string) => id.includes(':') ? id.split(':')[1] : id

function mapTripSection(section: any) {
  if (!section)
    return null
  return {
    ...section,
    id: cleanId(section.id.toString()),
    tripId: cleanId(section.tripId.toString()),
    content: typeof section.content === 'string' ? JSON.parse(section.content) : section.content,
    createdAt: new Date(section.createdAt),
    updatedAt: new Date(section.updatedAt),
  }
}

export const tripSectionRepository = {
  /**
   * Создать раздел. Автоматически вычисляет порядок сортировки.
   */
  async create(data: z.infer<typeof CreateTripSectionInputSchema>) {
    return measureDbQuery('trip_sections', 'insert', async () => {
      const id = uuidv4()

      // Логика:
      // 1. Найти макс order для этого трипа
      // 2. Создать новый раздел с order + 1
      const query = `
        BEGIN TRANSACTION;
        
        LET $existing = (SELECT order FROM trip_sections WHERE tripId = type::thing('trips', $tripId));
        LET $maxOrder = math::max($existing.order);
        LET $nextOrder = ($maxOrder ?? -1) + 1;

        CREATE trip_sections CONTENT {
          id: type::thing('trip_sections', $id),
          tripId: type::thing('trips', $tripId),
          type: $type,
          title: $title,
          icon: $icon,
          content: $content,
          order: $nextOrder,
          createdAt: time::now(),
          updatedAt: time::now()
        };

        COMMIT TRANSACTION;
      `

      const [results] = await db.query<[any[]]>(query, {
        id,
        tripId: data.tripId,
        type: data.type,
        title: data.title,
        icon: data.icon || null,
        content: data.content || {},
      })

      // Результат CREATE - это обычно последний элемент массива результатов транзакции
      // или массив, возвращенный операцией CREATE
      // В данном случае results - массив результатов шагов транзакции.
      // CREATE вернет массив с одним объектом.
      // Ищем результат, у которого есть id и он совпадает
      const createdSection = results.flat().find((r: any) => r && r.id && r.id.toString().includes(id))

      return mapTripSection(createdSection)
    })
  },

  /**
   * Найти раздел и подтянуть владельца трипа
   */
  async findByIdWithOwner(id: string) {
    return measureDbQuery('trip_sections', 'select', async () => {
      // FETCH tripId загружает объект трипа вместо просто ID
      const [result] = await db.query<[any[]]>(`
        SELECT *, tripId FROM type::thing('trip_sections', $id) FETCH tripId
      `, { id })

      const section = result?.[0]
      if (!section)
        return null

      return {
        ...mapTripSection(section),
        trip: {
          userId: cleanId(section.tripId.userId.toString()),
        },
      }
    })
  },

  /**
   * Обновить раздел
   */
  async update(id: string, data: Partial<z.infer<typeof UpdateTripSectionInputSchema>>) {
    return measureDbQuery('trip_sections', 'update', async () => {
      const updateData: Record<string, any> = {
        updatedAt: new Date(),
        ...data,
      }
      delete updateData.id // ID не обновляем

      const [result] = await db.query<[any[]]>(`
        UPDATE type::thing('trip_sections', $id) MERGE $data RETURN AFTER
      `, { id, data: updateData })

      return mapTripSection(result?.[0])
    })
  },

  /**
   * Удалить раздел
   */
  async delete(id: string) {
    return measureDbQuery('trip_sections', 'delete', async () => {
      const [result] = await db.query<[any[]]>(`
        DELETE type::thing('trip_sections', $id) RETURN BEFORE
      `, { id })

      return mapTripSection(result?.[0])
    })
  },

  /**
   * Изменить порядок разделов
   */
  async reorder(tripId: string, updates: { id: string, order: number }[]) {
    return measureDbQuery('trip_sections', 'update', async () => {
      // Генерируем пакетный запрос
      let query = 'BEGIN TRANSACTION;'

      updates.forEach((_, index) => {
        // Важно: проверяем, что секция принадлежит этому трипу, чтобы не перенести секцию в другой трип
        // через подмену ID (хотя проверка прав в сервисе это отсекает, но для надежности)
        query += `
          UPDATE type::thing('trip_sections', $id_${index}) 
          SET order = $order_${index}
          WHERE tripId = type::thing('trips', $tripId);
        `
      })

      query += 'COMMIT TRANSACTION;'

      const params: Record<string, any> = { tripId }
      updates.forEach((u, i) => {
        params[`id_${i}`] = u.id
        params[`order_${i}`] = u.order
      })

      await db.query(query, params)
    })
  },
}
