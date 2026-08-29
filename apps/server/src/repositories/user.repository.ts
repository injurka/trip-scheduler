import type { z } from 'zod'
import type { SignUpInputSchema, UpdateUserInputSchema } from '~/modules/user/user.schemas'
import { eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '~/../db'
import { tripParticipants, users } from '~/../db/schema'
import { authUtils } from '~/lib/auth.utils'
import { FREE_PLAN_ID } from '~/lib/constants'
import { createTRPCError } from '~/lib/trpc'

interface OAuthInput {
  provider: 'google' | 'github' | 'telegram' | 'yandex'
  providerId: string
  email: string | null
  name: string
  avatarUrl?: string
}

type UserForClient = Omit<typeof users.$inferSelect, 'password'> & { hasPassword?: boolean, plan?: any, _count?: { trips: number } }

function excludePassword<T extends { password?: string | null }>(user: T): Omit<T, 'password'> & { hasPassword: boolean } {
  const { password, ...rest } = user
  return {
    ...rest,
    hasPassword: Boolean(password),
  }
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
    else if (provider === 'yandex') {
      user = await db.query.users.findFirst({ where: eq(users.yandexId, providerId), with: { plan: true } })
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
        else if (provider === 'yandex')
          updateData.yandexId = providerId

        const [updatedUser] = await db.update(users)
          .set(updateData)
          .where(eq(users.id, userWithEmail.id))
          .returning()

        return { ...excludePassword(updatedUser), plan: userWithEmail.plan }
      }
    }

    const newUserPayload: typeof users.$inferInsert = {
      email: email ?? null,
      name,
      avatarUrl: avatarUrl || undefined,
      emailVerified: email ? new Date() : null,
      planId: FREE_PLAN_ID,
    }

    if (provider === 'google')
      newUserPayload.googleId = providerId
    else if (provider === 'github')
      newUserPayload.githubId = providerId
    else if (provider === 'telegram')
      newUserPayload.telegramId = providerId
    else if (provider === 'yandex')
      newUserPayload.yandexId = providerId

    const [newUser] = await db.insert(users)
      .values(newUserPayload)
      .returning()

    return await this.getById(newUser.id) as UserForClient
  },

  async linkOAuthProvider(userId: string, provider: 'google' | 'github' | 'telegram' | 'yandex', providerId: string): Promise<UserForClient> {
    const providerColumn = provider === 'google'
      ? users.googleId
      : provider === 'github'
        ? users.githubId
        : provider === 'telegram'
          ? users.telegramId
          : users.yandexId

    const existingWithProvider = await db.query.users.findFirst({
      where: eq(providerColumn, providerId),
    })

    if (existingWithProvider) {
      if (existingWithProvider.id === userId) {
        const currentUser = await this.getById(userId)
        return currentUser!
      }
      throw createTRPCError('CONFLICT', 'Этот аккаунт уже привязан к другому пользователю.')
    }

    const updateData: Partial<typeof users.$inferInsert> = { updatedAt: new Date() }
    if (provider === 'google')
      updateData.googleId = providerId
    else if (provider === 'github')
      updateData.githubId = providerId
    else if (provider === 'telegram')
      updateData.telegramId = providerId
    else if (provider === 'yandex')
      updateData.yandexId = providerId

    await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId))

    const updatedUser = await this.getById(userId)
    return updatedUser!
  },

  async unlinkOAuthProvider(userId: string, provider: 'google' | 'github' | 'telegram' | 'yandex'): Promise<UserForClient> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    })

    if (!user) {
      throw createTRPCError('NOT_FOUND', 'Пользователь не найден.')
    }

    const hasPassword = Boolean(user.password)
    const connectedProviders = [
      user.googleId ? 'google' : null,
      user.githubId ? 'github' : null,
      user.telegramId ? 'telegram' : null,
      user.yandexId ? 'yandex' : null,
    ].filter(Boolean)

    const isCurrentProviderConnected = (provider === 'google' && user.googleId)
      || (provider === 'github' && user.githubId)
      || (provider === 'telegram' && user.telegramId)
      || (provider === 'yandex' && user.yandexId)

    if (!isCurrentProviderConnected) {
      throw createTRPCError('BAD_REQUEST', 'Этот аккаунт не привязан.')
    }

    if (!hasPassword && connectedProviders.length <= 1) {
      throw createTRPCError('BAD_REQUEST', 'Нельзя отвязать единственный способ входа в аккаунт. Сначала установите пароль или подключите другую соцсеть.')
    }

    const updateData: Partial<typeof users.$inferInsert> = { updatedAt: new Date() }
    if (provider === 'google')
      updateData.googleId = null
    else if (provider === 'github')
      updateData.githubId = null
    else if (provider === 'telegram')
      updateData.telegramId = null
    else if (provider === 'yandex')
      updateData.yandexId = null

    await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId))

    const updatedUser = await this.getById(userId)
    return updatedUser!
  },

  async setPassword(userId: string, passwordHash: string) {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
    if (!user) {
      throw createTRPCError('NOT_FOUND', 'Пользователь не найден.')
    }
    if (user.password) {
      throw createTRPCError('BAD_REQUEST', 'Пароль уже установлен. Для изменения пароля используйте функцию смены пароля.')
    }

    await db.update(users).set({ password: passwordHash, updatedAt: new Date() }).where(eq(users.id, userId))
    return true
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

    const [tripCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tripParticipants)
      .where(eq(tripParticipants.userId, id))

    return {
      ...excludePassword(user),
      _count: {
        trips: Number(tripCountResult.count),
      },
    }
  },

  async getStats(userId: string) {
    const [tripCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tripParticipants)
      .where(eq(tripParticipants.userId, userId))

    return {
      trips: Number(tripCountResult.count),
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

  async searchUsers(query: string, limit = 5) {
    const searchPattern = `%${query}%`

    const results = await db.query.users.findMany({
      where: or(
        ilike(users.name, searchPattern),
        ilike(users.email, searchPattern),
      ),
      limit,
      columns: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
    })
    return results
  },
}
