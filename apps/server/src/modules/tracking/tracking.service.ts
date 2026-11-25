import type { TrackActivityType } from '@limiteddissolve/track-processing'
import type { GetTrackDayInput, IngestBatchInput } from './tracking.schemas'
import { annotateTrackPoints, applyActivityCorrections, applyTrackGeometryCorrections, calendarDay, calendarDayBounds, hasAcceptableTrackPointAccuracy, MAX_ACCURACY_M, processDayTrack } from '@limiteddissolve/track-processing'
import { TRPCError } from '@trpc/server'
import { db } from 'db'
import { trackActivityCorrections, trackPoints, trackSegments } from 'db/schema'
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import tzLookup from 'tz-lookup'
import { measureDbQuery } from '~/lib/db-monitoring'
import { saveCorrectionBatch } from './correction-batch'

/** Активность в терминах пакета @limiteddissolve/track-processing. */
type TrackActivity = TrackActivityType

/** Строка track_points в объёме, который нужен пост-обработке дня. */
interface ReprocessSourceRow {
  tsUtc: Date
  lat: number
  lng: number
  speed: number | null
  activity: TrackActivity
  accuracy: number | null
  deviceActivity: TrackActivity | null
  deviceActivityConfidence: number | null
}

/**
 * Проекция строки точки во вход пост-обработки. Все вызовы reprocessDay идут через неё:
 * раньше серверная переобработка отдавала пакету accuracy: null, поэтому шумовой шлюз
 * (смещение меньше погрешности GPS — не движение) не работал вовсе, и день на сервере
 * классифицировался иначе, чем живой трек на устройстве.
 */
function toReprocessPoint(p: ReprocessSourceRow) {
  return {
    tsUtc: p.tsUtc.getTime(),
    lat: p.lat,
    lng: p.lng,
    speed: p.speed,
    activity: p.activity,
    accuracy: p.accuracy,
    deviceActivity: p.deviceActivity,
    deviceActivityConfidence: p.deviceActivityConfidence,
  }
}

async function getCorrections(userId: string, from: Date, to: Date) {
  const rows = await measureDbQuery('track_activity_corrections', 'select', () => db.select()
    .from(trackActivityCorrections)
    .where(and(eq(trackActivityCorrections.userId, userId), lt(trackActivityCorrections.startedAt, to), gte(trackActivityCorrections.endedAt, from)))
    .orderBy(trackActivityCorrections.createdAt, trackActivityCorrections.id))
  return rows.map(row => ({ id: row.id, sessionId: row.sessionId, startedAt: row.startedAt.getTime(), endedAt: row.endedAt.getTime(), activity: row.activity, geometryAction: row.geometryAction, createdAt: row.createdAt.getTime() }))
}

async function processRecordedDay(userId: string, input: GetTrackDayInput) {
  let timeZone = input.timeZone
  if (!timeZone) {
    // Inspect nearby measurements, including the UTC evening before an eastern local day.
    const noon = Date.parse(`${input.dayUtc}T12:00:00Z`)
    const nearby = await measureDbQuery('track_points', 'select', () => db.select({ lat: trackPoints.lat, lng: trackPoints.lng }).from(trackPoints).where(and(eq(trackPoints.userId, userId), gte(trackPoints.tsUtc, new Date(noon - 36 * 3600_000)), lt(trackPoints.tsUtc, new Date(noon + 36 * 3600_000)))).orderBy(sql`abs(extract(epoch from ${trackPoints.tsUtc}) * 1000 - ${noon})`).limit(1))
    timeZone = nearby[0] ? tzLookup(nearby[0].lat, nearby[0].lng) : 'UTC'
  }
  const { from, to } = calendarDayBounds(input.dayUtc, timeZone)

  const points = await measureDbQuery('track_points', 'select', async () => db.select()
    .from(trackPoints)
    .where(and(eq(trackPoints.userId, userId), gte(trackPoints.tsUtc, from), lt(trackPoints.tsUtc, to)))
    .orderBy(trackPoints.tsUtc))
  const raw = points.filter(hasAcceptableTrackPointAccuracy).map(p => ({ ...p, tsUtc: p.tsUtc.getTime() }))
  // Compute from original measurements on read: historical days immediately use the current algorithm.
  const corrections = await getCorrections(userId, from, to)
  const effective = applyTrackGeometryCorrections(raw, corrections)
  const segments = applyActivityCorrections(processDayTrack(effective), corrections, effective)
  return { timeZone, raw, effective, corrections, segments }
}

const pendingTrackDays = new Map<string, ReturnType<typeof processRecordedDay>>()
const daySummaryCache = new Map<string, { signature: string, summary: ReturnType<typeof summarizeTrackDay> }>()

function invalidateUserSummaryCache(userId: string) {
  const prefix = `${userId}:`
  for (const key of daySummaryCache.keys()) {
    if (key.startsWith(prefix))
      daySummaryCache.delete(key)
  }
}

function processedDay(userId: string, input: GetTrackDayInput) {
  const key = JSON.stringify([userId, input.dayUtc, input.timeZone])
  const existing = pendingTrackDays.get(key)
  if (existing)
    return existing

  const pending = processRecordedDay(userId, input).finally(() => pendingTrackDays.delete(key))
  pendingTrackDays.set(key, pending)
  return pending
}

function summarizeTrackDay(dayUtc: string, raw: { tsUtc: number }[], segments: ReturnType<typeof processDayTrack>) {
  const activityMap = new Map<TrackActivity, { distanceM: number, durationMs: number, segmentCount: number }>()
  for (const segment of segments) {
    const totals = activityMap.get(segment.activity) ?? { distanceM: 0, durationMs: 0, segmentCount: 0 }
    totals.distanceM += segment.features.distanceM
    totals.durationMs += segment.features.durationMs
    totals.segmentCount++
    activityMap.set(segment.activity, totals)
  }

  const byActivity = Array.from(activityMap, ([activity, totals]) => ({ activity, ...totals }))
    .sort((a, b) => b.distanceM - a.distanceM)
  return {
    dayUtc,
    totalDistanceM: byActivity.reduce((sum, activity) => sum + activity.distanceM, 0),
    totalDurationMs: byActivity.reduce((sum, activity) => sum + activity.durationMs, 0),
    byActivity,
    firstPointTs: raw[0]?.tsUtc ?? null,
    lastPointTs: raw.at(-1)?.tsUtc ?? null,
    hasData: raw.length > 0,
  }
}

export const trackingService = {
  /**
   * Идемпотентный батч-ингест: дедуп по clientPointId (onConflictDoNothing).
   * Возвращает список clientPointId, реально записанных, — клиент помечает их synced.
   */
  async ingestBatch(userId: string, input: IngestBatchInput, options: { materializeSegments?: boolean } = {}) {
    if (input.ownerId && input.ownerId !== userId)
      throw new TRPCError({ code: 'FORBIDDEN', message: 'GPS-очередь принадлежит другому аккаунту' })
    const accepted: string[] = []
    const validPoints = input.points.filter((p) => {
      const validAccuracy = p.accuracy == null || (Number.isFinite(p.accuracy) && p.accuracy >= 0 && p.accuracy <= MAX_ACCURACY_M)
      if (!validAccuracy)
        accepted.push(p.clientPointId)
      return validAccuracy
    })
    const rows = validPoints.map(p => ({
      samplingIntervalMs: p.samplingIntervalMs ?? null,
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
      deviceActivity: p.deviceActivity ?? null,
      deviceActivityConfidence: p.deviceActivityConfidence == null
        ? null
        : Math.round(Math.min(100, Math.max(0, p.deviceActivityConfidence))),
    }))

    const CHUNK = 500
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      const confirmed = await measureDbQuery('track_points', 'insert', () => db.transaction(async (tx) => {
        await tx.insert(trackPoints).values(chunk).onConflictDoNothing({ target: trackPoints.clientPointId })
        // A retry after a lost response is acknowledged only for this user's rows.
        return tx.select({ clientPointId: trackPoints.clientPointId }).from(trackPoints).where(and(eq(trackPoints.userId, userId), inArray(trackPoints.clientPointId, chunk.map(row => row.clientPointId))))
      }))
      accepted.push(...confirmed.map(row => row.clientPointId))
    }

    // Reads process current raw data on demand; avoid reclassifying an entire multi-day
    // session and rewriting unused track_segments on every ingested batch unless explicitly requested.
    if (options.materializeSegments !== true)
      return { accepted, rejectedCount: input.points.length - accepted.length }

    // Автоматическая генерация сегментов для поступивших сессий
    try {
      const sessionIds = Array.from(new Set(rows.map(r => r.sessionId)))
      for (const sId of sessionIds) {
        const sessionPoints = await db
          .select({
            tsUtc: trackPoints.tsUtc,
            lat: trackPoints.lat,
            lng: trackPoints.lng,
            speed: trackPoints.speed,
            accuracy: trackPoints.accuracy,
            activity: trackPoints.activity,
            deviceActivity: trackPoints.deviceActivity,
            deviceActivityConfidence: trackPoints.deviceActivityConfidence,
          })
          .from(trackPoints)
          .where(and(
            eq(trackPoints.userId, userId),
            eq(trackPoints.sessionId, sId),
          ))
          .orderBy(trackPoints.tsUtc)

        if (sessionPoints.length >= 2) {
          await trackingService.reprocessDay(userId, sId, sessionPoints.map(toReprocessPoint))
        }
      }
    }
    catch (e) {
      console.warn('[Tracking] Ошибка авто-генерации сегментов при ингесте:', e)
    }

    return { accepted, rejectedCount: input.points.length - accepted.length }
  },

  /** Точки календарного дня для «Воспоминаний дня». */
  async getDay(userId: string, input: GetTrackDayInput) {
    const { timeZone, raw, effective, corrections, segments } = await processedDay(userId, input)
    return {
      ownerId: userId,
      timeZone,
      corrections,
      points: annotateTrackPoints(effective, segments, corrections),
      rawPoints: effective === raw ? undefined : annotateTrackPoints(raw, segments, corrections),
      segments: segments.map((s, i) => ({
        id: `processed-${i}`,
        sessionId: s.points[0].sessionId,
        activity: s.activity,
        confidence: s.confidence,
        activitySource: s.activitySource ?? 'automatic' as const,
        simplifiedPoints: s.points.map(p => ({ tsUtc: p.tsUtc, lat: p.lat, lng: p.lng })),
        startedAt: s.points[0].tsUtc,
        endedAt: s.points[s.points.length - 1].tsUtc,
        distanceM: s.features.distanceM,
        pointCount: s.points.length,
        geometry: s.points.map(p => [p.lng, p.lat] as [number, number]),
      })),
    }
  },

  async getDaySummary(userId: string, input: GetTrackDayInput) {
    const { raw, segments, timeZone } = await processedDay(userId, input)
    return { summary: summarizeTrackDay(input.dayUtc, raw, segments), timeZone }
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
    activity: TrackActivity
    /** Погрешность фикса: без неё шумовой шлюз пакета не работает (смещение в пределах погрешности — не движение). */
    accuracy: number | null
    /** Сигнал системного Activity Recognition — независимое от GPS свидетельство. */
    deviceActivity: TrackActivity | null
    deviceActivityConfidence: number | null
  }>) {
    if (rawPoints.length < 2)
      return { segments: 0 }

    // Алгоритм в общем пакете @limiteddissolve/track-processing (общий с клиентом)
    const { processDayTrack } = await import('@limiteddissolve/track-processing')

    const segments = processDayTrack(rawPoints.map((p, i) => ({
      clientPointId: `srv-${sessionId}-${i}`,
      tsUtc: p.tsUtc,
      lat: p.lat,
      lng: p.lng,
      altitude: null,
      accuracy: p.accuracy,
      speed: p.speed,
      bearing: null,
      activity: p.activity,
      activityConfidence: 0,
      deviceActivity: p.deviceActivity,
      deviceActivityConfidence: p.deviceActivityConfidence,
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
   * Сводки подвижности по дням (последние N календарных дней) для страницы «Активность».
   * Использует предвычисленные границы дней (без вызовов Intl на каждой точке) и кеширует
   * рассчитанные исторические дни по отпечатку точек и правок.
   */
  async getSummaries(userId: string, days: number, timeZone = 'UTC') {
    const today = calendarDay(Date.now(), timeZone)
    const dayRanges: Array<{ dayUtc: string, fromMs: number, toMs: number }> = []
    for (let offset = days - 1; offset >= 0; offset--) {
      const d = new Date(`${today}T12:00:00Z`)
      d.setUTCDate(d.getUTCDate() - offset)
      const dayUtc = d.toISOString().slice(0, 10)
      const bounds = calendarDayBounds(dayUtc, timeZone)
      dayRanges.push({ dayUtc, fromMs: bounds.from.getTime(), toMs: bounds.to.getTime() })
    }
    const from = new Date(dayRanges[0]!.fromMs)
    const to = new Date(dayRanges.at(-1)!.toMs)

    const [rawPoints, corrections] = await Promise.all([
      measureDbQuery('track_points', 'select', async () => db.select({
        clientPointId: trackPoints.clientPointId,
        sessionId: trackPoints.sessionId,
        tsUtc: trackPoints.tsUtc,
        lat: trackPoints.lat,
        lng: trackPoints.lng,
        accuracy: trackPoints.accuracy,
        speed: trackPoints.speed,
        activity: trackPoints.activity,
        deviceActivity: trackPoints.deviceActivity,
        deviceActivityConfidence: trackPoints.deviceActivityConfidence,
      })
        .from(trackPoints)
        .where(and(eq(trackPoints.userId, userId), gte(trackPoints.tsUtc, from), lt(trackPoints.tsUtc, to)))
        .orderBy(trackPoints.tsUtc)),
      getCorrections(userId, from, to),
    ])

    const daysOfPoints = new Map<string, typeof rawPoints>()
    let rangeIdx = 0
    for (const p of rawPoints) {
      if (p.accuracy != null && (!Number.isFinite(p.accuracy) || p.accuracy < 0 || p.accuracy > MAX_ACCURACY_M))
        continue
      const ts = p.tsUtc.getTime()
      while (rangeIdx < dayRanges.length - 1 && ts >= dayRanges[rangeIdx]!.toMs)
        rangeIdx++
      const currentRange = dayRanges[rangeIdx]
      const day = (currentRange && ts >= currentRange.fromMs && ts < currentRange.toMs)
        ? currentRange.dayUtc
        : calendarDay(ts, timeZone)
      let list = daysOfPoints.get(day)
      if (!list) {
        list = []
        daysOfPoints.set(day, list)
      }
      list.push(p)
    }

    const rangeByDay = new Map(dayRanges.map(r => [r.dayUtc, r]))
    return Array.from(daysOfPoints, ([day, points]) => {
      const range = rangeByDay.get(day) ?? (() => {
        const b = calendarDayBounds(day, timeZone)
        return { dayUtc: day, fromMs: b.from.getTime(), toMs: b.to.getTime() }
      })()
      const dayCorrections = corrections.filter(c => c.startedAt < range.toMs && c.endedAt >= range.fromMs)
      const corrSig = dayCorrections.map(c => `${c.id}:${c.startedAt}:${c.endedAt}:${c.activity}:${c.geometryAction ?? ''}`).join('|')
      const first = points[0]!
      const last = points.at(-1)!
      const mid = points[points.length >> 1]!
      const signature = `${points.length}:${first.tsUtc.getTime()}:${first.lat}:${first.lng}:${mid.tsUtc.getTime()}:${last.tsUtc.getTime()}:${last.lat}:${last.lng}:${corrSig}`
      const cacheKey = `${userId}:${timeZone}:${day}`
      const cached = daySummaryCache.get(cacheKey)
      if (cached && cached.signature === signature) {
        daySummaryCache.delete(cacheKey)
        daySummaryCache.set(cacheKey, cached)
        return cached.summary
      }

      const raw = points.map(p => ({
        ...p,
        tsUtc: p.tsUtc.getTime(),
        altitude: null,
        bearing: null,
        activityConfidence: 0,
      }))
      const effective = applyTrackGeometryCorrections(raw, dayCorrections)
      const segments = applyActivityCorrections(processDayTrack(effective), dayCorrections, effective)
      const summary = summarizeTrackDay(day, raw, segments)

      if (daySummaryCache.size >= 2000) {
        const oldestKey = daySummaryCache.keys().next().value
        if (oldestKey)
          daySummaryCache.delete(oldestKey)
      }
      daySummaryCache.set(cacheKey, { signature, summary })
      return summary
    }).sort((a, b) => b.dayUtc.localeCompare(a.dayUtc))
  },

  async correctActivity(userId: string, input: { sessionId: string, startedAt: number, endedAt: number, activity: TrackActivity }) {
    return saveCorrectionBatch(userId, {
      dayUtc: new Date(input.startedAt).toISOString().slice(0, 10),
      additions: [{ ...input, id: crypto.randomUUID() }],
      removals: [],
    }, false)
  },

  async removeActivityCorrection(userId: string, id: string) {
    const removed = await measureDbQuery('track_activity_corrections', 'delete', () => db.delete(trackActivityCorrections)
      .where(and(eq(trackActivityCorrections.userId, userId), eq(trackActivityCorrections.id, id)))
      .returning({ id: trackActivityCorrections.id }))
    return { success: removed.length > 0 }
  },

  /**
   * Удаление точки: удаляет из базы и перезапускает сегментацию для сессии,
   * чтобы нормализовать маршрут и вершины Безье без удаленной точки.
   */
  async deletePoint(userId: string, clientPointId: string) {
    const [target] = await db
      .select({
        sessionId: trackPoints.sessionId,
      })
      .from(trackPoints)
      .where(and(
        eq(trackPoints.userId, userId),
        eq(trackPoints.clientPointId, clientPointId),
      ))
      .limit(1)

    if (!target) {
      return { success: false, clientPointId, reprocessedSegments: 0 }
    }

    await db
      .delete(trackPoints)
      .where(and(
        eq(trackPoints.userId, userId),
        eq(trackPoints.clientPointId, clientPointId),
      ))

    invalidateUserSummaryCache(userId)
    return { success: true, clientPointId, reprocessedSegments: 0 }
  },
}
