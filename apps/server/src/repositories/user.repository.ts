import type { z } from 'zod'
import type { SignUpInputSchema, UpdateUserInputSchema } from '~/modules/user/user.schemas'
import { eq, sql } from 'drizzle-orm'
import { db } from '~/../db'
import { communityMembers, tripParticipants, users } from '~/../db/schema'
import { authUtils } from '~/lib/auth.utils'
import { FREE_PLAN_ID } from '~/lib/constants'
import { createTRPCError } from '~/lib/trpc'

interface OAuthInput {
  provider: 'google' | 'github' | 'telegram'
  providerId: string
  email: string | null
  name: string
  avatarUrl?: string
}

type UserForClient = Omit<typeof users.$inferSelect, 'password'> & { plan?: any, _count?: { communities: number, trips: number } }

function excludePassword<T extends { password?: string | null }>(user: T): Omit<T, 'password'> {
  const { password, ...rest } = user
  return rest
}

export const userRepository = {
  /**
   * Получает список всех доступных тарифных планов.
   */
  async listPlans() {
    return await db.query.plans.findMany()
  },

  /**
   * Находит пользователя по email.
   */
  async findByEmail(email: string) {
    return await db.query.users.findFirst({
      where: eq(users.email, email),
      with: {
        plan: true,
      },
    })
  },

  /**
   * Создает нового пользователя.
   */
  async create(data: z.infer<typeof SignUpInputSchema> & { password?: string }): Promise<UserForClient> {
    const [newUser] = await db
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        password: data.password,
        planId: FREE_PLAN_ID,
      })
      .returning()

    return excludePassword(newUser)
  },

  /**
   * OAuth find or create logic
   */
  async findOrCreateFromOAuth({ provider, providerId, email, name, avatarUrl }: OAuthInput): Promise<UserForClient> {
    let user: Awaited<ReturnType<typeof db.query.users.findFirst>> | undefined

    if (provider === 'google') {
      user = await db.query.users.findFirst({ where: eq(users.googleId, providerId), with: { plan: true } })
    }
    else if (provider === 'github') {
      user = await db.query.users.findFirst({ where: eq(users.githubId, providerId), with: { plan: true } })
    }
    else if (provider === 'telegram') {
      user = await db.query.users.findFirst({ where: eq(users.telegramId, providerId), with: { plan: true } })
    }

    if (user) {
      return excludePassword(user) as UserForClient
    }

    if (email) {
      const userWithEmail = await db.query.users.findFirst({
        where: eq(users.email, email),
        with: { plan: true },
      })

      if (userWithEmail) {
        const updateData: Partial<typeof users.$inferInsert> = { updatedAt: new Date() }
        if (provider === 'google')
          updateData.googleId = providerId
        else if (provider === 'github')
          updateData.githubId = providerId
        else if (provider === 'telegram')
          updateData.telegramId = providerId

        const [updatedUser] = await db.update(users)
          .set(updateData)
          .where(eq(users.id, userWithEmail.id))
          .returning()

        return { ...excludePassword(updatedUser), plan: userWithEmail.plan }
      }
    }

    const finalEmail = email || `telegram_${providerId}@telegram.user`
    const newUserPayload: typeof users.$inferInsert = {
      email: finalEmail,
      name,
      avatarUrl: avatarUrl || undefined,
      emailVerified: new Date(),
      planId: FREE_PLAN_ID,
    }

    if (provider === 'google')
      newUserPayload.googleId = providerId
    else if (provider === 'github')
      newUserPayload.githubId = providerId
    else if (provider === 'telegram')
      newUserPayload.telegramId = providerId

    const [newUser] = await db.insert(users)
      .values(newUserPayload)
      .returning()

    return await this.getById(newUser.id) as UserForClient
  },

  async getById(id: string): Promise<UserForClient | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        plan: true,
      },
    })

    if (!user)
      return null

    const [communityCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(communityMembers)
      .where(eq(communityMembers.userId, id))

    const [tripCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tripParticipants)
      .where(eq(tripParticipants.userId, id))

    return {
      ...excludePassword(user),
      _count: {
        communities: Number(communityCountResult.count),
        trips: Number(tripCountResult.count),
      },
    }
  },

  async getStats(userId: string) {
    const [tripCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tripParticipants)
      .where(eq(tripParticipants.userId, userId))

    const [communityCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(communityMembers)
      .where(eq(communityMembers.userId, userId))

    return {
      trips: Number(tripCountResult.count),
      communities: Number(communityCountResult.count),
    }
  },

  async update(id: string, data: z.infer<typeof UpdateUserInputSchema>): Promise<UserForClient> {
    await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))

    return await this.getById(id) as UserForClient
  },

  async updateStatus(id: string, data: { statusText?: string | null, statusEmoji?: string | null }) {
    const [updatedUser] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()

    if (!updatedUser)
      return null

    return await this.getById(updatedUser.id)
  },

  async changePassword(id: string, currentPassword: string, newPasswordHash: string) {
    const user = await db.query.users.findFirst({ where: eq(users.id, id) })
    if (!user || !user.password) {
      throw createTRPCError('UNAUTHORIZED', 'Неверный текущий пароль.')
    }
    const isPasswordValid = await authUtils.passwords.verify(currentPassword, user.password)
    if (!isPasswordValid) {
      throw createTRPCError('UNAUTHORIZED', 'Неверный текущий пароль.')
    }
    await db.update(users).set({ password: newPasswordHash }).where(eq(users.id, id))
    return true
  },

  async delete(id: string, password: string) {
    const user = await db.query.users.findFirst({ where: eq(users.id, id) })
    if (!user || !user.password) {
      throw createTRPCError('UNAUTHORIZED', 'Неверный пароль.')
    }
    const isPasswordValid = await authUtils.passwords.verify(password, user.password)
    if (!isPasswordValid) {
      throw createTRPCError('UNAUTHORIZED', 'Неверный пароль.')
    }
    await db.delete(users).where(eq(users.id, id))
    return true
  },
}
