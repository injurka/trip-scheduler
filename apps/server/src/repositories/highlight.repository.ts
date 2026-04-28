import { and, desc, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/../db'
import { highlights } from '~/../db/schema'
import { measureDbQuery } from '~/lib/db-monitoring'

export const highlightRepository = {
  async getByUserId(userId: string) {
    return measureDbQuery('highlights', 'select', async () => {
      return await db.query.highlights.findMany({
        where: eq(highlights.userId, userId),
        with: {
          country: true,
        },
        orderBy: [desc(highlights.createdAt)],
      })
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
        }
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
