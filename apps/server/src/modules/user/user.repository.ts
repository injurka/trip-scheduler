import type { z } from 'zod'
import type { PlanForClient, PlanRecord, UserForClient, User as UserRecord } from './user.types'
import type { SignUpInputSchema, UpdateUserInputSchema } from '~/modules/user/user.schemas'
import { v4 as uuidv4 } from 'uuid'
import { db, toId } from '~/db'
import { authUtils } from '~/lib/auth.utils'
import { createTRPCError } from '~/lib/trpc'
import { getDefaultPlan, normalizePlan, normalizeUser } from './user.helpers'

interface OAuthInput {
  provider: 'google' | 'github' | 'telegram'
  providerId: string
  email: string | null
  name: string
  avatarUrl?: string
}

export const userRepository = {
  async listPlans(): Promise<PlanForClient[]> {
    const plans = await db.select<PlanRecord>('plan')

    return plans.map(normalizePlan)
  },

  async findByEmail(email: string): Promise<UserRecord | null> {
    const [result] = await db.query<[UserRecord[]]>(`
      SELECT * FROM user WHERE email = $email LIMIT 1
    `, { email })

    return result?.[0] || null
  },

  async create(data: z.infer<typeof SignUpInputSchema> & { password?: string }): Promise<UserForClient> {
    const id = uuidv4()
    const recordId = toId('user', id)
    const defaultPlan = await getDefaultPlan()

    const [newUser] = await db.create(recordId, {
      ...data,
      emailVerified: null,
      role: 'user',
      plan: defaultPlan,
      currentTripsCount: 0,
      currentStorageBytes: 0,
      llmCreditsUsed: 0,
      llmCreditsPeriodStartDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return normalizeUser(newUser as UserRecord)
  },

  async findOrCreateFromOAuth({ provider, providerId, email, name, avatarUrl }: OAuthInput): Promise<UserForClient> {
    const providerField = `${provider}Id` as keyof UserRecord

    // Ищем пользователя
    const [existingUserResult] = await db.query<[(UserRecord & { tripsCount: [{ count: number }] })[]]>(`
      SELECT *, (SELECT count() FROM ->participates_in->trip GROUP ALL) as tripsCount
      FROM user WHERE ${providerField} = $providerId OR (email = $email AND $email IS NOT NULL)
      LIMIT 1
    `, { providerId, email })

    const userWithCount = existingUserResult?.[0]

    if (userWithCount) {
      if (!userWithCount[providerField]) {
        await db.merge(userWithCount.id, {
          [providerField]: providerId,
          updatedAt: new Date(),
        });

        (userWithCount as any)[providerField] = providerId
      }
      return normalizeUser(userWithCount)
    }

    // Создаем нового
    const id = uuidv4()
    const recordId = toId('user', id)
    const defaultPlan = await getDefaultPlan()
    const finalEmail = email || `${provider}_${providerId}@no-email.com`

    const [newUser] = await db.create(recordId, {
      email: finalEmail,
      name,
      avatarUrl: avatarUrl || undefined,
      [providerField]: providerId,
      role: 'user',
      emailVerified: new Date(),
      plan: defaultPlan,
      currentTripsCount: 0,
      currentStorageBytes: 0,
      llmCreditsUsed: 0,
      llmCreditsPeriodStartDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return normalizeUser(newUser as UserRecord)
  },

  async getById(id: string): Promise<UserForClient | null> {
    const recordId = toId('user', id)
    try {
      const [result] = await db.query<[(UserRecord & { tripsCount: [{ count: number }] })[]]>(`
        SELECT *, (SELECT count() FROM ->participates_in->trip GROUP ALL) as tripsCount
        FROM ONLY ${recordId}
      `)
      const user = result?.[0]
      if (!user)
        return null

      return normalizeUser(user)
    }
    catch {
      return null
    }
  },

  async getStats(userId: string) {
    const recordId = toId('user', userId)
    const [countResult] = await db.query<[{ count: number }][]>(`
      SELECT count() FROM ${recordId}->participates_in->trip GROUP ALL
    `)
    return {
      trips: countResult[0]?.count || 0,
    }
  },

  async update(id: string, data: z.infer<typeof UpdateUserInputSchema>): Promise<UserForClient | null> {
    const recordId = toId('user', id)
    try {
      await db.merge(recordId, {
        ...data,
        updatedAt: new Date(),
      })
      return this.getById(id)
    }
    catch {
      return null
    }
  },

  async updateStatus(id: string, data: { statusText?: string | null, statusEmoji?: string | null }) {
    const recordId = toId('user', id)
    try {
      await db.merge(recordId, {
        ...data,
        updatedAt: new Date(),
      })
      return this.getById(id)
    }
    catch {
      return null
    }
  },

  async changePassword(id: string, currentPassword: string, newPasswordHash: string) {
    const recordId = toId('user', id)
    const [user] = await db.select<UserRecord>(recordId)

    if (!user || !user.password)
      throw createTRPCError('UNAUTHORIZED', 'Неверный текущий пароль.')

    const isPasswordValid = await authUtils.passwords.verify(currentPassword, user.password)
    if (!isPasswordValid)
      throw createTRPCError('UNAUTHORIZED', 'Неверный текущий пароль.')

    await db.merge(recordId, {
      password: newPasswordHash,
      updatedAt: new Date(),
    })

    return true
  },

  async delete(id: string, password: string) {
    const recordId = toId('user', id)
    // db.select возвращает массив
    const [user] = await db.select<UserRecord>(recordId)

    if (!user || !user.password)
      throw createTRPCError('UNAUTHORIZED', 'Неверный пароль.')

    const isPasswordValid = await authUtils.passwords.verify(password, user.password)
    if (!isPasswordValid)
      throw createTRPCError('UNAUTHORIZED', 'Неверный пароль.')

    await db.delete(recordId)
    return true
  },
}
