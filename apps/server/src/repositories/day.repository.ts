import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../../db'
import { activities, days } from '../../db/schema'

type Day = typeof days.$inferSelect
type DayInsert = typeof days.$inferInsert
type DayUpdateInput = Partial<Pick<Day, 'title' | 'description'>> & { date?: string | Date }

export const dayRepository = {
  /**
   * Получает все дни для конкретного путешествия.
   */
  async getByTripId(tripId: string) {
    return await db.query.days.findMany({
      where: eq(days.tripId, tripId),
      columns: {
        id: true,
        date: true,
        title: true,
        description: true,
        tripId: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: days.date,
      with: {
        activities: {
          orderBy: activities.startTime,
        },
      },
    })
  },

  async getNote(dayId: string) {
    const result = await db.query.days.findFirst({
      where: eq(days.id, dayId),
      columns: {
        note: true,
      },
    })
    return result?.note ?? null
  },

  /**
   * Находит день по ID и возвращает его вместе с ID владельца путешествия.
   */
  async findByIdWithOwner(id: string) {
    return await db.query.days.findFirst({
      where: eq(days.id, id),
      with: {
        trip: {
          columns: {
            userId: true,
          },
        },
      },
    })
  },

  /**
   * Обновляет детали дня (название, описание, дата).
   * @param id - ID дня для обновления.
   * @param details - Объект с данными для обновления.
   * @returns Обновленный объект дня или null.
   */
  async update(id: string, details: DayUpdateInput) {
    const { date, ...rest } = details
    const updatePayload = {
      ...rest,
      updatedAt: new Date(),
      ...(date && { date: date instanceof Date ? date.toISOString().split('T')[0] : date }),
    }

    const [updatedDay] = await db
      .update(days)
      .set(updatePayload)
      .where(eq(days.id, id))
      .returning()

    return updatedDay || null
  },

  /**
   * Удаляет день по его ID.
   * @param id - ID дня для удаления.
   * @returns Объект удаленного дня или null.
   */
  async delete(id: string) {
    const [deletedDay] = await db
      .delete(days)
      .where(eq(days.id, id))
      .returning()

    return deletedDay || null
  },

  /**
   * Создает новый день для путешествия.
   * @param dayData - Данные для создания дня.
   * @returns Созданный объект дня.
   */
  async create(dayData: Omit<DayInsert, 'id' | 'createdAt' | 'updatedAt' | 'date'> & { date: string | Date }) {
    const { date, ...rest } = dayData
    const newDate = date instanceof Date ? date.toISOString().split('T')[0] : date

    const [newDay] = await db
      .insert(days)
      .values({
        ...rest,
        date: newDate,
        id: uuidv4(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    return { ...newDay, activities: [] }
  },
}
