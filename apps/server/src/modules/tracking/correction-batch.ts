import { calendarDayBounds, inspectTrackGeometry, trackGeometryActions, trackGeometryContextMs } from '@limiteddissolve/track-processing'
import { TRPCError } from '@trpc/server'
import { db } from 'db'
import { trackActivityCorrections, trackPoints } from 'db/schema'
import { and, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { TrackActivityTypeSchema, TrackingTimeZoneSchema } from './tracking.schemas'

export const CorrectionDraftSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().min(4).max(64),
  startedAt: z.number().int().positive().max(8_640_000_000_000_000),
  endedAt: z.number().int().positive().max(8_640_000_000_000_000),
  activity: TrackActivityTypeSchema,
  point: z.boolean().optional(),
  geometryAction: z.enum(trackGeometryActions).nullable().optional(),
}).refine(c => (c.endedAt > c.startedAt || (c.point && c.endedAt === c.startedAt)) && c.endedAt - c.startedAt <= (c.geometryAction ? 300_000 : 26 * 3600_000), 'Некорректный интервал').refine(c => c.geometryAction !== 'exclude-manual' || c.startedAt === c.endedAt, 'Исключить можно только одну точку')
export const CorrectionBatchSchema = z.object({
  tripId: z.string().uuid().optional(),
  dayUtc: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeZone: TrackingTimeZoneSchema.optional(),
  additions: z.array(CorrectionDraftSchema).max(200),
  removals: z.array(z.string().uuid()).max(200),
}).refine(b => b.additions.length + b.removals.length > 0 && b.additions.length + b.removals.length <= 200, 'В пакете должно быть от 1 до 200 изменений')

export async function saveCorrectionBatch(userId: string, input: z.infer<typeof CorrectionBatchSchema>, enforceDay = true) {
  const bounds = calendarDayBounds(input.dayUtc, input.timeZone)
  const from = bounds.from.getTime()
  const until = bounds.to.getTime()
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
        if (existing.userId !== userId || existing.sessionId !== correction.sessionId || existing.startedAt.getTime() !== correction.startedAt || existing.endedAt.getTime() !== correction.endedAt || existing.activity !== correction.activity || (existing.geometryAction ?? null) !== (correction.geometryAction ?? null))
          throw new TRPCError({ code: 'CONFLICT', message: 'Исправление с таким ID уже существует' })
        continue
      }
      const [point] = await tx.select({ id: trackPoints.id }).from(trackPoints).where(and(eq(trackPoints.userId, userId), eq(trackPoints.sessionId, correction.sessionId), gte(trackPoints.tsUtc, new Date(correction.startedAt)), lte(trackPoints.tsUtc, new Date(correction.endedAt)))).limit(1)
      if (!point)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'В интервале нет GPS-точек этой записи' })
      if (correction.geometryAction) {
        if (correction.geometryAction === 'exclude-manual') {
          const matches = await tx.select({ id: trackPoints.id }).from(trackPoints).where(and(
            eq(trackPoints.userId, userId),
            eq(trackPoints.sessionId, correction.sessionId),
            eq(trackPoints.tsUtc, new Date(correction.startedAt)),
          )).limit(2)
          if (matches.length !== 1)
            throw new TRPCError({ code: 'CONFLICT', message: 'В это время записано несколько точек GPS.' })
        }
        else {
          const context = await tx.select().from(trackPoints).where(and(
            eq(trackPoints.userId, userId),
            eq(trackPoints.sessionId, correction.sessionId),
            gte(trackPoints.tsUtc, new Date(Math.max(from, correction.startedAt - trackGeometryContextMs))),
            lte(trackPoints.tsUtc, new Date(Math.min(until - 1, correction.endedAt + trackGeometryContextMs))),
          )).orderBy(trackPoints.tsUtc)
          const result = inspectTrackGeometry(context.map(p => ({ ...p, tsUtc: p.tsUtc.getTime() })), correction.startedAt, correction.endedAt)
          if (result?.action !== correction.geometryAction)
            throw new TRPCError({ code: 'CONFLICT', message: 'Точки участка изменились. Проверьте участок ещё раз.' })
        }
        const overlapping = await tx.select({ id: trackActivityCorrections.id }).from(trackActivityCorrections).where(and(
          eq(trackActivityCorrections.userId, userId),
          eq(trackActivityCorrections.sessionId, correction.sessionId),
          isNotNull(trackActivityCorrections.geometryAction),
          lte(trackActivityCorrections.startedAt, new Date(correction.endedAt)),
          gte(trackActivityCorrections.endedAt, new Date(correction.startedAt)),
        ))
        if (overlapping.some(entry => !input.removals.includes(entry.id)))
          throw new TRPCError({ code: 'CONFLICT', message: 'Для этого участка уже сохранена правка GPS.' })
      }
      await tx.insert(trackActivityCorrections).values({ ...correction, userId, startedAt: new Date(correction.startedAt), endedAt: new Date(correction.endedAt), createdAt: new Date(time++) })
    }
    if (input.removals.length)
      await tx.delete(trackActivityCorrections).where(and(eq(trackActivityCorrections.userId, userId), inArray(trackActivityCorrections.id, input.removals)))
    return { success: true }
  })
}
