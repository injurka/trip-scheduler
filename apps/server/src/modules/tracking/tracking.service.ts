import type { GetTrackDayInput, IngestBatchInput } from './tracking.schemas'
import { db } from 'db'
import { trackPoints, trackSegments } from 'db/schema'
import { and, eq, gte, lte } from 'drizzle-orm'

export const trackingService = {
  /**
   * Идемпотентный батч-ингест: дедуп по clientPointId (onConflictDoNothing).
   * Возвращает список clientPointId, реально записанных, — клиент помечает их synced.
   */
  async ingestBatch(userId: string, input: IngestBatchInput) {
    const rows = input.points.map(p => ({
      clientPointId: p.clientPointId,
      userId,
      sessionId: p.sessionId,
      tsUtc: new Date(Math.round(p.tsUtc)),
      lat: p.lat,
      lng: p.lng,
      altitude: p.altitude != null && Number.isFinite(p.altitude) ? p.altitude : null,
      accuracy: p.accuracy != null && Number.isFinite(p.accuracy) && p.accuracy >= 0 ? p.accuracy : null,
      speed: p.speed != null && Number.isFinite(p.speed) && p.speed >= 0 ? p.speed : null,
      bearing: p.bearing != null && Number.isFinite(p.bearing) ? (((p.bearing % 360) + 360) % 360) : null,
      activity: p.activity,
      activityConfidence: p.activityConfidence <= 1 && p.activityConfidence > 0
        ? Math.round(p.activityConfidence * 100)
        : Math.round(Math.min(100, Math.max(0, p.activityConfidence))),
    }))

    const accepted: string[] = []
    const CHUNK = 500
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      await db
        .insert(trackPoints)
        .values(chunk)
        .onConflictDoNothing({ target: trackPoints.clientPointId })
      accepted.push(...chunk.map(r => r.clientPointId))
    }

    return { accepted, rejectedCount: rows.length - accepted.length }
  },

  /** Точки дня (UTC) для «Воспоминаний дня». */
  async getDay(userId: string, input: GetTrackDayInput) {
    const from = new Date(`${input.dayUtc}T00:00:00Z`)
    const to = new Date(from.getTime() + 24 * 3600_000)

    const [points, segments] = await Promise.all([
      db
        .select({
          clientPointId: trackPoints.clientPointId,
          tsUtc: trackPoints.tsUtc,
          lat: trackPoints.lat,
          lng: trackPoints.lng,
          speed: trackPoints.speed,
          accuracy: trackPoints.accuracy,
          activity: trackPoints.activity,
          sessionId: trackPoints.sessionId,
        })
        .from(trackPoints)
        .where(and(
          eq(trackPoints.userId, userId),
          gte(trackPoints.tsUtc, from),
          lte(trackPoints.tsUtc, to),
        ))
        .orderBy(trackPoints.tsUtc),
      db
        .select()
        .from(trackSegments)
        .where(and(
          eq(trackSegments.userId, userId),
          lte(trackSegments.startedAt, to),
          gte(trackSegments.endedAt, from),
        ))
        .orderBy(trackSegments.startedAt),
    ])

    return {
      points: points.map(p => ({ ...p, tsUtc: p.tsUtc.getTime() })),
      segments: segments.map(s => ({
        id: s.id,
        sessionId: s.sessionId,
        activity: s.activity,
        confidence: s.confidence,
        startedAt: s.startedAt.getTime(),
        endedAt: s.endedAt.getTime(),
        distanceM: s.distanceM,
        pointCount: s.pointCount,
        geometry: s.geometry,
      })),
    }
  },

  /**
   * Пост-обработка дня: классификация сегментов + RDP. Вызывается клиентом
   * после успешного ингеста (пока без cron) — перезаписывает сегменты дня.
   */
  async reprocessDay(userId: string, sessionId: string, rawPoints: Array<{
    tsUtc: number
    lat: number
    lng: number
    speed: number | null
    activity: 'still' | 'walk' | 'bike' | 'vehicle' | 'rail' | 'unknown'
  }>) {
    if (rawPoints.length < 2)
      return { segments: 0 }

    // Алгоритм в общем пакете @injurka/track-processing (общий с клиентом)
    const { processDayTrack } = await import('@injurka/track-processing')

    const segments = processDayTrack(rawPoints.map((p, i) => ({
      clientPointId: `srv-${sessionId}-${i}`,
      tsUtc: p.tsUtc,
      lat: p.lat,
      lng: p.lng,
      altitude: null,
      accuracy: null,
      speed: p.speed,
      bearing: null,
      activity: p.activity,
      activityConfidence: 0,
      sessionId,
    })))

    await db.transaction(async (tx) => {
      await tx.delete(trackSegments).where(and(
        eq(trackSegments.userId, userId),
        eq(trackSegments.sessionId, sessionId),
      ))
      if (segments.length > 0) {
        await tx.insert(trackSegments).values(segments.map(s => ({
          userId,
          sessionId,
          activity: s.activity,
          confidence: s.confidence,
          startedAt: new Date(s.points[0].tsUtc),
          endedAt: new Date(s.points[s.points.length - 1].tsUtc),
          distanceM: s.features.distanceM,
          pointCount: s.points.length,
          geometry: s.points.map(p => [p.lng, p.lat] as [number, number]),
        })))
      }
    })

    return { segments: segments.length }
  },

  /**
   * Сводки подвижности по дням (последние N дней, UTC) для страницы «Активность».
   * Считается по сегментам (пост-обработка), fallback — по сырым точкам.
   */
  async getSummaries(userId: string, days: number) {
    const to = new Date()
    const from = new Date(to.getTime() - days * 24 * 3600_000)

    const segments = await db
      .select()
      .from(trackSegments)
      .where(and(
        eq(trackSegments.userId, userId),
        gte(trackSegments.startedAt, from),
        lte(trackSegments.endedAt, to),
      ))
      .orderBy(trackSegments.startedAt)

    // Группировка по UTC-дню
    const byDay = new Map<string, {
      activityMap: Map<string, { distanceM: number, durationMs: number, segmentCount: number }>
      firstPointTs: number | null
      lastPointTs: number | null
    }>()

    for (const s of segments) {
      const dayUtc = s.startedAt.toISOString().slice(0, 10)
      let entry = byDay.get(dayUtc)
      if (!entry) {
        entry = { activityMap: new Map(), firstPointTs: null, lastPointTs: null }
        byDay.set(dayUtc, entry)
      }
      const agg = entry.activityMap.get(s.activity) ?? { distanceM: 0, durationMs: 0, segmentCount: 0 }
      agg.distanceM += s.distanceM
      agg.durationMs += Math.max(0, s.endedAt.getTime() - s.startedAt.getTime())
      agg.segmentCount += 1
      entry.activityMap.set(s.activity, agg)

      const startTs = s.startedAt.getTime()
      const endTs = s.endedAt.getTime()
      if (entry.firstPointTs === null || startTs < entry.firstPointTs)
        entry.firstPointTs = startTs
      if (entry.lastPointTs === null || endTs > entry.lastPointTs)
        entry.lastPointTs = endTs
    }

    return Array.from(byDay.entries())
      .map(([dayUtc, entry]) => {
        const byActivity = Array.from(entry.activityMap.entries())
          .map(([activity, agg]) => ({ activity: activity as 'still' | 'walk' | 'bike' | 'vehicle' | 'rail' | 'unknown', ...agg }))
          .sort((a, b) => b.distanceM - a.distanceM)
        return {
          dayUtc,
          totalDistanceM: byActivity.reduce((s, a) => s + a.distanceM, 0),
          totalDurationMs: byActivity.reduce((s, a) => s + a.durationMs, 0),
          byActivity,
          firstPointTs: entry.firstPointTs,
          lastPointTs: entry.lastPointTs,
          hasData: true,
        }
      })
      .sort((a, b) => b.dayUtc.localeCompare(a.dayUtc))
  },
}
