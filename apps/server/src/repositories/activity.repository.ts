import type { z } from 'zod'
import type { CreateActivityInputSchema, UpdateActivityInputSchema } from '~/modules/activity/activity.schemas'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../../db'
import { activities } from '../../db/schema'

type ActivityInsert = typeof activities.$inferInsert

export const activityRepository = {
  /**
   * Создает новую активность.
   * @param data - Данные для создания активности.
   * @returns Созданный объект активности.
   */
  async create(data: z.infer<typeof CreateActivityInputSchema>) {
    const [newActivity] = await db
      .insert(activities)
      .values({
        ...data,
        tag: data.tag ?? null,
        status: data.status ?? 'none',
        rating: data.rating ?? null,
        id: uuidv4(),
        sections: data.sections ?? [],
      } as ActivityInsert)
      .returning()

    return newActivity
  },

  /**
   * Обновляет существующую активность.
   * @param data - Полный объект активности с ID.
   * @returns Обновленный объект активности или null, если не найден.
   */
  async update(data: z.infer<typeof UpdateActivityInputSchema>) {
    const { id, ...updateData } = data
    const [updatedActivity] = await db
      .update(activities)
      .set({ ...updateData, sections: updateData.sections ?? [] } as ActivityInsert)
      .where(eq(activities.id, id))
      .returning()

    return updatedActivity || null
  },

  /**
   * Удаляет активность по ее ID.
   * @param id - ID активности для удаления.
   * @returns Объект удаленной активности или null, если не найден.
   */
  async delete(id: string) {
    const [deletedActivity] = await db
      .delete(activities)
      .where(eq(activities.id, id))
      .returning()

    return deletedActivity || null
  },

  /**
   * Находит активность по ID и возвращает ее вместе с ID владельца путешествия.
   */
  async findByIdWithOwner(id: string) {
    return await db.query.activities.findFirst({
      where: eq(activities.id, id),
      with: {
        day: {
          with: {
            trip: {
              columns: {
                userId: true,
              },
            },
          },
        },
      },
    })
  },
}
