import { and, desc, eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/../db'
import { highlights } from '~/../db/schema'
import { measureDbQuery } from '~/lib/db-monitoring'

export const highlightRepository = {
  async getByUserId(userId: string, limit: number, page: number) {
    return measureDbQuery('highlights', 'select', async () => {
      const offset = (page - 1) * limit
      const conditions = [eq(highlights.userId, userId)]

      const items = await db.query.highlights.findMany({
        where: and(...conditions),
        with: {
          country: true,
        },
        orderBy: [desc(highlights.createdAt)],
        limit,
        offset,
      })

      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(highlights)
        .where(and(...conditions))

      const mappedItems = items.map((item) => {
        let w = item.width
        let h = item.height

        if (!w || !h) {
          const meta = item.metadata as any
          if (meta?.width)
            w = meta.width
          if (meta?.height)
            h = meta.height
        }

        return {
          ...item,
          width: w,
          height: h,
          metadata: null, // Обнуляем тяжелые метаданные для уменьшения размера ответа
        }
      })

      return { items: mappedItems, total: Number(totalResult.count) }
    })
  },

  async create(data: Omit<typeof highlights.$inferInsert, 'id' | 'createdAt'>) {
    return measureDbQuery('highlights', 'insert', async () => {
      const [newHighlight] = await db.insert(highlights).values({
        id: uuidv4(),
        ...data,
      }).returning()

      return await db.query.highlights.findFirst({
        where: eq(highlights.id, newHighlight.id),
        with: {
          country: true,
        },
      })
    })
  },

  async delete(id: string, userId: string) {
    return measureDbQuery('highlights', 'delete', async () => {
      const [deleted] = await db.delete(highlights)
        .where(and(eq(highlights.id, id), eq(highlights.userId, userId)))
        .returning()
      return deleted
    })
  },
}
