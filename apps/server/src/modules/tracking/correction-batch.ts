import { TRPCError } from '@trpc/server'
import { db } from 'db'
import { trackActivityCorrections, trackPoints } from 'db/schema'
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { TrackActivityTypeSchema } from './tracking.schemas'

export const CorrectionDraftSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().min(4).max(64),
  startedAt: z.number().int().positive().max(8_640_000_000_000_000),
  endedAt: z.number().int().positive().max(8_640_000_000_000_000),
  activity: TrackActivityTypeSchema,
  point: z.boolean().optional(),
}).refine(c => (c.endedAt > c.startedAt || (c.point && c.endedAt === c.startedAt)) && c.endedAt - c.startedAt <= 86400000, 'Некорректный интервал')
export const CorrectionBatchSchema = z.object({
  tripId: z.string().uuid().optional(),
  dayUtc: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  additions: z.array(CorrectionDraftSchema).max(200),
  removals: z.array(z.string().uuid()).max(200),
}).refine(b => b.additions.length + b.removals.length > 0 && b.additions.length + b.removals.length <= 200, 'В пакете должно быть от 1 до 200 изменений')

export async function saveCorrectionBatch(userId: string, input: z.infer<typeof CorrectionBatchSchema>, enforceDay = true) {
  const from = Date.parse(`${input.dayUtc}T00:00:00Z`)
  const until = from + 86400000
  if (!Number.isFinite(from) || new Date(from).toISOString().slice(0, 10) !== input.dayUtc)
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Некорректный день' })
  const ids = input.additions.map(c => c.id)
  if (new Set(ids).size !== ids.length || input.removals.some(id => ids.includes(id)))
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Повторяющиеся идентификаторы правок' })
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`corrections:${userId}`}))`)
    const removed = input.removals.length ? await tx.select().from(trackActivityCorrections).where(and(eq(trackActivityCorrections.userId, userId), inArray(trackActivityCorrections.id, input.removals))) : []
    if (enforceDay && removed.some(c => c.startedAt.getTime() < from || c.endedAt.getTime() >= until))
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Исправление относится к другому дню' })
    const [latest] = await tx.select({ time: sql<Date | string | null>`max(${trackActivityCorrections.createdAt})` }).from(trackActivityCorrections).where(eq(trackActivityCorrections.userId, userId))
    let time = Math.max(Date.now(), latest.time ? new Date(latest.time).getTime() + 1 : 0)
    for (const correction of input.additions) {
      if (enforceDay && (correction.startedAt < from || correction.endedAt >= until))
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Все исправления должны относиться к выбранному дню' })
      const [existing] = await tx.select().from(trackActivityCorrections).where(eq(trackActivityCorrections.id, correction.id))
      if (existing) {
        if (existing.userId !== userId || existing.sessionId !== correction.sessionId || existing.startedAt.getTime() !== correction.startedAt || existing.endedAt.getTime() !== correction.endedAt || existing.activity !== correction.activity)
          throw new TRPCError({ code: 'CONFLICT', message: 'Исправление с таким ID уже существует' })
        continue
      }
      const [point] = await tx.select({ id: trackPoints.id }).from(trackPoints).where(and(eq(trackPoints.userId, userId), eq(trackPoints.sessionId, correction.sessionId), gte(trackPoints.tsUtc, new Date(correction.startedAt)), lte(trackPoints.tsUtc, new Date(correction.endedAt)))).limit(1)
      if (!point)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'В интервале нет GPS-точек этой записи' })
      await tx.insert(trackActivityCorrections).values({ ...correction, userId, startedAt: new Date(correction.startedAt), endedAt: new Date(correction.endedAt), createdAt: new Date(time++) })
    }
    if (input.removals.length)
      await tx.delete(trackActivityCorrections).where(and(eq(trackActivityCorrections.userId, userId), inArray(trackActivityCorrections.id, input.removals)))
    return { success: true }
  })
}
