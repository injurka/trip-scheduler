import type { z } from 'zod'
import type { CreateMemoryInputSchema, UpdateMemoryInputSchema } from '~/modules/memory/memory.schemas'
import { db } from 'db'
import { memories, tripImages } from 'db/schema'
import { asc, eq } from 'drizzle-orm'

export const memoryRepository = {
  /**
   * Создает новое воспоминание (текст или фото).
   * Возвращает полный объект, включая связанные данные изображения.
   */
  async create(data: z.infer<typeof CreateMemoryInputSchema>) {
    const [newMemory] = await db
      .insert(memories)
      .values({
        tripId: data.tripId,
        timestamp: data.timestamp ? new Date(data.timestamp) : null,
        comment: data.comment,
        imageId: data.imageId,
        title: data.title,
        tag: data.tag,
        sourceActivityId: data.sourceActivityId,
      })
      .returning()

    const result = await db.query.memories.findFirst({
      where: eq(memories.id, newMemory.id),
      with: {
        image: true,
      },
    })

    return result
  },

  /**
   * Получает все воспоминания для путешествия, включая полные данные связанных изображений.
   */
  async getByTripId(tripId: string) {
    return await db.query.memories.findMany({
      where: eq(memories.tripId, tripId),
      with: {
        image: true,
      },
      orderBy: [asc(memories.timestamp), asc(memories.createdAt)],
    })
  },

  /**
   * Находит воспоминание по ID и возвращает его вместе с ID владельца путешествия.
   */
  async findByIdWithOwner(id: string) {
    return await db.query.memories.findFirst({
      where: eq(memories.id, id),
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
   * Обновляет воспоминание (комментарий или временную метку).
   * @returns Обновленный полный объект или null
   */
  async update(data: z.infer<typeof UpdateMemoryInputSchema>) {
    const { id, ...updateData } = data

    const payload: Record<string, any> = { ...updateData, updatedAt: new Date() }

    if (Object.prototype.hasOwnProperty.call(updateData, 'timestamp')) {
      payload.timestamp = updateData.timestamp ? new Date(updateData.timestamp) : null
    }

    const [updatedMemory] = await db
      .update(memories)
      .set(payload)
      .where(eq(memories.id, id))
      .returning()

    if (!updatedMemory)
      return null

    return await db.query.memories.findFirst({
      where: eq(memories.id, updatedMemory.id),
      with: {
        image: true,
      },
    })
  },

  /**
   * Удаляет воспоминание по ID.
   * @returns Полный удаленный объект или null
   */
  async delete(id: string) {
    const memoryToDelete = await db.query.memories.findFirst({
      where: eq(memories.id, id),
      with: {
        image: true,
      },
    })

    if (!memoryToDelete)
      return null

    await db.delete(memories).where(eq(memories.id, id))

    return memoryToDelete
  },

  /**
   * Устанавливает timestamp для воспоминания, используя 'takenAt' из связанного изображения.
   * @param id - ID воспоминания.
   * @returns Обновленный полный объект или null.
   */
  async applyTakenAtTimestamp(id: string) {
    const memory = await db.query.memories.findFirst({
      where: eq(memories.id, id),
      columns: { imageId: true },
    })

    if (!memory?.imageId)
      return null

    const image = await db.query.tripImages.findFirst({
      where: eq(tripImages.id, memory.imageId),
      columns: { takenAt: true },
    })

    if (!image?.takenAt)
      return null

    const [updatedMemory] = await db
      .update(memories)
      .set({ timestamp: image.takenAt, updatedAt: new Date() })
      .where(eq(memories.id, id))
      .returning()

    if (!updatedMemory)
      return null

    // Возвращаем обновленный объект с полными данными
    return await db.query.memories.findFirst({
      where: eq(memories.id, updatedMemory.id),
      with: {
        image: true,
      },
    })
  },

  /**
   * Отвязывает воспоминание от даты, устанавливая timestamp в null.
   * @param id - ID воспоминания.
   * @returns Обновленный полный объект или null.
   */
  async unassignTimestamp(id: string) {
    const [updatedMemory] = await db
      .update(memories)
      .set({ timestamp: null, updatedAt: new Date() })
      .where(eq(memories.id, id))
      .returning()

    if (!updatedMemory)
      return null

    return await db.query.memories.findFirst({
      where: eq(memories.id, updatedMemory.id),
      with: {
        image: true,
      },
    })
  },
}
