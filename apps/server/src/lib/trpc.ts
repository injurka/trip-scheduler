import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import type { Context } from 'hono'
import type { OpenApiMeta } from 'trpc-to-openapi'
import type { User } from '~/modules/user/user.types'
import { initTRPC, TRPCError } from '@trpc/server'
import { db, toId } from '~/db'
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

  try {
    const userId = toId('user', payload.id)
    const [result] = await db.query<[User[]]>(`SELECT * FROM ${userId}`)
    const user = result?.[0]

    return { user, db, c }
  }
  catch (e) {
    console.error('Context creation DB error', e)
    return { user: null, db, c }
  }
}

type AppContext = Awaited<ReturnType<typeof createContext>>

const t = initTRPC
  .context<AppContext>()
  .meta<OpenApiMeta>()
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
      user: ctx.user,
      db: ctx.db,
      c: ctx.c,
    },
  })
})

const metricsMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now()
  const result = await next()
  const duration = (Date.now() - start) / 1000
  const status = result.ok ? 'success' : 'error'

  trpcRequestDurationHistogram.observe({ path, type, status }, duration)
  trpcRequestCounter.inc({ path, type, status })

  return result
})

export const router = t.router
export const mergeRouters = t.mergeRouters
export const publicProcedure = t.procedure.use(metricsMiddleware)
export const protectedProcedure = t.procedure.use(isAuthed).use(metricsMiddleware)

export function createTRPCError(code: 'NOT_FOUND' | 'BAD_REQUEST' | 'INTERNAL_SERVER_ERROR' | 'CONFLICT' | 'UNAUTHORIZED' | 'FORBIDDEN', message: string) {
  throw new TRPCError({ code, message })
}

export { t }
