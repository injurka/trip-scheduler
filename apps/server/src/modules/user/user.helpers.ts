import type { PlanForClient, PlanRecord, UserForClient, UserRecord } from './user.types'
import { db, toId } from '~/db'
import { FREE_PLAN_ID } from '~/lib/constants'
import { createTRPCError } from '~/lib/trpc'

function normalizePlan(plan: PlanRecord): PlanForClient {
  return {
    ...plan,
    id: plan.id.toString(),
  }
}

function normalizeUser(user: UserRecord & { tripsCount?: [{ count: number }] }): UserForClient {
  const { password, tripsCount, id, plan, ...rest } = user
  const trips = tripsCount?.[0]?.count || 0

  return {
    ...rest,
    id: id.toString(),
    plan: plan ? normalizePlan(plan) : undefined,
    _count: { trips },
  }
}

async function getDefaultPlan() {
  const planRecordId = toId('plan', FREE_PLAN_ID.toString())

  try {
    const result = await db.select<PlanRecord>(planRecordId)
    const plan = Array.isArray(result) ? result[0] : result

    if (!plan)
      throw new Error('Бесплатный тарифный план не найден в базе данных.')

    return plan
  }
  catch {
    throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось получить тарифный план по умолчанию.')
  }
}

export { getDefaultPlan, normalizePlan, normalizeUser }
