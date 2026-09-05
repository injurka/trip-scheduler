import type { TrackActivityType } from '@injurka/track-processing'
import { bearingDeg, haversineM } from '@injurka/track-processing'
import {
  checkPermissions as tauriCheckPermissions,
  clearWatch as tauriClearWatch,
  requestPermissions as tauriRequestPermissions,
  watchPosition as tauriWatchPosition,
} from '@tauri-apps/plugin-geolocation'
import { v4 as uuidv4 } from 'uuid'
import { isMobileApp } from '~/shared/lib/env'

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

export interface TrackingTelemetry {
  speedKmh: number | null
  accuracyM: number | null
  distanceM: number
  durationMs: number
  activity: ActivityType
  lat: number | null
  lng: number | null
}

export interface TrackingStatus {
  running: boolean
  unsentCount: number
  network: 'wifi' | 'cellular' | 'offline' | 'other'
  lastFixTsUtc: number | null
  batteryIgnored: boolean
  telemetry?: TrackingTelemetry
}

const STORAGE_POINTS_KEY = 'tripscheduler_tracking_points'
const STORAGE_SESSION_KEY = 'tripscheduler_tracking_session'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Ошибка плагина: геолокация недоступна на данном устройстве или в браузере. */
export class GeotrackUnavailableError extends Error {
  constructor(message = 'Геолокация недоступна на этом устройстве или в окружении') {
    super(message)
  }
}

function readStoredPoints(): TrackPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_POINTS_KEY)
    if (!raw)
      return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed))
      return []
    const valid = parsed.map(parseTrackPoint).filter((p): p is TrackPoint => p !== null)
    if (valid.length !== parsed.length) {
      writeStoredPoints(valid)
    }
    return valid
  }
  catch {
    return []
  }
}

function writeStoredPoints(points: TrackPoint[]): void {
  try {
    // Храним максимум 5000 последних точек в очереди во избежание переполнения quota
    const capped = points.length > 5000 ? points.slice(points.length - 5000) : points
    localStorage.setItem(STORAGE_POINTS_KEY, JSON.stringify(capped))
  }
  catch (e) {
    console.warn('[Tracking] Не удалось сохранить точки в LocalStorage:', e)
  }
}

interface StoredSession {
  sessionId: string
  startedAt: number
  distanceM: number
  lastPoint: TrackPoint | null
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY)
    if (!raw)
      return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.sessionId === 'string' && typeof parsed.startedAt === 'number') {
      return parsed as StoredSession
    }
    return null
  }
  catch {
    return null
  }
}

function writeStoredSession(session: StoredSession | null): void {
  try {
    if (session) {
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session))
    }
    else {
      localStorage.removeItem(STORAGE_SESSION_KEY)
    }
  }
  catch {
    // игнорируем ошибку LocalStorage
  }
}

function detectNetwork(): 'wifi' | 'cellular' | 'offline' | 'other' {
  if (typeof navigator === 'undefined')
    return 'other'
  if (!navigator.onLine)
    return 'offline'

  const conn = (navigator as unknown as { connection?: { type?: string } }).connection
  if (conn?.type) {
    if (conn.type === 'wifi' || conn.type === 'ethernet')
      return 'wifi'
    if (conn.type === 'cellular')
      return 'cellular'
  }
  return 'other'
}

/**
 * Определение предполагаемой активности по мгновенной и средней скорости.
 */
function estimateActivity(speedMs: number): ActivityType {
  if (speedMs < 0.6)
    return 'still'
  if (speedMs < 2.5)
    return 'walk' // до 9 км/ч
  if (speedMs < 8.5)
    return 'bike' // 9-30 км/ч
  if (speedMs < 36.0)
    return 'vehicle' // 30-130 км/ч
  return 'rail' // свыше 130 км/ч
}

// ─── Трекер на базе Web Geolocation API ───────────────────────────────────────

class WebGeolocationTracker {
  private watchId: number | null = null
  private tauriWatchId: number | null = null
  private wakeLockSentinel: any = null
  private currentSessionId: string | null = null
  private sessionStartedAt = 0
  private sessionEndedAt = 0
  private sessionDistanceM = 0
  private lastFixPoint: TrackPoint | null = null
  private lastError: string | null = null
  private isRunning = false

  constructor() {
    const saved = readStoredSession()
    if (saved) {
      this.currentSessionId = saved.sessionId
      this.sessionStartedAt = saved.startedAt
      this.sessionDistanceM = saved.distanceM
      this.lastFixPoint = saved.lastPoint
    }
  }

  public isSupported(): boolean {
    if (isMobileApp)
      return true
    return typeof navigator !== 'undefined' && 'geolocation' in navigator
  }

  public getStatus(): TrackingStatus {
    const unsent = readStoredPoints()
    const now = Date.now()

    let telemetry: TrackingTelemetry | undefined
    if (this.isRunning || this.lastFixPoint) {
      const speedKmh = this.lastFixPoint?.speed != null ? Math.round(this.lastFixPoint.speed * 3.6) : null
      // После остановки длительность фиксируется на моменте stop(), а не «сейчас»
      const endTs = this.isRunning ? now : (this.sessionEndedAt || now)
      telemetry = {
        speedKmh,
        accuracyM: this.lastFixPoint?.accuracy != null ? Math.round(this.lastFixPoint.accuracy) : null,
        distanceM: Math.round(this.sessionDistanceM),
        durationMs: this.sessionStartedAt > 0 ? Math.max(0, endTs - this.sessionStartedAt) : 0,
        activity: this.lastFixPoint?.activity || 'still',
        lat: this.lastFixPoint?.lat ?? null,
        lng: this.lastFixPoint?.lng ?? null,
      }
    }

    return {
      running: this.isRunning,
      unsentCount: unsent.length,
      network: detectNetwork(),
      lastFixTsUtc: this.lastFixPoint?.tsUtc ?? null,
      batteryIgnored: false,
      telemetry,
    }
  }

  public async start(): Promise<TrackingStatus> {
    if (!this.isSupported()) {
      throw new GeotrackUnavailableError('Геолокация не поддерживается данным браузером или устройством')
    }

    if (this.isRunning) {
      return this.getStatus()
    }

    this.lastError = null

    // Начинаем новую сессию
    this.currentSessionId = uuidv4()
    this.sessionStartedAt = Date.now()
    this.sessionEndedAt = 0
    this.sessionDistanceM = 0
    this.lastFixPoint = null
    writeStoredSession({
      sessionId: this.currentSessionId,
      startedAt: this.sessionStartedAt,
      distanceM: 0,
      lastPoint: null,
    })

    // Попытка заблокировать засыпание экрана на мобильных устройствах
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock?.request) {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen')
      }
    }
    catch {
      // Игнорируем отказ в wake lock
    }

    if (isMobileApp) {
      return this.startTauriTracking()
    }

    return this.startWebTracking()
  }

  private async startTauriTracking(): Promise<TrackingStatus> {
    try {
      let status = await tauriCheckPermissions()
      if (status.location === 'prompt' || status.location === 'prompt-with-rationale') {
        status = await tauriRequestPermissions(['location'])
      }
      if (status.location === 'denied') {
        this.lastError = 'Доступ к геолокации запрещён в настройках приложения или системы'
        throw new Error(this.lastError)
      }
    }
    catch (err: any) {
      if (err instanceof Error && err.message === this.lastError) {
        throw err
      }
      console.warn('[Tracking] Ошибка проверки прав геолокации в Tauri:', err)
    }

    return new Promise((resolve, reject) => {
      let isFirstFix = true

      tauriWatchPosition(
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 3000,
        },
        (pos, err) => {
          if (err) {
            this.lastError = typeof err === 'string' ? err : 'Ошибка получения координат GPS'
            if (isFirstFix) {
              isFirstFix = false
              this.isRunning = false
              reject(new Error(this.lastError))
            }
            return
          }

          if (pos) {
            this.handlePositionUpdate(pos)
            if (isFirstFix) {
              isFirstFix = false
              this.isRunning = true
              resolve(this.getStatus())
            }
          }
        },
      ).then((id) => {
        this.tauriWatchId = id
      }).catch((err) => {
        this.lastError = err?.message || String(err)
        if (isFirstFix) {
          isFirstFix = false
          this.isRunning = false
          reject(new Error(this.lastError || 'Ошибка получения координат GPS'))
        }
      })
    })
  }

  private startWebTracking(): Promise<TrackingStatus> {
    return new Promise((resolve, reject) => {
      let isFirstFix = true

      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          this.handlePositionUpdate(pos)
          if (isFirstFix) {
            isFirstFix = false
            this.isRunning = true
            resolve(this.getStatus())
          }
        },
        (err) => {
          this.handlePositionError(err)
          if (isFirstFix) {
            isFirstFix = false
            this.isRunning = false
            reject(new Error(this.lastError || 'Ошибка получения координат GPS'))
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 15000,
        },
      )
    })
  }

  public async stop(): Promise<TrackingStatus> {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }

    if (this.tauriWatchId !== null) {
      try {
        await tauriClearWatch(this.tauriWatchId)
      }
      catch (e) {
        console.warn('[Tracking] Ошибка clearWatch в Tauri:', e)
      }
      this.tauriWatchId = null
    }

    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release()
      }
      catch {
        // игнорируем
      }
      this.wakeLockSentinel = null
    }

    this.isRunning = false

    if (this.sessionStartedAt > 0) {
      this.sessionEndedAt = Date.now()
    }

    writeStoredSession(null)
    return this.getStatus()
  }

  public async requestPermission(): Promise<boolean> {
    if (isMobileApp) {
      try {
        const status = await tauriRequestPermissions(['location'])
        return status.location === 'granted' || status.coarseLocation === 'granted'
      }
      catch (e) {
        console.warn('[Tracking] Ошибка запроса прав в Tauri:', e)
        return false
      }
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          () => resolve(false),
          { timeout: 10000 },
        )
      })
    }

    return false
  }

  private handlePositionUpdate(pos: {
    coords: {
      latitude: number
      longitude: number
      accuracy?: number | null
      altitude?: number | null
      speed?: number | null
      heading?: number | null
    }
    timestamp?: number
  }): void {
    const coords = pos.coords
    const ts = pos.timestamp && pos.timestamp > 0 ? pos.timestamp : Date.now()
    const lat = coords.latitude
    const lng = coords.longitude
    const accuracy = typeof coords.accuracy === 'number' && Number.isFinite(coords.accuracy) ? coords.accuracy : null
    const altitude = typeof coords.altitude === 'number' && Number.isFinite(coords.altitude) ? coords.altitude : null

    // Отсекаем координаты с критически плохой точностью (> 100 метров)
    if (accuracy && accuracy > 100) {
      return
    }

    let speed = typeof coords.speed === 'number' && Number.isFinite(coords.speed) && coords.speed >= 0 ? coords.speed : null
    let bearing = typeof coords.heading === 'number' && Number.isFinite(coords.heading) && coords.heading >= 0 ? coords.heading : null

    if (this.lastFixPoint) {
      const dM = haversineM(this.lastFixPoint.lat, this.lastFixPoint.lng, lat, lng)
      const dtSec = Math.max(0.1, (ts - this.lastFixPoint.tsUtc) / 1000)

      // Если девайс не отдал мгновенную скорость, рассчитываем по дельте
      if (speed === null && dtSec > 0) {
        speed = dM / dtSec
      }

      // Если девайс не отдал азимут, рассчитываем
      if (bearing === null && dM > 3) {
        bearing = bearingDeg(this.lastFixPoint.lat, this.lastFixPoint.lng, lat, lng)
      }

      // Прибавляем дистанцию, отсекая статичный GPS-дрейф (< 1.5м на месте)
      if (dM >= 1.5 && (speed == null || speed >= 0.3)) {
        this.sessionDistanceM += dM
      }
    }

    const estimatedSpeed = speed ?? 0
    const activity = estimateActivity(estimatedSpeed)

    const point: TrackPoint = {
      clientPointId: uuidv4(),
      tsUtc: ts,
      lat,
      lng,
      altitude,
      accuracy,
      speed,
      bearing,
      activity,
      activityConfidence: 85,
      sessionId: this.currentSessionId || uuidv4(),
    }

    this.lastFixPoint = point

    // Сохраняем точку в локальный буфер
    const queue = readStoredPoints()
    queue.push(point)
    writeStoredPoints(queue)

    // Обновляем состояние сессии
    writeStoredSession({
      sessionId: this.currentSessionId || point.sessionId,
      startedAt: this.sessionStartedAt,
      distanceM: this.sessionDistanceM,
      lastPoint: point,
    })
  }

  private handlePositionError(err: GeolocationPositionError): void {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        this.lastError = 'Доступ к геолокации запрещён пользователем или браузером'
        break
      case err.POSITION_UNAVAILABLE:
        this.lastError = 'Сигнал GPS недоступен (попробуйте на открытом пространстве)'
        break
      case err.TIMEOUT:
        this.lastError = 'Таймаут ожидания координат GPS'
        break
      default:
        this.lastError = err.message || 'Ошибка геолокации'
    }
  }

  public getUnsent(limit = 500): TrackPoint[] {
    const queue = readStoredPoints()
    return queue.slice(0, limit)
  }

  public markSynced(clientPointIds: string[]): void {
    if (clientPointIds.length === 0)
      return
    const idSet = new Set(clientPointIds)
    const queue = readStoredPoints()
    const remaining = queue.filter(p => !idSet.has(p.clientPointId))
    writeStoredPoints(remaining)
  }
}

const trackerInstance = new WebGeolocationTracker()

/**
 * Клиент трекинга: работает в браузере, PWA и в нативной сборке Tauri.
 */
export const geotrack = {
  async isAvailable(): Promise<boolean> {
    return trackerInstance.isSupported()
  },

  async requestPermission(): Promise<boolean> {
    return trackerInstance.requestPermission()
  },

  async start(): Promise<TrackingStatus> {
    return trackerInstance.start()
  },

  async stop(): Promise<TrackingStatus> {
    return trackerInstance.stop()
  },

  async status(): Promise<TrackingStatus> {
    return trackerInstance.getStatus()
  },

  async getUnsent(limit = 500): Promise<TrackPoint[]> {
    return trackerInstance.getUnsent(limit)
  },

  async markSynced(clientPointIds: string[]): Promise<void> {
    trackerInstance.markSynced(clientPointIds)
  },

  async setConfig(_cfg: {
    maxUpdateDelayMs?: number
    stillIntervalMs?: number
    activeIntervalMs?: number
    activeMinDistanceM?: number
  }): Promise<void> {
    // В будущих расширениях
  },
}

export function parseTrackPoint(raw: unknown): TrackPoint | null {
  if (!isRecord(raw))
    return null
  const r = raw
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
  if (
    typeof r.clientPointId !== 'string' || r.clientPointId.length < 8 || r.clientPointId.length > 64
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

  const rawConf = num(r.activityConfidence) ? (r.activityConfidence as number) : 85
  const activityConfidence = rawConf > 0 && rawConf <= 1
    ? Math.round(rawConf * 100)
    : Math.round(Math.min(100, Math.max(0, rawConf)))

  return {
    clientPointId: r.clientPointId,
    tsUtc: Math.round(r.tsUtc as number),
    lat: r.lat as number,
    lng: r.lng as number,
    altitude: num(r.altitude) ? (r.altitude as number) : null,
    accuracy: num(r.accuracy) && (r.accuracy as number) >= 0 ? (r.accuracy as number) : null,
    speed: num(r.speed) && (r.speed as number) >= 0 ? (r.speed as number) : null,
    bearing: num(r.bearing) ? ((((r.bearing as number) % 360) + 360) % 360) : null,
    activity,
    activityConfidence,
    sessionId: r.sessionId,
  }
}
