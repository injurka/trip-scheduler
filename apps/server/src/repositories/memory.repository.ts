import type { z } from 'zod'
import type { CreateMemoryInputSchema, GetMemoriesInputSchema, UpdateMemoryInputSchema } from '~/modules/memory/memory.schemas'
import { db } from 'db'
import { memories, tripImages } from 'db/schema'
import { and, asc, eq, gte, isNull, lte, sql } from 'drizzle-orm'
import { normalizeStarRating } from '~/services/photo-rating'

/** Called inside the transaction holding the image lock. Never overwrite manual choices. */
export async function applyImportedImageRating(tx: Pick<typeof db, 'update'>, imageId: string, value: unknown) {
  const rating = normalizeStarRating(value)
  if (rating === undefined)
    return
  await tx.update(memories).set({ rating }).where(and(
    eq(memories.imageId, imageId),
    isNull(memories.rating),
    eq(memories.ratingManuallySet, false),
  ))
}

export const memoryRepository = {
  /**
   * Создает новое воспоминание (текст или фото).
   * Возвращает полный объект, включая связанные данные изображения.
   */
  async create(data: z.infer<typeof CreateMemoryInputSchema>) {
    // Serialize creation with background extraction on the same image.
    const newMemory = await db.transaction(async (tx) => {
      const [image] = data.imageId
        ? await tx.select({ metadata: tripImages.metadata }).from(tripImages).where(and(eq(tripImages.id, data.imageId), eq(tripImages.tripId, data.tripId))).for('update')
        : []
      const [created] = await tx.insert(memories)
        .values({
          tripId: data.tripId,
          timestamp: data.timestamp ? new Date(data.timestamp) : null,
          comment: data.comment,
          imageId: data.imageId,
          title: data.title,
          tag: data.tag,
          sourceActivityId: data.sourceActivityId,
          rating: data.rating ?? normalizeStarRating((image?.metadata as Record<string, unknown> | null)?.rating),
          ratingManuallySet: data.rating !== undefined,
          tags: data.tags ?? [],
        })
        .returning()
      return created
    })

    const result = await db.query.memories.findFirst({
      where: eq(memories.id, newMemory.id),
      with: {
        image: {
          columns: {
            metadata: false,
          },
        },
      },
    })

    return result
  },

  /**
   * Получает все воспоминания для путешествия, включая полные данные связанных изображений.
   */
  async getByTripId(input: z.infer<typeof GetMemoriesInputSchema>) {
    const conditions = [eq(memories.tripId, input.tripId)]

    if (input.minRating !== undefined) {
      conditions.push(gte(memories.rating, input.minRating))
    }

    if (input.maxRating !== undefined) {
      conditions.push(lte(memories.rating, input.maxRating))
    }

    if (input.tags && input.tags.length > 0) {
      const tagsJson = JSON.stringify(input.tags)
      conditions.push(sql`${memories.tags} @> ${tagsJson}::jsonb`)
    }

    return await db.query.memories.findMany({
      where: and(...conditions),
      with: {
        image: {
          columns: {
            metadata: false,
          },
        },
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

    const payload: Record<string, unknown> = { ...updateData, updatedAt: new Date() }
    if (Object.hasOwn(updateData, 'rating'))
      payload.ratingManuallySet = true

    if (Object.hasOwn(updateData, 'timestamp')) {
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
        image: {
          columns: {
            metadata: false,
          },
        },
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

    return await db.query.memories.findFirst({
      where: eq(memories.id, updatedMemory.id),
      with: {
        image: { columns: { metadata: false } },
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
        image: { columns: { metadata: false } },
      },
    })
  },
}
