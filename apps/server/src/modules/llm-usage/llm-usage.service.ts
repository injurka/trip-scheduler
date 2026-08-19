import type { users } from 'db/schema'
import { llmModelsRepository } from '~/repositories/llm-models.repository'
import { llmUsageRepository } from '~/repositories/llm-usage.repository'

export const llmUsageService = {
  /**
   * Gets the token usage history for a specific user.
   * @param userId The ID of the user.
   * @returns A list of token usage records.
   */
  async getHistory(userId: string) {
    return await llmUsageRepository.findByUserId(userId)
  },

  /**
   * Gets the token usage summary for a specific user.
   * @param user The user object, including the plan.
   * @returns An object with total input and output tokens.
   */
  async getSummary(user: typeof users.$inferSelect & { plan: any }) {
    const totals = await llmUsageRepository.getSummaryByUserId(user.id)
    return {
      ...totals,
      limit: user.plan?.monthlyLlmCredits || 0,
      used: user.llmCreditsUsed,
    }
  },

  /**
   * Получить список всех моделей с их стоимостью.
   */
  async listModels() {
    return await llmModelsRepository.getAll()
  },

  /**
   * Добавить или обновить модель (тариф).
   */
  async upsertModel(data: {
    id: string
    costPerMillionInputTokens: number
    costPerMillionOutputTokens: number
  }) {
    return await llmModelsRepository.upsert(data)
  },

  /**
   * Удалить модель.
   */
  async deleteModel(id: string) {
    return await llmModelsRepository.delete(id)
  },

  /**
   * Синхронизировать дефолтные модели из кода в БД.
   */
  async syncDefaultModels() {
    const models = await llmModelsRepository.syncDefaultModels()
    return {
      success: true,
      models,
      message: `Синхронизировано ${models.length} моделей`,
    }
  },
}
