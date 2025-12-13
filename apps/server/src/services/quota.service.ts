import type { User } from '~/modules/user/user.types'
import { TRPCError } from '@trpc/server'
import { db, toId } from '~/db'
import { createTRPCError } from '~/lib/trpc'

const CREDITS_PER_DOLLAR = 100000
const modelPricesCache = new Map<string, { input: number, output: number }>()

async function getModelCosts(modelId: string): Promise<{ input: number, output: number }> {
  if (modelPricesCache.has(modelId)) {
    return modelPricesCache.get(modelId)!
  }

  const [result] = await db.query<any[][]>(`SELECT * FROM llm_models WHERE id = $id`, { id: modelId })
  const model = result?.[0]

  if (!model) {
    console.error(`Pricing for model "${modelId}" not found.`)
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Pricing info not available.' })
  }

  const costs = {
    input: model.costPerMillionInputTokens,
    output: model.costPerMillionOutputTokens,
  }
  modelPricesCache.set(modelId, costs)
  return costs
}

export const quotaService = {
  async checkTripCreationQuota(userId: string) {
    const userRecordId = toId('user', userId)
    const user = await db.select<User>(userRecordId)

    if (!user || !user.plan) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось получить информацию о пользователе.')
    }

    if (user.currentTripsCount >= user.plan.maxTrips) {
      throw createTRPCError('FORBIDDEN', `Лимит путешествий (${user.plan.maxTrips}) исчерпан.`)
    }
  },

  async checkStorageQuota(userId: string, fileSizeInBytes: number) {
    const userRecordId = toId('user', userId)
    const user = await db.select<User>(userRecordId)

    if (!user || !user.plan) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось получить информацию о пользователе.')
    }

    if (user.currentStorageBytes + fileSizeInBytes > user.plan.maxStorageBytes) {
      throw createTRPCError('FORBIDDEN', 'Недостаточно места в хранилище.')
    }
  },

  async checkLlmCreditQuota(userId: string): Promise<void> {
    const userRecordId = toId('user', userId)
    const user = await db.select<User>(userRecordId)

    if (!user || !user.plan) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось получить информацию о пользователе.')
    }

    const now = new Date()
    const periodStart = new Date(user.llmCreditsPeriodStartDate)
    const nextPeriodStart = new Date(new Date(periodStart).setMonth(periodStart.getMonth() + 1))

    if (now >= nextPeriodStart) {
      await db.merge(userRecordId, {
        llmCreditsUsed: 0,
        llmCreditsPeriodStartDate: now,
      })
      return
    }

    if (user.llmCreditsUsed >= user.plan.monthlyLlmCredits) {
      throw createTRPCError('FORBIDDEN', 'Месячный лимит AI-кредитов исчерпан.')
    }
  },

  async deductLlmCredits(userId: string, modelId: string, inputTokens: number, outputTokens: number): Promise<void> {
    const costs = await getModelCosts(modelId)
    const costInDollars = (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output
    const costInCredits = Math.ceil(costInDollars * CREDITS_PER_DOLLAR)

    if (costInCredits > 0) {
      const userRecordId = toId('user', userId)
      await db.query(`UPDATE ${userRecordId} SET llmCreditsUsed += $cost`, { cost: costInCredits })
    }
  },

  async incrementTripCount(userId: string) {
    const userRecordId = toId('user', userId)
    await db.query(`UPDATE ${userRecordId} SET currentTripsCount += 1`)
  },

  async decrementTripCount(userId: string) {
    const userRecordId = toId('user', userId)
    await db.query(`UPDATE ${userRecordId} SET currentTripsCount = math::max(0, currentTripsCount - 1)`)
  },

  async incrementStorageUsage(userId: string, fileSizeInBytes: number) {
    const userRecordId = toId('user', userId)
    await db.query(`UPDATE ${userRecordId} SET currentStorageBytes += $size`, { size: fileSizeInBytes })
  },

  async decrementStorageUsage(userId: string, fileSizeInBytes: number) {
    const userRecordId = toId('user', userId)
    await db.query(`UPDATE ${userRecordId} SET currentStorageBytes = math::max(0, currentStorageBytes - $size)`, { size: fileSizeInBytes })
  },
}
