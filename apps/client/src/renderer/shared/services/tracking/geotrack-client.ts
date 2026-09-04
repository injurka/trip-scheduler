import type { TrackActivityType } from '@injurka/track-processing'

export type ActivityType = TrackActivityType

export interface TrackPoint {
  clientPointId: string
  tsUtc: number
  lat: number
  lng: number
  altitude: number | null
  accuracy: number | null
  speed: number | null
  bearing: number | null
  activity: ActivityType
  activityConfidence: number
  sessionId: string
}

export interface TrackingStatus {
  running: boolean
  unsentCount: number
  network: 'wifi' | 'cellular' | 'offline' | 'other'
  lastFixTsUtc: number | null
  batteryIgnored: boolean
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Ошибка плагина: geotrack доступен только в мобильной Tauri-сборке. */
export class GeotrackUnavailableError extends Error {
  constructor() {
    super('geotrack доступен только в мобильной Tauri-сборке (isMobileApp)')
  }
}

/**
 * Клиент нативного плагина geotrack.
 *
 * На web/десктопе методы кидают GeotrackUnavailableError — UI должен это ловить
 * и скрывать тумблер трекинга. Реальный плагин подключается в apps/native.
 */
export const geotrack = {
  async start(): Promise<TrackingStatus> {
    throw new GeotrackUnavailableError()
  },

  async stop(): Promise<TrackingStatus> {
    throw new GeotrackUnavailableError()
  },

  async status(): Promise<TrackingStatus> {
    throw new GeotrackUnavailableError()
  },

  async getUnsent(limit = 500): Promise<TrackPoint[]> {
    void limit
    throw new GeotrackUnavailableError()
  },

  async markSynced(_clientPointIds: string[]): Promise<void> {
    throw new GeotrackUnavailableError()
  },

  async setConfig(_cfg: {
    maxUpdateDelayMs?: number
    stillIntervalMs?: number
    activeIntervalMs?: number
    activeMinDistanceM?: number
  }): Promise<void> {
    throw new GeotrackUnavailableError()
  },
}

/** Строгая валидация точки от нативного слоя (граница доверия Rust/Kotlin → JS). */
export function parseTrackPoint(raw: unknown): TrackPoint | null {
  if (!isRecord(raw))
    return null
  const r = raw
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
  if (
    typeof r.clientPointId !== 'string' || !UUID_RE.test(r.clientPointId)
    || !num(r.tsUtc) || (r.tsUtc as number) <= 0
    || !num(r.lat) || (r.lat as number) < -90 || (r.lat as number) > 90
    || !num(r.lng) || (r.lng as number) < -180 || (r.lng as number) > 180
    || typeof r.activity !== 'string'
    || typeof r.sessionId !== 'string' || r.sessionId.length < 4
  ) {
    return null
  }

  const activities: ActivityType[] = ['still', 'walk', 'bike', 'vehicle', 'rail', 'unknown']
  const activity = r.activity as ActivityType
  if (!activities.includes(activity))
    return null

  return {
    clientPointId: r.clientPointId,
    tsUtc: r.tsUtc as number,
    lat: r.lat as number,
    lng: r.lng as number,
    altitude: num(r.altitude) ? (r.altitude as number) : null,
    accuracy: num(r.accuracy) ? (r.accuracy as number) : null,
    speed: num(r.speed) ? (r.speed as number) : null,
    bearing: num(r.bearing) ? (r.bearing as number) : null,
    activity,
    activityConfidence: num(r.activityConfidence) ? (r.activityConfidence as number) : 0,
    sessionId: r.sessionId,
  }
}
