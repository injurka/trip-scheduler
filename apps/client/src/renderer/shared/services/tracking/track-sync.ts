import type { TrackPoint } from './geotrack-client'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { useAuthStore } from '~/shared/store/auth.store'
import { useTrackingStore } from '~/shared/store/tracking.store'
import { geotrack, parseTrackPoint } from './geotrack-client'

/**
 * Синк-воркер: выгружает несинхронизированные точки из локального/нативного буфера
 * батчами через tRPC tracking.ingestBatch (идемпотентно по clientPointId).
 */

const BATCH_SIZE = 500
const MAX_BATCHES_PER_RUN = 20
const INTERVAL_IDLE_MS = 60_000 // 1 мин периодический опрос

let timer: ReturnType<typeof setInterval> | null = null
let running = false

function normalizeFiniteValue(value: number | null, allowNegative: boolean): number | null {
  if (value == null || !Number.isFinite(value))
    return null

  if (!allowNegative && value < 0)
    return null

  return value
}

function normalizeConfidence(value: number): number {
  if (value > 0 && value <= 1)
    return Math.round(value * 100)

  return Math.round(Math.min(100, Math.max(0, value || 0)))
}

function toTrackingInput(point: TrackPoint) {
  const bearing = normalizeFiniteValue(point.bearing, true)
  const deviceConfidence = point.deviceActivityConfidence

  return {
    clientPointId: point.clientPointId,
    sessionId: point.sessionId,
    tsUtc: Math.round(point.tsUtc),
    lat: point.lat,
    lng: point.lng,
    altitude: normalizeFiniteValue(point.altitude, true),
    accuracy: normalizeFiniteValue(point.accuracy, false),
    speed: normalizeFiniteValue(point.speed, false),
    bearing: bearing == null ? null : (((bearing % 360) + 360) % 360),
    activity: point.activity,
    activityConfidence: normalizeConfidence(point.activityConfidence),
    // Preserve device activity evidence separately from GPS classification.
    deviceActivity: point.deviceActivity ?? null,
    deviceActivityConfidence: deviceConfidence == null
      ? null
      : Math.round(Math.min(100, Math.max(0, deviceConfidence))),
  }
}

async function syncOnce(): Promise<number> {
  const auth = useAuthStore()

  if (!auth.isAuthenticated)
    return 0

  let total = 0

  for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
    const raw = await geotrack.getUnsent(BATCH_SIZE)

    if (raw.length === 0)
      break

    const points: TrackPoint[] = []

    for (const r of raw) {
      const p = parseTrackPoint(r)

      if (p)
        points.push(p)
    }

    if (points.length === 0) {
      const invalidIds = raw.map(r => r.clientPointId).filter(Boolean)

      if (invalidIds.length > 0) {
        await useTrackingStore().markSynced(invalidIds)
      }

      break
    }

    const result = await (trpc as any).tracking.ingestBatch.mutate({
      points: points.map(toTrackingInput),
    }) as { accepted: string[], rejectedCount: number }

    const acceptedSet = new Set(result.accepted)
    const syncedIds = points.filter(p => acceptedSet.has(p.clientPointId)).map(p => p.clientPointId)

    if (syncedIds.length > 0)
      await useTrackingStore().markSynced(syncedIds)

    total += syncedIds.length

    if (points.length < BATCH_SIZE)
      break
  }

  return total
}

/** Однократная попытка синка */
export async function runSync(): Promise<number> {
  if (running)
    return 0

  running = true

  try {
    return await syncOnce()
  }
  finally {
    running = false
  }
}

export function startSyncWorker(): void {
  if (timer)
    return

  // Немедленный запуск синка при старте
  void runSync().catch((err) => {
    console.warn('[Tracking sync worker]', err?.message || err)
  })
  timer = setInterval(() => {
    void runSync().catch((err) => {
      console.warn('[Tracking sync worker]', err?.message || err)
    })
  }, INTERVAL_IDLE_MS)
}

export function stopSyncWorker(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
