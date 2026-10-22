import type { z } from 'zod'
import type {
  ChangePasswordInputSchema,
  CreateHighlightInputSchema,
  DeleteAccountInputSchema,
  GetUserHighlightsInputSchema,
  SetPasswordInputSchema,
  SignInInputSchema,
  SignUpInputSchema,
  UpdateHighlightInputSchema,
  UpdateUserInputSchema,
  VerifyEmailInputSchema,
} from './user.schemas'
import { and, eq, gte } from 'drizzle-orm'
import { db } from '~/../db'
import { emailVerificationTokens, users } from '~/../db/schema'
import { authUtils } from '~/lib/auth.utils'
import { createTRPCError } from '~/lib/trpc'
import { geoRepository } from '~/repositories/geo.repository'
import { highlightRepository } from '~/repositories/highlight.repository'
import { userRepository } from '~/repositories/user.repository'
import { emailService } from '~/services/email.service'
import { deleteFileWithVariants } from '~/services/file-storage.service'
import { telegramAuthService } from '~/services/telegram-auth.service'

export const userService = {
  async listPlans() {
    return await userRepository.listPlans()
  },

  async signUp(input: z.infer<typeof SignUpInputSchema>) {
    const existingUser = await userRepository.findByEmail(input.email)
    if (existingUser && existingUser.emailVerified) {
      throw createTRPCError('CONFLICT', `Пользователь с таким email уже существует.`)
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const hashedPassword = await authUtils.passwords.hash(input.password)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await db.transaction(async (tx) => {
      await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.email, input.email))
      await tx.insert(emailVerificationTokens).values({
        email: input.email,
        token: verificationCode,
        name: input.name,
        password: hashedPassword,
        expiresAt,
      })
    })

    await emailService.sendVerificationEmail(input.email, verificationCode)

    return { success: true, message: 'Код подтверждения отправлен на вашу почту.' }
  },

  async verifyEmail(input: z.infer<typeof VerifyEmailInputSchema>) {
    const verificationRecord = await db.query.emailVerificationTokens.findFirst({
      where: and(
        eq(emailVerificationTokens.email, input.email),
        gte(emailVerificationTokens.expiresAt, new Date()),
      ),
    })

    if (!verificationRecord || verificationRecord.token !== input.token) {
      throw createTRPCError('UNAUTHORIZED', 'Неверный или истекший код подтверждения.')
    }

    const user = await userRepository.create({
      name: verificationRecord.name,
      email: verificationRecord.email!,
      password: verificationRecord.password,
    })

    await db.update(users).set({ emailVerified: new Date() }).where(eq(users.id, user.id))
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, verificationRecord.id))

    const fullUser = await userRepository.getById(user.id)
    if (!fullUser) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось получить данные пользователя после регистрации.')
    }

    const token = await authUtils.generateTokens({ id: fullUser.id, email: fullUser.email })

    return { user: fullUser, token }
  },

  async signIn(input: z.infer<typeof SignInInputSchema>) {
    const user = await userRepository.findByEmail(input.email)

    if (!user || !user.password) {
      throw createTRPCError('UNAUTHORIZED', 'Неверный email или пароль.')
    }

    if (!user.emailVerified) {
      throw createTRPCError('UNAUTHORIZED', 'Пожалуйста, подтвердите ваш email перед входом.')
    }

    const isPasswordValid = await authUtils.passwords.verify(input.password, user.password)
    if (!isPasswordValid) {
      throw createTRPCError('UNAUTHORIZED', 'Неверный email или пароль.')
    }

    const { password, ...userWithoutPassword } = user
    const token = await authUtils.generateTokens({ id: user.id, email: user.email })

    return { user: userWithoutPassword, token }
  },

  async signOut(userId: string) {
    await authUtils.invalidateTokens(userId)
    return { ok: true }
  },

  async refresh(refreshToken: string) {
    try {
      const token = await authUtils.refreshTokens(refreshToken)
      return { token }
    }
    catch {
      throw createTRPCError('UNAUTHORIZED', 'Невалидный или истекший токен обновления.')
    }
  },

  async getById(id: string) {
    const user = await userRepository.getById(id)
    if (!user) {
      throw createTRPCError('NOT_FOUND', `Пользователь не найден.`)
    }
    return user
  },

  async getStats(id: string) {
    return await userRepository.getStats(id)
  },

  async update(id: string, data: z.infer<typeof UpdateUserInputSchema>) {
    if (Object.keys(data).length === 0) {
      throw createTRPCError('BAD_REQUEST', 'Не предоставлено полей для обновления.')
    }
    const updatedUser = await userRepository.update(id, data)

    if (!updatedUser) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', `Не удалось обновить пользователя.`)
    }
    return updatedUser
  },

  async updateStatus(id: string, data: { statusText?: string | null, statusEmoji?: string | null }) {
    const updatedUser = await userRepository.updateStatus(id, data)
    if (!updatedUser) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', `Не удалось обновить статус пользователя.`)
    }
    return updatedUser
  },

  async changePassword(id: string, data: z.infer<typeof ChangePasswordInputSchema>) {
    const newPasswordHash = await authUtils.passwords.hash(data.newPassword)
    const result = await userRepository.changePassword(id, data.currentPassword, newPasswordHash)
    if (!result) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось сменить пароль.')
    }
    return { success: true }
  },

  async setPassword(id: string, data: z.infer<typeof SetPasswordInputSchema>) {
    const newPasswordHash = await authUtils.passwords.hash(data.newPassword)
    await userRepository.setPassword(id, newPasswordHash)
    return { success: true }
  },

  async unlinkProvider(id: string, provider: 'google' | 'github' | 'telegram' | 'yandex') {
    return await userRepository.unlinkOAuthProvider(id, provider)
  },

  async initTelegramLink(userId: string) {
    return telegramAuthService.initLink(userId)
  },

  async checkTelegramLinkStatus(token: string, userId: string) {
    return await telegramAuthService.getLinkStatus(token, userId)
  },

  async deleteAccount(id: string, data: z.infer<typeof DeleteAccountInputSchema>) {
    await userRepository.delete(id, data.password)
    return { success: true }
  },

  async search(query: string) {
    if (!query || query.length < 2)
      return []
    return await userRepository.searchUsers(query)
  },

  async getHighlights(input: z.infer<typeof GetUserHighlightsInputSchema>) {
    return await highlightRepository.getByUserId(input)
  },

  async getHighlightCities(userId: string) {
    return await highlightRepository.getCitiesByUserId(userId)
  },

  async createHighlight(data: z.infer<typeof CreateHighlightInputSchema>, userId: string) {
    const resolution = data.geoPlaceId
      ? null
      : await geoRepository.resolveExact({ label: data.city, countryId: data.countryId, kinds: ['settlement'] })
    const placeId = data.geoPlaceId ?? resolution?.place?.id
    if (!placeId || (resolution && resolution.status !== 'resolved')) {
      const message = resolution?.status === 'needs_review'
        ? 'Название совпадает с несколькими городами. Выберите точный город из справочника.'
        : 'Выберите город из справочника для выбранной страны.'
      throw createTRPCError('BAD_REQUEST', message)
    }

    const [place] = await geoRepository.getByIds({ ids: [placeId], locale: 'ru' })
    const [selectableId] = await geoRepository.getSelectableIds([placeId])
    if (!place || !selectableId || place.kind !== 'settlement' || place.countryId !== data.countryId) {
      throw createTRPCError('BAD_REQUEST', 'Выберите город из справочника для выбранной страны.')
    }
    data = { ...data, geoPlaceId: place.id, city: place.name }

    const { takenAt, ...restData } = data
    const newHighlight = await highlightRepository.create({
      ...restData,
      takenAt: takenAt ? new Date(takenAt) : undefined,
      userId,
    })

    if (!newHighlight) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось сохранить фото в витрину.')
    }
    return newHighlight
  },

  async updateHighlight(input: z.infer<typeof UpdateHighlightInputSchema>, userId: string) {
    const { id, takenAt, ...data } = input
    const existing = await highlightRepository.getByIdForUser(id, userId)
    if (!existing)
      throw createTRPCError('NOT_FOUND', 'Фото не найдено или у вас нет прав на его редактирование.')

    const targetCountryId = data.countryId ?? existing.countryId
    const targetCity = data.city ?? existing.city
    const cityChanged = data.city !== undefined && data.city !== existing.city
    const countryChanged = data.countryId !== undefined && data.countryId !== existing.countryId
    let placeId = data.geoPlaceId ?? undefined

    if (!placeId && (cityChanged || countryChanged)) {
      const resolution = await geoRepository.resolveExact({ label: targetCity, countryId: targetCountryId, kinds: ['settlement'] })
      if (resolution.status !== 'resolved' || !resolution.place) {
        const message = resolution.status === 'needs_review'
          ? 'Название совпадает с несколькими городами. Выберите точный город из справочника.'
          : 'Город не найден в выбранной стране. Выберите город из справочника.'
        throw createTRPCError('BAD_REQUEST', message)
      }
      placeId = resolution.place.id
    }
    else if (!placeId && data.geoPlaceId === undefined && existing.geoPlaceId) {
      placeId = existing.geoPlaceId
    }
    else if (!placeId && data.geoPlaceId === null && targetCity.trim()) {
      throw createTRPCError('BAD_REQUEST', 'Выберите город из справочника.')
    }

    if (placeId) {
      const [place] = await geoRepository.getByIds({ ids: [placeId], locale: 'ru' })
      const [selectableId] = await geoRepository.getSelectableIds([placeId])
      if (!place || (!selectableId && place.id !== existing.geoPlaceId) || place.kind !== 'settlement' || place.countryId !== targetCountryId) {
        throw createTRPCError('BAD_REQUEST', 'Выберите город из справочника для выбранной страны.')
      }
      data.geoPlaceId = place.id
      data.city = place.name
      data.countryId = targetCountryId
    }

    const updated = await highlightRepository.update(id, userId, {
      ...data,
      ...(takenAt !== undefined && { takenAt: takenAt ? new Date(takenAt) : null }),
    })
    if (!updated)
      throw createTRPCError('NOT_FOUND', 'Фото не найдено или у вас нет прав на его редактирование.')
    return updated
  },

  async deleteHighlight(id: string, userId: string) {
    const deleted = await highlightRepository.delete(id, userId)
    if (!deleted) {
      throw createTRPCError('NOT_FOUND', 'Фото не найдено или у вас нет прав на его удаление.')
    }

    if (deleted.imageUrl) {
      try {
        await deleteFileWithVariants({
          url: deleted.imageUrl,
          variants: (deleted.variants as Record<string, string>) || {},
        })
      }
      catch (error) {
        console.error(`Ошибка при удалении файлов витрины ${id}:`, error)
      }
    }

    return { success: true }
  },
}
