import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import type { users } from 'db/schema'
import type { Context } from 'hono'
import { initTRPC, TRPCError } from '@trpc/server'
import { db } from '~/../db'
import { trpcRequestCounter, trpcRequestDurationHistogram } from '~/services/metrics.service'
import { authUtils } from './auth.utils'

export async function createContext(_: FetchCreateContextFnOptions, c: Context) {
  const req = c.req
  const token = req.header('authorization')?.split(' ')[1]

  if (!token) {
    return { user: null, db, c }
  }

  const payload = await authUtils.verifyToken(token)
  if (!payload) {
    return { user: null, db, c }
  }

  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, payload.id),
    with: {
      plan: true,
    },
  })

  return { user, db, c }
}

type AppContext = Awaited<ReturnType<typeof createContext>>

// Инициализация tRPC с новым контекстом
const t = initTRPC
  .context<AppContext>()
  .create({
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          code: error.code,
          httpStatus: shape.data.httpStatus,
          stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
        },
      }
    },
  })

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
  }
  return next({
    ctx: {
      user: ctx.user as typeof users.$inferSelect & { plan: any }, // Типизация теперь соответствует реальности
      db: ctx.db,
      c: ctx.c,
    },
  })
})

// Middleware для сбора метрик
const metricsMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now()
  const result = await next()
  const duration = (Date.now() - start) / 1000

  const status = result.ok ? 'success' : 'error'

  trpcRequestDurationHistogram.observe({ path, type, status }, duration)
  trpcRequestCounter.inc({ path, type, status })

  return result
})

// Экспорт роутеров и процедур
export const router = t.router
export const mergeRouters = t.mergeRouters
export const publicProcedure = t.procedure.use(metricsMiddleware)
export const protectedProcedure = t.procedure.use(isAuthed).use(metricsMiddleware)

// Вспомогательная функция для создания tRPC ошибок
export function createTRPCError(code: 'NOT_FOUND' | 'BAD_REQUEST' | 'INTERNAL_SERVER_ERROR' | 'CONFLICT' | 'UNAUTHORIZED' | 'FORBIDDEN', message: string) {
  throw new TRPCError({
    code,
    message,
  })
}

export { t }
