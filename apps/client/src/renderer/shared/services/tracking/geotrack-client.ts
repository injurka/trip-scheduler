import type { TrackActivityType } from '@injurka/track-processing'
import { bearingDeg, evaluatePointValidity, haversineM } from '@injurka/track-processing'
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
  error?: string | null
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

export function deleteStoredPoint(clientPointId: string): void {
  const points = readStoredPoints().filter(p => p.clientPointId !== clientPointId)
  writeStoredPoints(points)
}

export interface StoredSession {
  sessionId: string
  startedAt: number
  distanceM: number
  lastPoint: TrackPoint | null
  isRunning: boolean
}

export function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY)
    if (!raw)
      return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.sessionId === 'string' && typeof parsed.startedAt === 'number') {
      return {
        sessionId: parsed.sessionId,
        startedAt: parsed.startedAt,
        distanceM: typeof parsed.distanceM === 'number' ? parsed.distanceM : 0,
        lastPoint: parsed.lastPoint ? parseTrackPoint(parsed.lastPoint) : null,
        isRunning: Boolean(parsed.isRunning),
      }
    }
    return null
  }
  catch {
    return null
  }
}

export function writeStoredSession(session: StoredSession | null): void {
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

/** Проверка: была ли активна сессия до закрытия приложения / перезагрузки */
export function hasActiveStoredSession(): boolean {
  const session = readStoredSession()
  return Boolean(session?.isRunning)
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

/**
 * Фоновый кипалив через скрытый аудиопоток (бесшумный WAV loop).
 * На Android предотвращает засыпание WebView и троттлинг таймеров/геолокации при заблокированном экране.
 */
class BackgroundAudioKeepalive {
  private audio: HTMLAudioElement | null = null
  private isPlaying = false
  // 1-секундный закольцованный бесшумный WAV
  private readonly SILENT_WAV_URI
    = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA=='

  public start(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined')
      return

    if (this.isPlaying && this.audio)
      return

    try {
      if (!this.audio) {
        this.audio = new Audio()
        this.audio.src = this.SILENT_WAV_URI
        this.audio.loop = true
        this.audio.preload = 'auto'
        this.audio.volume = 0.01 // минимальная ненулевая громкость для предотвращения выгрузки потока ОС
        this.audio.setAttribute('playsinline', 'true')
        this.audio.setAttribute('webkit-playsinline', 'true')
      }

      const promise = this.audio.play()
      if (promise !== undefined) {
        promise
          .then(() => {
            this.isPlaying = true
          })
          .catch(() => {
            // Если autoplay заблокирован политикой браузера, возобновляем при первом жесте
            const resumeOnGesture = () => {
              if (this.audio && !this.isPlaying) {
                this.audio.play().then(() => {
                  this.isPlaying = true
                }).catch(() => {})
              }
            }
            window.addEventListener('touchstart', resumeOnGesture, { once: true })
            window.addEventListener('click', resumeOnGesture, { once: true })
          })
      }
    }
    catch (e) {
      console.warn('[Tracking] Ошибка запуска аудио-кипалива:', e)
    }
  }

  public stop(): void {
    if (this.audio) {
      try {
        this.audio.pause()
        this.audio.currentTime = 0
      }
      catch {
        // игнорируем
      }
      this.isPlaying = false
    }
  }
}

// ─── Трекер на базе Web Geolocation API и Tauri Geolocation ──────────────────

class WebGeolocationTracker {
  private watchId: number | null = null
  private tauriWatchId: number | null = null
  private wakeLockSentinel: any = null
  private watchdogTimer: ReturnType<typeof setInterval> | null = null
  private keepalive = new BackgroundAudioKeepalive()
  private currentSessionId: string | null = null
  private sessionStartedAt = 0
  private sessionEndedAt = 0
  private sessionDistanceM = 0
  private lastFixPoint: TrackPoint | null = null
  private lastError: string | null = null
  private isRunning = false
  private consecutiveRejectedCount = 0

  constructor() {
    this.setupLifecycleListeners()

    const saved = readStoredSession()
    if (saved) {
      this.currentSessionId = saved.sessionId
      this.sessionStartedAt = saved.startedAt
      this.sessionDistanceM = saved.distanceM
      this.lastFixPoint = saved.lastPoint
      this.sessionEndedAt = saved.lastPoint?.tsUtc || saved.startedAt
      if (saved.isRunning) {
        this.isRunning = true
        // Автоматически возобновляем отслеживание в фоне
        void this.resumeTracking()
      }
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
      // После остановки длительность фиксируется на моменте stop() или последней точке, а не «сейчас»
      const endTs = this.isRunning ? now : (this.sessionEndedAt || this.lastFixPoint?.tsUtc || now)
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
      error: this.lastError,
    }
  }

  public getLastError(): string | null {
    return this.lastError
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
    this.isRunning = true

    writeStoredSession({
      sessionId: this.currentSessionId,
      startedAt: this.sessionStartedAt,
      distanceM: 0,
      lastPoint: null,
      isRunning: true,
    })

    await this.acquireWakeLock()
    this.keepalive.start()
    await this.startWatchers()
    this.startWatchdog()
    this.requestImmediateFix()

    return this.getStatus()
  }

  /** Автоматическое возобновление ранее активной сессии после перезапуска/сворачивания */
  private async resumeTracking(): Promise<void> {
    if (!this.isRunning)
      return

    await this.acquireWakeLock()
    this.keepalive.start()
    await this.startWatchers()
    this.startWatchdog()
    this.requestImmediateFix()

    // Запускаем синк точек, накопившихся в буфере
    void import('./track-sync').then(m => m.runSync()).catch(() => {})
  }

  private async acquireWakeLock(): Promise<void> {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator))
      return
    try {
      if (this.wakeLockSentinel && !this.wakeLockSentinel.released)
        return
      this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen')
      this.wakeLockSentinel.addEventListener('release', () => {
        if (this.isRunning && typeof document !== 'undefined' && document.visibilityState === 'visible') {
          void this.acquireWakeLock()
        }
      })
    }
    catch {
      // Игнорируем отказ в wake lock
    }
  }

  private async releaseWakeLock(): Promise<void> {
    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release()
      }
      catch {
        // игнорируем
      }
      this.wakeLockSentinel = null
    }
  }

  private setupLifecycleListeners(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.onAppResume()
        }
      })
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.onAppResume()
      })
      window.addEventListener('online', () => {
        if (this.isRunning) {
          void import('./track-sync').then(m => m.runSync()).catch(() => {})
        }
      })
    }
  }

  private onAppResume(): void {
    if (!this.isRunning)
      return

    void this.acquireWakeLock()
    this.keepalive.start()
    this.requestImmediateFix()
    void import('./track-sync').then(m => m.runSync()).catch(() => {})
  }

  private async startWatchers(): Promise<void> {
    this.stopWatchers()

    // 1. Web Geolocation Watcher (работает внутри Chromium WebView при активном аудио-кипаливе)
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        this.watchId = navigator.geolocation.watchPosition(
          pos => this.handlePositionUpdate(pos),
          err => this.handlePositionError(err),
          {
            enableHighAccuracy: true,
            maximumAge: 3000,
            timeout: 15000,
          },
        )
      }
      catch (e) {
        console.warn('[Tracking] Web watchPosition failed:', e)
      }
    }

    // 2. Tauri Geolocation Watcher (FusedLocationProviderClient на Android для высокой точности)
    if (isMobileApp) {
      try {
        let status = await tauriCheckPermissions()
        if (status.location === 'prompt' || status.location === 'prompt-with-rationale') {
          status = await tauriRequestPermissions(['location'])
        }
        if (status.location === 'denied') {
          this.lastError = 'Доступ к геолокации запрещён в настройках приложения или системы'
        }
        else {
          this.tauriWatchId = await tauriWatchPosition(
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 3000,
            },
            (pos, err) => {
              if (err) {
                this.lastError = typeof err === 'string' ? err : 'Ошибка получения координат GPS'
                return
              }
              if (pos) {
                this.handlePositionUpdate(pos)
              }
            },
          )
        }
      }
      catch (err: any) {
        console.warn('[Tracking] Tauri watchPosition failed:', err)
      }
    }
  }

  private stopWatchers(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        navigator.geolocation.clearWatch(this.watchId)
      }
      catch {
        // игнорируем
      }
      this.watchId = null
    }

    if (this.tauriWatchId !== null) {
      try {
        void tauriClearWatch(this.tauriWatchId)
      }
      catch (e) {
        console.warn('[Tracking] Tauri clearWatch error:', e)
      }
      this.tauriWatchId = null
    }
  }

  private startWatchdog(): void {
    this.stopWatchdog()
    this.watchdogTimer = setInterval(() => {
      if (!this.isRunning) {
        this.stopWatchdog()
        return
      }

      const now = Date.now()
      const timeSinceLastFix = this.lastFixPoint ? (now - this.lastFixPoint.tsUtc) : (now - this.sessionStartedAt)

      // Если координаты не поступали более 20 секунд, принудительно запрашиваем фикс
      if (timeSinceLastFix > 20000) {
        this.requestImmediateFix()
      }
    }, 15000)
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer)
      this.watchdogTimer = null
    }
  }

  private requestImmediateFix(): void {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => this.handlePositionUpdate(pos),
        err => console.warn('[Tracking] Ошибка immediate fix:', err?.message || err),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 },
      )
    }
  }

  public async stop(): Promise<TrackingStatus> {
    this.isRunning = false
    this.stopWatchers()
    this.stopWatchdog()
    this.keepalive.stop()
    await this.releaseWakeLock()

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

    // Отсекаем координаты с критически плохой точностью (> 140 метров)
    if (accuracy && accuracy > 140) {
      return
    }

    let speed = typeof coords.speed === 'number' && Number.isFinite(coords.speed) && coords.speed >= 0 ? coords.speed : null
    let bearing = typeof coords.heading === 'number' && Number.isFinite(coords.heading) && coords.heading >= 0 ? coords.heading : null

    if (this.lastFixPoint) {
      const dM = haversineM(this.lastFixPoint.lat, this.lastFixPoint.lng, lat, lng)
      const dtSec = Math.max(0.1, (ts - this.lastFixPoint.tsUtc) / 1000)

      // Игнорируем дублирующие точки от параллельных слушателей (Tauri + Web)
      if (dM < 1.0 && (ts - this.lastFixPoint.tsUtc) < 800) {
        return
      }

      // Проверка валидности точки и отсечение сбоев GPS / мгновенных телепортов
      const validity = evaluatePointValidity(
        { lat, lng, tsUtc: ts, accuracy, speed },
        this.lastFixPoint,
      )
      if (!validity.isValid) {
        this.consecutiveRejectedCount++
        console.warn(`[Tracking] Точка пропущена из-за аномалии (${this.consecutiveRejectedCount}/3): ${validity.reason}`)
        // Если накопилось ≥ 3 отклоненных точек подряд, сбрасываем старую якорную точку для перекалибровки
        if (this.consecutiveRejectedCount >= 3) {
          console.warn('[Tracking] Серия отклонений: сброс якорной точки и перекалибровка на новые координаты.')
          this.lastFixPoint = null
          this.consecutiveRejectedCount = 0
        }
        return
      }

      this.consecutiveRejectedCount = 0

      // Если девайс не отдал мгновенную скорость, рассчитываем по дельте
      if (speed === null && dtSec > 0) {
        speed = dM / dtSec
      }

      // Если девайс не отдал азимут, рассчитываем
      if (bearing === null && dM > 3) {
        bearing = bearingDeg(this.lastFixPoint.lat, this.lastFixPoint.lng, lat, lng)
      }

      // Прибавляем дистанцию, отсекая статичный GPS-дрейф (< 1.5м на месте) и не накручивая одометр при длинных разрывах
      if (dM >= 1.5 && (speed == null || speed >= 0.3) && !validity.isGap) {
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
      isRunning: this.isRunning,
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
