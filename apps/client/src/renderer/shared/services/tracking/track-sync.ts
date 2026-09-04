import type { TrackPoint } from './geotrack-client'
import { useTrackingStore } from '~/shared/store/tracking.store'
import { geotrack, parseTrackPoint } from './geotrack-client'

/**
 * Синк-воркер: выгружает несинхронизированные точки из нативного буфера
 * батчами через tRPC tracking.ingestBatch (идемпотентно по clientPointId).
 *
 * Триггеры: вызов из tracking.store при открытии приложения, после toggle(true)
 * и периодически по таймеру, пока WebView жив.
 */

const BATCH_SIZE = 500
const MAX_BATCHES_PER_RUN = 20 // защита от бесконечного цикла при плохой сети
const INTERVAL_IDLE_MS = 120_000 // 2 мин, когда буфер пуст

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

    const { tracking } = await import('~/shared/services/trpc/trpc.service').then(m => ({ tracking: (m.trpc as any).tracking }))
    const result = await (tracking.ingestBatch as any).mutate({
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

/** Однократная попытка синка; ошибки глушатся (следующий тик повторит). */
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
