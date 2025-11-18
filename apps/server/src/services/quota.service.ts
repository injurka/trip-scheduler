import { TRPCError } from '@trpc/server'
import { db } from 'db'
import { llmModels, users } from 'db/schema'
import { eq, sql } from 'drizzle-orm'
import { createTRPCError } from '~/lib/trpc'

// Стоимость одного доллара в кредитах
const CREDITS_PER_DOLLAR = 100000

// Кэш для цен моделей, чтобы не делать запрос к БД каждый раз
const modelPricesCache = new Map<string, { input: number, output: number }>()

async function getModelCosts(modelId: string): Promise<{ input: number, output: number }> {
  if (modelPricesCache.has(modelId)) {
    return modelPricesCache.get(modelId)!
  }

  const model = await db.query.llmModels.findFirst({
    where: eq(llmModels.id, modelId),
  })

  if (!model) {
    console.error(`Pricing for model "${modelId}" not found in the database.`)
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Pricing information for model ${modelId} is not available.` })
  }

  const costs = {
    input: model.costPerMillionInputTokens,
    output: model.costPerMillionOutputTokens,
  }
  modelPricesCache.set(modelId, costs)
  return costs
}

export const quotaService = {
  /**
   * Проверяет, может ли пользователь создать новое путешествие.
   */
  async checkTripCreationQuota(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: { plan: true },
    })

    if (!user || !user.plan) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось получить информацию о тарифном плане пользователя.')
    }

    if (user.currentTripsCount >= user.plan.maxTrips) {
      throw createTRPCError('FORBIDDEN', `Вы достигли лимита в ${user.plan.maxTrips} путешествий на тарифе "${user.plan.name}".`)
    }
  },

  /**
   * Проверяет, достаточно ли у пользователя места для загрузки нового файла.
   */
  async checkStorageQuota(userId: string, fileSizeInBytes: number) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: { plan: true },
    })

    if (!user || !user.plan) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось получить информацию о тарифном плане пользователя.')
    }

    if (user.currentStorageBytes + fileSizeInBytes > user.plan.maxStorageBytes) {
      const remainingMb = Math.round((user.plan.maxStorageBytes - user.currentStorageBytes) / 1024 / 1024)
      throw createTRPCError('FORBIDDEN', `Недостаточно места. У вас осталось ${remainingMb > 0 ? remainingMb : 0} МБ.`)
    }
  },

  /**
   * Проверяет, не исчерпал ли пользователь лимит LLM кредитов.
   * Сбрасывает счетчик, если начался новый месячный период.
   */
  async checkLlmCreditQuota(userId: string): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: { plan: true },
    })

    if (!user || !user.plan) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось получить информацию о тарифном плане пользователя.')
    }

    const now = new Date()
    const periodStart = new Date(user.llmCreditsPeriodStartDate)
    const nextPeriodStart = new Date(new Date(periodStart).setMonth(periodStart.getMonth() + 1))

    if (now >= nextPeriodStart) {
      await db
        .update(users)
        .set({ llmCreditsUsed: 0, llmCreditsPeriodStartDate: now })
        .where(eq(users.id, userId))
      return
    }

    if (user.llmCreditsUsed >= user.plan.monthlyLlmCredits) {
      throw createTRPCError('FORBIDDEN', `Вы исчерпали месячный лимит на использование AI-функций на тарифе "${user.plan.name}".`)
    }
  },

  /**
   * Списывает LLM кредиты со счета пользователя после успешной операции.
   */
  async deductLlmCredits(userId: string, modelId: string, inputTokens: number, outputTokens: number): Promise<void> {
    const costs = await getModelCosts(modelId)

    const costInDollars
      = (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output

    const costInCredits = Math.ceil(costInDollars * CREDITS_PER_DOLLAR)

    if (costInCredits > 0) {
      await db
        .update(users)
        .set({ llmCreditsUsed: sql`${users.llmCreditsUsed} + ${costInCredits}` })
        .where(eq(users.id, userId))
    }
  },

  /**
   * Атомарно увеличивает счетчик созданных путешествий для пользователя.
   */
  async incrementTripCount(userId: string) {
    await db.update(users)
      .set({ currentTripsCount: sql`${users.currentTripsCount} + 1` })
      .where(eq(users.id, userId))
  },

  /**
   * Атомарно уменьшает счетчик созданных путешествий для пользователя.
   */
  async decrementTripCount(userId: string) {
    await db.update(users)
      .set({ currentTripsCount: sql`GREATEST(0, ${users.currentTripsCount} - 1)` })
      .where(eq(users.id, userId))
  },

  /**
   * Атомарно увеличивает счетчик использованного места.
   */
  async incrementStorageUsage(userId: string, fileSizeInBytes: number) {
    await db.update(users)
      .set({ currentStorageBytes: sql`${users.currentStorageBytes} + ${fileSizeInBytes}` })
      .where(eq(users.id, userId))
  },

  /**
   * Атомарно уменьшает счетчик использованного места.
   */
  async decrementStorageUsage(userId: string, fileSizeInBytes: number) {
    await db.update(users)
      .set({ currentStorageBytes: sql`GREATEST(0, ${users.currentStorageBytes} - ${fileSizeInBytes})` })
      .where(eq(users.id, userId))
  },
}
