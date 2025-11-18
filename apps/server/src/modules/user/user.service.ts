import type { z } from 'zod'
import type { ChangePasswordInputSchema, DeleteAccountInputSchema, SignInInputSchema, SignUpInputSchema, UpdateUserInputSchema, UpdateUserStatusInputSchema, VerifyEmailInputSchema } from './user.schemas'
import { and, eq, gte } from 'drizzle-orm'
import { db } from '~/../db'
import { emailVerificationTokens, users } from '~/../db/schema'
import { authUtils } from '~/lib/auth.utils'
import { createTRPCError } from '~/lib/trpc'
import { userRepository } from '~/repositories/user.repository'
import { emailService } from '~/services/email.service'

export const userService = {
  /**
   * Инициирует процесс регистрации: создает токен верификации и отправляет его на почту.
   */
  async signUp(input: z.infer<typeof SignUpInputSchema>) {
    const existingUser = await userRepository.findByEmail(input.email)
    if (existingUser && existingUser.emailVerified) {
      throw createTRPCError('CONFLICT', `Пользователь с таким email уже существует.`)
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const hashedPassword = await authUtils.passwords.hash(input.password)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 минут

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

  /**
   * Проверяет код верификации и завершает регистрацию пользователя.
   */
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
      email: verificationRecord.email,
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

  /**
   * Аутентифицирует пользователя по email и паролю.
   */
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

  /**
   * Аннулирует все токены пользователя.
   */
  async signOut(userId: string) {
    await authUtils.invalidateTokens(userId)

    return { ok: true }
  },

  /**
   * Обновляет пару токенов, используя refresh-токен.
   */
  async refresh(refreshToken: string) {
    try {
      const token = await authUtils.refreshTokens(refreshToken)
      return { token }
    }
    catch {
      throw createTRPCError('UNAUTHORIZED', 'Невалидный или истекший токен обновления.')
    }
  },

  /**
   * Получает информацию о пользователе по его ID.
   */
  async getById(id: string) {
    const user = await userRepository.getById(id)
    if (!user) {
      throw createTRPCError('NOT_FOUND', `Пользователь не найден.`)
    }

    return user
  },

  /**
   * Получает статистику пользователя.
   */
  async getStats(id: string) {
    return await userRepository.getStats(id)
  },

  /**
   * Обновляет информацию о пользователе.
   */
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

  /**
   * Обновляет статус пользователя.
   */
  async updateStatus(id: string, data: z.infer<typeof UpdateUserStatusInputSchema>) {
    const updatedUser = await userRepository.updateStatus(id, data)
    if (!updatedUser) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', `Не удалось обновить статус пользователя.`)
    }
    return updatedUser
  },

  /**
   * Изменяет пароль пользователя.
   */
  async changePassword(id: string, data: z.infer<typeof ChangePasswordInputSchema>) {
    const newPasswordHash = await authUtils.passwords.hash(data.newPassword)
    const result = await userRepository.changePassword(id, data.currentPassword, newPasswordHash)
    if (!result) {
      // Ошибка будет выброшена из репозитория, но на всякий случай
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось сменить пароль.')
    }
    return { success: true }
  },

  /**
   * Удаляет аккаунт пользователя.
   */
  async deleteAccount(id: string, data: z.infer<typeof DeleteAccountInputSchema>) {
    await userRepository.delete(id, data.password)
    return { success: true }
  },
}
