import { and, desc, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/../db'
import { countries, destinationReviews } from '~/../db/schema'
import { measureDbQuery } from '~/lib/db-monitoring'

export const destinationReviewRepository = {
  async getByUserId(userId: string, type?: 'country' | 'city') {
    return measureDbQuery('destinationReviews', 'select', async () => {
      const conditions = [eq(destinationReviews.userId, userId)]
      if (type)
        conditions.push(eq(destinationReviews.type, type))

      return await db.query.destinationReviews.findMany({
        where: and(...conditions),
        with: { country: true },
        orderBy: [desc(destinationReviews.createdAt)],
      })
    })
  },

  async create(data: Omit<typeof destinationReviews.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>) {
    return measureDbQuery('destinationReviews', 'insert', async () => {
      const [newReview] = await db.insert(destinationReviews).values({
        id: uuidv4(),
        ...data,
      }).returning()

      return await db.query.destinationReviews.findFirst({
        where: eq(destinationReviews.id, newReview.id),
        with: { country: true },
      })
    })
  },

  async delete(id: string, userId: string) {
    return measureDbQuery('destinationReviews', 'delete', async () => {
      const [deleted] = await db.delete(destinationReviews)
        .where(and(eq(destinationReviews.id, id), eq(destinationReviews.userId, userId)))
        .returning()
      return deleted
    })
  },
}
