import type { TrackPoint } from './geotrack-client'
import { trpc } from '~/shared/services/trpc/trpc.service'
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
  let total = 0
  for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
    const raw = await geotrack.getUnsent(BATCH_SIZE)
    const points: TrackPoint[] = []
    for (const r of raw) {
      const p = parseTrackPoint(r)
      if (p)
        points.push(p)
    }
    if (points.length === 0)
      break

    const result = await (trpc as any).tracking.ingestBatch.mutate({
      points: points.map(p => ({
        clientPointId: p.clientPointId,
        sessionId: p.sessionId,
        tsUtc: p.tsUtc,
        lat: p.lat,
        lng: p.lng,
        altitude: p.altitude,
        accuracy: p.accuracy,
        speed: p.speed,
        bearing: p.bearing,
        activity: p.activity,
        activityConfidence: p.activityConfidence,
      })),
    }) as { accepted: string[] }

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
  catch {
    return 0
  }
  finally {
    running = false
  }
}

export function startSyncWorker(): void {
  if (timer)
    return
  // Немедленный запуск синка при старте
  void runSync()
  timer = setInterval(() => {
    void runSync()
  }, INTERVAL_IDLE_MS)
}

export function stopSyncWorker(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
