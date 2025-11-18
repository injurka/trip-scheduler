import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { sign, verify } from 'hono/jwt'
import { db } from '~/../db'
import { refreshTokens, users } from '~/../db/schema'

interface AccessTokenPayload {
  id: string
  email: string
}

// Время жизни токенов в секундах
const ACCESS_TOKEN_EXPIRY = 60 * 15 * 24 * 1 // 1 день
const REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 14 // 14 дней

const JWT_SECRET = process.env.JWT_SECRET!
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET не определен в переменных окружения. Это критическая ошибка.')
}

/**
 * Утилиты для работы с паролями.
 */
export const passwordUtils = {
  hash: async (password: string) => await Bun.password.hash(password),
  verify: async (password: string, hash: string) => await Bun.password.verify(password, hash),
}

async function generateTokens(user: { id: string, email: string }) {
  // 1. Создаем Access Token с коротким сроком жизни
  const accessTokenPayload: AccessTokenPayload = { id: user.id, email: user.email }
  const accessToken = await sign(
    { ...accessTokenPayload, exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY },
    JWT_SECRET,
  )

  // 2. Создаем Refresh Token (уникальная строка)
  const refreshToken = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000)

  // 3. Сохраняем Refresh Token в БД
  await db.insert(refreshTokens).values({
    token: refreshToken,
    userId: user.id,
    expiresAt,
  })

  return { accessToken, refreshToken }
}

/**
 * Обновляет пару токенов, используя refresh token.
 * Применяет стратегию ротации refresh токенов для повышения безопасности.
 * @param token - Строка refresh token.
 * @returns Новую пару токенов { accessToken: string, refreshToken: string }.
 */
async function refreshUserTokens(token: string) {
  // 1. Ищем токен в БД
  const storedToken = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.token, token),
  })

  // 2. Валидация токена
  if (!storedToken || storedToken.expiresAt < new Date()) {
    // Если токен не найден или истек, удаляем все токены этого пользователя для безопасности
    if (storedToken) {
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, storedToken.userId))
    }
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Невалидный или истекший refresh-токен.' })
  }

  // 3. Ротация: Удаляем старый токен сразу после использования
  await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id))

  // 4. Находим пользователя, чтобы сгенерировать новый токен
  const user = await db.query.users.findFirst({
    where: eq(users.id, storedToken.userId),
  })

  if (!user) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Пользователь для токена не найден.' })
  }

  // 5. Генерируем и возвращаем новую пару токенов
  return generateTokens(user)
}

/**
 * Проверяет (декодирует) access token.
 * @param token - Строка access token.
 * @returns Полезную нагрузку токена или null, если токен невалиден.
 */
async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    // `verify` выбрасывает ошибку, если токен невалиден (истек, подпись неверна)
    const payload = await verify(token, JWT_SECRET)

    // Используем `as unknown as Type` для безопасного приведения типов,
    // так как мы уверены в структуре, которую сами же и создали в `sign`.
    return payload as unknown as AccessTokenPayload
  }
  catch (error) {
    console.error('Ошибка верификации Access Token:', error)
    return null
  }
}

/**
 * Аннулирует все refresh токены для конкретного пользователя (используется при выходе).
 * @param userId - ID пользователя.
 */
async function invalidateUserTokens(userId: string) {
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId))
}

export const authUtils = {
  passwords: passwordUtils,
  generateTokens,
  refreshTokens: refreshUserTokens,
  invalidateTokens: invalidateUserTokens,
  verifyToken: verifyAccessToken,
}
