import type { RefreshToken, User } from '~/modules/user/user.types'
import { TRPCError } from '@trpc/server'
import { sign, verify } from 'hono/jwt'
import { v4 as uuidv4 } from 'uuid'
import { db, toId } from '~/db'

interface AccessTokenPayload {
  id: string
  email: string
}

const ACCESS_TOKEN_EXPIRY = 60 * 15 * 24 * 1 // 1 день
const REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 14 // 14 дней

const JWT_SECRET = process.env.JWT_SECRET!
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET не определен в переменных окружения.')
}

function cleanId(id: string): string {
  return id.includes(':') ? id.split(':')[1] : id
}

export const passwordUtils = {
  hash: async (password: string) => await Bun.password.hash(password),
  verify: async (password: string, hash: string) => await Bun.password.verify(password, hash),
}

async function generateTokens(user: { id: string, email: string }) {
  const accessTokenPayload: AccessTokenPayload = {
    id: cleanId(user.id),
    email: user.email,
  }

  const accessToken = await sign(
    { ...accessTokenPayload, exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY },
    JWT_SECRET,
  )

  const tokenString = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000)
  const recordId = toId('refresh_token', uuidv4())
  const userRecordId = toId('user', user.id)

  await db.create(recordId, {
    id: recordId,
    token: tokenString,
    userId: userRecordId,
    expiresAt,
    createdAt: new Date(),
  })

  return { accessToken, refreshToken: tokenString }
}

async function refreshUserTokens(token: string) {
  // [0] - результат первого SELECT
  const [result] = await db.query<[RefreshToken[]]>(`
    SELECT * FROM refresh_token WHERE token = $token LIMIT 1
  `, { token })

  const storedToken = result?.[0]

  if (!storedToken || new Date(storedToken.expiresAt) < new Date()) {
    if (storedToken) {
      await db.query(`DELETE refresh_token WHERE userId = $userId`, { userId: storedToken.userId })
    }
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Невалидный или истекший refresh-токен.' })
  }

  // Ротация
  await db.delete(storedToken.id)

  let user: User | undefined
  try {
    // Получаем пользователя, используя userId из токена
    user = await db.select(storedToken.userId) as unknown as User
  }
  catch {
    // User not found
  }

  if (!user) {
    await db.query(`DELETE refresh_token WHERE userId = $userId`, { userId: storedToken.userId })
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Пользователь для токена не найден.' })
  }

  // Приводим ID к строке перед генерацией токенов
  return generateTokens({ id: user.id.toString(), email: user.email })
}

async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const payload = await verify(token, JWT_SECRET)
    return payload as unknown as AccessTokenPayload
  }
  catch {
    return null
  }
}

async function invalidateUserTokens(userId: string) {
  const userRecordId = toId('user', userId)
  await db.query(`DELETE refresh_token WHERE userId = $uid`, { uid: userRecordId })
}

export const authUtils = {
  passwords: passwordUtils,
  generateTokens,
  refreshTokens: refreshUserTokens,
  invalidateTokens: invalidateUserTokens,
  verifyToken: verifyAccessToken,
}
