import type { z } from 'zod'
import type { GetUserReviewsInputSchema } from '~/modules/destination-review/destination-review.schemas'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/../db'
import { destinationReviews } from '~/../db/schema'
import { measureDbQuery } from '~/lib/db-monitoring'

export const destinationReviewRepository = {
  async getByUserId(input: z.infer<typeof GetUserReviewsInputSchema>) {
    return measureDbQuery('destinationReviews', 'select', async () => {
      const { userId, type, limit, page, countryId, city, sortBy, sortOrder } = input
      const offset = (page - 1) * limit
      const conditions: any[] = [eq(destinationReviews.userId, userId)]

      if (type)
        conditions.push(eq(destinationReviews.type, type))
      if (countryId)
        conditions.push(eq(destinationReviews.countryId, countryId))
      if (city)
        conditions.push(eq(destinationReviews.city, city))

      // Определение логики сортировки
      let sortExpr
      if (sortBy === 'createdAt') {
        sortExpr = destinationReviews.createdAt
      }
      else if (sortBy === 'rating') {
        // Динамическое вычисление среднего рейтинга из JSONB
        sortExpr = sql`(SELECT avg(value::numeric) FROM jsonb_each_text(${destinationReviews.metrics}) WHERE key NOT LIKE '%_comment')`
      }
      else {
        // Сортировка по конкретной метрике (из JSONB)
        sortExpr = sql`(${destinationReviews.metrics}->>${sortBy})::numeric`
      }

      const orderDirection = sortOrder === 'asc' ? asc(sortExpr) : desc(sortExpr)

      const items = await db.query.destinationReviews.findMany({
        where: and(...conditions),
        with: { country: true },
        orderBy: [orderDirection, desc(destinationReviews.createdAt)], // fallback to createdAt
        limit,
        offset,
      })

      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(destinationReviews)
        .where(and(...conditions))

      return { items, total: Number(totalResult.count) }
    })
  },

  async getCitiesByUserId(userId: string) {
    return measureDbQuery('destinationReviews', 'select', async () => {
      const cityExpression = sql<string>`${destinationReviews.city}`
      const result = await db
        .selectDistinct({ city: cityExpression })
        .from(destinationReviews)
        .where(and(eq(destinationReviews.userId, userId), sql`${destinationReviews.city} IS NOT NULL`))
        .orderBy(cityExpression)

      return result.map(row => row.city).filter(Boolean)
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

  async update(id: string, data: Partial<Omit<typeof destinationReviews.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>>, userId: string) {
    return measureDbQuery('destinationReviews', 'update', async () => {
      const [updated] = await db.update(destinationReviews)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(destinationReviews.id, id), eq(destinationReviews.userId, userId)))
        .returning()

      if (!updated)
        return null

      return await db.query.destinationReviews.findFirst({
        where: eq(destinationReviews.id, updated.id),
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
