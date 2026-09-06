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
      points: points.map(p => ({
        clientPointId: p.clientPointId,
        sessionId: p.sessionId,
        tsUtc: Math.round(p.tsUtc),
        lat: p.lat,
        lng: p.lng,
        altitude: p.altitude != null && Number.isFinite(p.altitude) ? p.altitude : null,
        accuracy: p.accuracy != null && Number.isFinite(p.accuracy) && p.accuracy >= 0 ? p.accuracy : null,
        speed: p.speed != null && Number.isFinite(p.speed) && p.speed >= 0 ? p.speed : null,
        bearing: p.bearing != null && Number.isFinite(p.bearing) ? (((p.bearing % 360) + 360) % 360) : null,
        activity: p.activity,
        activityConfidence: p.activityConfidence <= 1 && p.activityConfidence > 0
          ? Math.round(p.activityConfidence * 100)
          : Math.round(Math.min(100, Math.max(0, p.activityConfidence || 0))),
      })),
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
