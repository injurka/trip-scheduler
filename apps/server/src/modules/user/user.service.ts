import type { z } from 'zod'
import type {
  ChangePasswordInputSchema,
  DeleteAccountInputSchema,
  SignInInputSchema,
  SignUpInputSchema,
  UpdateUserInputSchema,
  UpdateUserStatusInputSchema,
  VerifyEmailInputSchema,
} from './user.schemas'
import { v4 as uuidv4 } from 'uuid'
import { db, toId } from '~/db'
import { authUtils } from '~/lib/auth.utils'
import { createTRPCError } from '~/lib/trpc'
import { userRepository } from '~/modules/user/user.repository'
import { emailService } from '~/services/email.service'

interface EmailToken {
  id: string
  email: string
  token: string
  name: string
  password: string // hashed
  expiresAt: string | Date
}

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

    await db.query(`
      BEGIN TRANSACTION;
      DELETE email_verification_token WHERE email = $email;
      CREATE $tokenId CONTENT {
        email: $email,
        token: $token,
        name: $name,
        password: $password,
        expiresAt: $expiresAt
      };
      COMMIT TRANSACTION;
    `, {
      email: input.email,
      tokenId: toId('email_verification_token', uuidv4()),
      token: verificationCode,
      name: input.name,
      password: hashedPassword,
      expiresAt,
    })

    await emailService.sendVerificationEmail(input.email, verificationCode)

    return { success: true, message: 'Код подтверждения отправлен на вашу почту.' }
  },

  async verifyEmail(input: z.infer<typeof VerifyEmailInputSchema>) {
    const [result] = await db.query<[EmailToken[]]>(`
      SELECT * FROM email_verification_token
      WHERE email = $email AND expiresAt > time::now()
      LIMIT 1
    `, { email: input.email })

    const verificationRecord = result?.[0]

    if (!verificationRecord || verificationRecord.token !== input.token) {
      throw createTRPCError('UNAUTHORIZED', 'Неверный или истекший код подтверждения.')
    }

    const existingUser = await userRepository.findByEmail(verificationRecord.email)
    if (existingUser && existingUser.emailVerified) {
      throw createTRPCError('CONFLICT', `Пользователь с таким email уже подтвержден.`)
    }

    let userId: string

    if (existingUser) {
      await db.merge(existingUser.id, {
        name: verificationRecord.name,
        password: verificationRecord.password,
        emailVerified: new Date(),
        updatedAt: new Date(),
      })
      userId = existingUser.id.toString()
    }
    else {
      const newUser = await userRepository.create({
        name: verificationRecord.name,
        email: verificationRecord.email,
        password: verificationRecord.password,
      })
      // userRepository.create возвращает UserForClient, но нам нужно явно проставить emailVerified
      await db.merge(toId('user', newUser.id), { emailVerified: new Date() })
      userId = newUser.id
    }

    await db.delete(verificationRecord.id)

    const fullUser = await userRepository.getById(userId)
    if (!fullUser)
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Ошибка при получении пользователя')

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

    const token = await authUtils.generateTokens({ id: user.id.toString(), email: user.email })

    // Преобразуем UserRecord в UserForClient
    // eslint-disable-next-line unused-imports/no-unused-vars
    const { password, id, plan, tripsCount, ...rest } = user as any

    // В findByEmail мы получали просто таблицу, там могло не быть tripsCount через SELECT
    // Но для signIn нам нужен tripsCount для UserForClient.
    // Проще вызвать getById, чтобы получить нормализованного пользователя
    const userForClient = await userRepository.getById(user.id.toString())
    if (!userForClient)
      throw createTRPCError('INTERNAL_SERVER_ERROR', 'Ошибка пользователя')

    return { user: userForClient, token }
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
      return this.getById(id)
    }
    const updatedUser = await userRepository.update(id, data)

    if (!updatedUser) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', `Не удалось обновить пользователя.`)
    }

    return updatedUser
  },

  async updateStatus(id: string, data: z.infer<typeof UpdateUserStatusInputSchema>) {
    const updatedUser = await userRepository.updateStatus(id, data)
    if (!updatedUser) {
      throw createTRPCError('INTERNAL_SERVER_ERROR', `Не удалось обновить статус пользователя.`)
    }
    return updatedUser
  },

  async changePassword(id: string, data: z.infer<typeof ChangePasswordInputSchema>) {
    const newPasswordHash = await authUtils.passwords.hash(data.newPassword)
    await userRepository.changePassword(id, data.currentPassword, newPasswordHash)
    return { success: true }
  },

  async deleteAccount(id: string, data: z.infer<typeof DeleteAccountInputSchema>) {
    await userRepository.delete(id, data.password)
    return { success: true }
  },
}
