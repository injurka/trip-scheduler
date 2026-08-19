import { asc, eq } from 'drizzle-orm'
import { db } from '~/../db'
import { llmModels } from '~/../db/schema'
import { measureDbQuery } from '~/lib/db-monitoring'

export const llmModelsRepository = {
  /**
   * Получить список всех зарегистрированных LLM моделей.
   */
  async getAll() {
    return measureDbQuery('llmModels', 'select', async () => {
      return await db.query.llmModels.findMany({
        orderBy: [asc(llmModels.id)],
      })
    })
  },

  /**
   * Получить модель по ID.
   */
  async getById(id: string) {
    return measureDbQuery('llmModels', 'select', async () => {
      return await db.query.llmModels.findFirst({
        where: eq(llmModels.id, id),
      })
    })
  },

  /**
   * Создать или обновить модель (тариф токенов).
   */
  async upsert(data: {
    id: string
    costPerMillionInputTokens: number
    costPerMillionOutputTokens: number
  }) {
    return measureDbQuery('llmModels', 'insert', async () => {
      const [model] = await db
        .insert(llmModels)
        .values({
          id: data.id,
          costPerMillionInputTokens: data.costPerMillionInputTokens,
          costPerMillionOutputTokens: data.costPerMillionOutputTokens,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: llmModels.id,
          set: {
            costPerMillionInputTokens: data.costPerMillionInputTokens,
            costPerMillionOutputTokens: data.costPerMillionOutputTokens,
            updatedAt: new Date(),
          },
        })
        .returning()
      return model
    })
  },

  /**
   * Удалить модель.
   */
  async delete(id: string) {
    return measureDbQuery('llmModels', 'delete', async () => {
      const [deleted] = await db
        .delete(llmModels)
        .where(eq(llmModels.id, id))
        .returning()
      return deleted || null
    })
  },

}
