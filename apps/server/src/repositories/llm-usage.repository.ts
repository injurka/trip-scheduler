import { desc, eq, sql } from 'drizzle-orm'
import { db } from '~/../db'
import { llmTokenUsage } from '~/../db/schema'

type LlmUsageInsert = typeof llmTokenUsage.$inferInsert

export const llmUsageRepository = {
  /**
   * Creates a new token usage record.
   */
  async create(data: Omit<LlmUsageInsert, 'id' | 'createdAt'>) {
    const [newRecord] = await db.insert(llmTokenUsage).values(data).returning()
    return newRecord
  },

  /**
   * Finds all usage records for a specific user, ordered by most recent.
   */
  async findByUserId(userId: string) {
    return await db.query.llmTokenUsage.findMany({
      where: eq(llmTokenUsage.userId, userId),
      orderBy: [desc(llmTokenUsage.createdAt)],
    })
  },

  /**
   * Calculates the total input and output tokens for a user.
   */
  async getSummaryByUserId(userId: string) {
    const [result] = await db
      .select({
        totalInputTokens: sql<number>`sum(${llmTokenUsage.inputTokens})`.mapWith(Number),
        totalOutputTokens: sql<number>`sum(${llmTokenUsage.outputTokens})`.mapWith(Number),
      })
      .from(llmTokenUsage)
      .where(eq(llmTokenUsage.userId, userId))

    return {
      totalInputTokens: result.totalInputTokens || 0,
      totalOutputTokens: result.totalOutputTokens || 0,
    }
  },
}
