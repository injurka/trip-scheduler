import type { TrackActivityType } from '@injurka/track-processing'
import type { PluginListener } from '@tauri-apps/api/core'
import { bearingDeg, evaluatePointValidity, haversineM, movementEvidence } from '@injurka/track-processing'
import { addPluginListener, invoke } from '@tauri-apps/api/core'
import {
  checkPermissions as tauriCheckPermissions,
  clearWatch as tauriClearWatch,
  getCurrentPosition as tauriGetCurrentPosition,
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
  /** Активность по системному Activity Recognition (Android), не выводимая из GPS. */
  deviceActivity?: ActivityType | null
  /** Уверенность Activity Recognition, 0..100. */
  deviceActivityConfidence?: number | null
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

const LIVE_FIXES_WINDOW_MS = 45_000
const LIVE_FIXES_MAX = 30

/**
 * Порог уверенности Activity Recognition, ниже которого сигнал устройства не учитываем.
 * Google регулярно отдаёт «unknown» и короткие перескоки с уверенностью 30-45.
 */
const DEVICE_ACTIVITY_MIN_CONFIDENCE = 50
/** Окно наблюдений за устройством: короткие одиночные перескоки не должны менять состояние. */
const DEVICE_ACTIVITY_WINDOW_MS = 90_000
/** Сколько независимых наблюдений должны согласиться, прежде чем мы поверим устройству. */
const DEVICE_ACTIVITY_MIN_VOTES = 2

interface DeviceActivitySample {
  activity: ActivityType
  confidence: number
  tsUtc: number
}

/**
 * Разбор сырого значения активности из Android Activity Recognition.
 * Возвращает null для неизвестных/служебных типов (Google отдаёт ещё TILTING, UNKNOWN,
 * EXITING_VEHICLE — они не описывают способ перемещения).
 */
function normalizeDeviceActivity(raw: unknown, confidence: unknown): DeviceActivitySample | null {
  if (typeof raw !== 'string')
    return null
  const map: Record<string, ActivityType> = {
    still: 'still',
    walk: 'walk',
    on_foot: 'walk',
    running: 'walk',
    bike: 'bike',
    on_bicycle: 'bike',
    vehicle: 'vehicle',
    in_vehicle: 'vehicle',
  }
  const activity = map[raw.toLowerCase()]
  if (!activity)
    return null
  const conf = typeof confidence === 'number' && Number.isFinite(confidence) ? confidence : 0
  // Дополнительно принимаем шкалу 0..1, если плагин прислал её в долях
  const normalizedConf = conf > 0 && conf <= 1 ? Math.round(conf * 100) : Math.round(Math.min(100, Math.max(0, conf)))
  return { activity, confidence: normalizedConf, tsUtc: 0 }
}

/** Активность по скорости из окна фиксов: границы согласованы с пакетом @injurka/track-processing. */
function estimateActivity(speedMs: number): ActivityType {
  const kmh = speedMs * 3.6
  if (kmh < 2.5)
    return 'still'
  if (kmh < 8)
    return 'walk' // 2.5-8 км/ч
  if (kmh < 30)
    return 'bike' // 8-30 км/ч
  if (kmh < 130)
    return 'vehicle' // 30-130 км/ч
  return 'rail' // свыше 130 км/ч
}

/**
 * Доверенная скорость текущего момента по окну фиксов.
 * Пока геометрия не подтвердила перемещение (прямое смещение окна не превышает
 * погрешность GPS), скорость равна нулю: устройство может писать «еду 25 км/ч»,
 * но стоящий телефон с дрожащими фиксами так и остаётся стоящим.
 */
function trustedSpeedMs(
  evidence: ReturnType<typeof movementEvidence>,
  deviceSpeedMs: number | null,
): number {
  if (!evidence.credible)
    return 0
  // Заявленная скорость не может вдвое превышать подтверждённую геометрией окна.
  return Math.min(Math.max(deviceSpeedMs ?? 0, evidence.speedMs), evidence.speedMs * 2)
}

/**
 * Фоновый кипалив через скрытый аудиопоток (Web Audio API + HTMLAudioElement loop + MediaSession).
 * На Android (MIUI, HyperOS, EMUI, OneUI) удерживает аудио-сервисный тред ОС и WebView процесс активными,
 * предотвращая засыпание, троттлинг таймеров/геолокации и выгрузку в Doze Mode при заблокированном экране.
 */
class BackgroundAudioKeepalive {
  private audio: HTMLAudioElement | null = null
  private audioContext: AudioContext | null = null
  private gainNode: GainNode | null = null
  private bufferSource: AudioBufferSourceNode | null = null
  private isPlaying = false
  private updateThrottleTimer: ReturnType<typeof setTimeout> | null = null
  private lastTitle = 'Фоновый GPS-трекинг активен'
  private lastSubtitle = 'TripScheduler • Запись маршрута'
  private boundResumeHandler: (() => void) | null = null

  // 1-секундный закольцованный бесшумный WAV в формате base64
  private readonly SILENT_WAV_URI
    = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA=='

  public start(): void {
    if (typeof window === 'undefined')
      return

    this.isPlaying = true
    this.startAudioElement()
    this.startWebAudio()
    this.setupMediaSession()
    this.attachAutoResumeHandlers()
  }

  /** Проверка и возобновление аудио-потока при фоновых прерываниях ОС */
  public ensureActive(): void {
    if (!this.isPlaying)
      return

    // 1. Проверяем и возобновляем Web Audio Context
    if (this.audioContext && this.audioContext.state === 'suspended') {
      void this.audioContext.resume().catch(() => {})
    }

    // 2. Проверяем и возобновляем HTMLAudioElement
    if (this.audio && this.audio.paused) {
      void this.audio.play().catch(() => {})
    }

    // 3. Поддерживаем статус MediaSession
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        if (navigator.mediaSession.playbackState !== 'playing') {
          navigator.mediaSession.playbackState = 'playing'
        }
      }
      catch {}
    }
  }

  private startAudioElement(): void {
    try {
      if (!this.audio) {
        this.audio = new Audio()
        this.audio.src = this.SILENT_WAV_URI
        this.audio.loop = true
        this.audio.preload = 'auto'
        this.audio.volume = 0.01 // минимальная ненулевая громкость для предотвращения выгрузки потока ОС
        this.audio.setAttribute('playsinline', 'true')
        this.audio.setAttribute('webkit-playsinline', 'true')

        // Авто-перезапуск при сбоях воспроизведения или паузах ОС
        this.audio.addEventListener('ended', () => {
          if (this.isPlaying && this.audio) {
            void this.audio.play().catch(() => {})
          }
        })
        this.audio.addEventListener('pause', () => {
          if (this.isPlaying && this.audio) {
            setTimeout(() => {
              if (this.isPlaying && this.audio?.paused) {
                void this.audio.play().catch(() => {})
              }
            }, 300)
          }
        })
      }

      const promise = this.audio.play()
      if (promise !== undefined) {
        promise
          .then(() => {
            if ('mediaSession' in navigator) {
              navigator.mediaSession.playbackState = 'playing'
            }
          })
          .catch(() => {
            // Возобновляем при первом пользовательском жесте
            const resumeOnGesture = () => {
              if (this.audio && this.isPlaying) {
                void this.audio.play().catch(() => {})
                this.ensureActive()
              }
            }
            window.addEventListener('touchstart', resumeOnGesture, { once: true })
            window.addEventListener('click', resumeOnGesture, { once: true })
          })
      }
    }
    catch (e) {
      console.warn('[Tracking] Ошибка запуска HTMLAudio keepalive:', e)
    }
  }

  private startWebAudio(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass)
        return

      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioContextClass()
      }

      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume().catch(() => {})
      }

      // Создаем непрерывный буфер тишины на 1 секунду и зацикливаем его
      const sampleRate = this.audioContext.sampleRate || 44100
      const buffer = this.audioContext.createBuffer(1, sampleRate, sampleRate)
      const channelData = buffer.getChannelData(0)
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = 0
      }

      if (this.bufferSource) {
        try {
          this.bufferSource.stop()
          this.bufferSource.disconnect()
        }
        catch {}
      }

      this.bufferSource = this.audioContext.createBufferSource()
      this.bufferSource.buffer = buffer
      this.bufferSource.loop = true

      if (!this.gainNode) {
        this.gainNode = this.audioContext.createGain()
        this.gainNode.gain.value = 0.001
        this.gainNode.connect(this.audioContext.destination)
      }

      this.bufferSource.connect(this.gainNode)
      this.bufferSource.start(0)
    }
    catch (e) {
      console.warn('[Tracking] Ошибка Web Audio keepalive:', e)
    }
  }

  private setupMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator))
      return

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.lastTitle,
        artist: this.lastSubtitle,
        album: 'TripScheduler GPS Tracker',
      })

      navigator.mediaSession.playbackState = 'playing'

      navigator.mediaSession.setActionHandler('play', () => {
        this.isPlaying = true
        this.ensureActive()
      })
      navigator.mediaSession.setActionHandler('pause', () => {
        // Удерживаем воспроизведение активным при попытке ОС приостановить его
        this.ensureActive()
      })
      navigator.mediaSession.setActionHandler('stop', () => {
        this.ensureActive()
      })
    }
    catch (e) {
      console.warn('[Tracking] Ошибка настройки MediaSession:', e)
    }
  }

  public updateNotification(title: string, subtitle?: string): void {
    this.lastTitle = title
    if (subtitle)
      this.lastSubtitle = subtitle

    if (this.updateThrottleTimer)
      return

    this.updateThrottleTimer = setTimeout(() => {
      this.updateThrottleTimer = null
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && this.isPlaying) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: this.lastTitle,
            artist: this.lastSubtitle,
            album: 'TripScheduler GPS Tracker',
          })
          navigator.mediaSession.playbackState = 'playing'
        }
        catch {}
      }
    }, 2000)
  }

  private attachAutoResumeHandlers(): void {
    if (this.boundResumeHandler)
      return

    this.boundResumeHandler = () => {
      if (this.isPlaying) {
        this.ensureActive()
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.boundResumeHandler)
      document.addEventListener('freeze', this.boundResumeHandler)
      document.addEventListener('resume', this.boundResumeHandler)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pageshow', this.boundResumeHandler)
      window.addEventListener('focus', this.boundResumeHandler)
      window.addEventListener('online', this.boundResumeHandler)
    }
  }

  public stop(): void {
    this.isPlaying = false

    if (this.audio) {
      try {
        this.audio.pause()
        this.audio.currentTime = 0
      }
      catch {}
    }

    if (this.bufferSource) {
      try {
        this.bufferSource.stop()
        this.bufferSource.disconnect()
      }
      catch {}
      this.bufferSource = null
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        void this.audioContext.suspend().catch(() => {})
      }
      catch {}
    }

    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none'
        navigator.mediaSession.metadata = null
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('stop', null)
      }
      catch {}
    }
  }
}

// ─── Трекер на базе Web Geolocation API и Tauri Geolocation ──────────────────

class WebGeolocationTracker {
  private watchId: number | null = null
  private tauriWatchId: number | null = null
  private trackingPluginListener: PluginListener | null = null
  private trackingStateListener: PluginListener | null = null
  private batteryOptimizationsIgnored = false
  private wakeLockSentinel: any = null
  private watchdogTimer: ReturnType<typeof setInterval> | null = null
  private keepalive = new BackgroundAudioKeepalive()
  private currentSessionId: string | null = null
  private sessionStartedAt = 0
  private sessionEndedAt = 0
  private sessionDistanceM = 0
  private lastFixPoint: TrackPoint | null = null
  /**
   * Скользящее окно последних принятых фиксов (сырые координаты + точность).
   * Живое состояние («стою / иду / еду») нельзя определять по паре соседних фиксов:
   * при точности 30–40 м дрожание координат даёт «скорость» 5–20 м/с, и сидящий
   * телефон уезжает на велосипеде. Окно 15+ секунд усредняет дрожание геометрией.
   */
  private liveFixes: Array<{ lat: number, lng: number, tsUtc: number, accuracy: number | null }> = []
  /**
   * Наблюдения Activity Recognition от Android: способ перемещения по акселерометру,
   * независимый от GPS. Используется там, где координаты бессильны — телефон сидящего
   * человека в кармане, велосипед на светофоре, медленная езда при плохом приёме.
   */
  private deviceActivitySamples: DeviceActivitySample[] = []
  private stationaryAnchorPoint: TrackPoint | null = null
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
      batteryIgnored: this.batteryOptimizationsIgnored,
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
    this.liveFixes = []
    this.deviceActivitySamples = []
    this.stationaryAnchorPoint = null
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
    void this.drainNativeBufferedPoints()
    this.requestImmediateFix()
    void import('./track-sync').then(m => m.runSync()).catch(() => {})
  }

  private async drainNativeBufferedPoints(): Promise<void> {
    if (!isMobileApp || !this.isRunning)
      return

    try {
      const buffered = await invoke<Array<{
        latitude: number
        longitude: number
        accuracy?: number | null
        altitude?: number | null
        speed?: number | null
        heading?: number | null
        timestamp: number
        activity?: string | null
        activityConfidence?: number | null
      }>>('tracking_get_buffered')

      if (Array.isArray(buffered) && buffered.length > 0) {
        // Сортируем точки по времени, чтобы они воспроизводились строго в хронологическом порядке
        const sorted = [...buffered].sort((a, b) => a.timestamp - b.timestamp)
        for (const pos of sorted) {
          this.handlePositionUpdate({
            coords: {
              latitude: pos.latitude,
              longitude: pos.longitude,
              accuracy: pos.accuracy,
              altitude: pos.altitude,
              speed: pos.speed,
              heading: pos.heading,
            },
            timestamp: pos.timestamp,
            activity: pos.activity,
            activityConfidence: pos.activityConfidence,
          })
        }
        // Запускаем фоновый синк накопившихся точек на сервер
        void import('./track-sync').then(m => m.runSync()).catch(() => {})
      }
    }
    catch (e) {
      console.warn('[Tracking] Ошибка выгрузки буфера точек:', e)
    }
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

    // 2. Нативный Android Foreground Service + Tauri Geolocation Watcher
    if (isMobileApp) {
      try {
        // Проверяем и запрашиваем базовые права локации
        let status = await tauriCheckPermissions()
        if (status.location === 'prompt' || status.location === 'prompt-with-rationale') {
          status = await tauriRequestPermissions(['location', 'coarseLocation'])
        }
        if (status.location === 'denied' && status.coarseLocation === 'denied') {
          this.lastError = 'Доступ к геолокации запрещён в настройках Android. Разрешите доступ в настройках приложения.'
          return
        }

        // Проверяем специфичные Android права для непрерывной работы в фоне
        try {
          const perm = await invoke<{
            location: boolean
            notifications: boolean
            batteryOptimizationsIgnored: boolean
            activityRecognition: boolean
          }>('tracking_check_permissions')

          if (perm) {
            this.batteryOptimizationsIgnored = perm.batteryOptimizationsIgnored

            // На Android 13+ уведомление обязательно для Foreground Service
            if (!perm.notifications) {
              await invoke('tracking_request_notification_permission').catch(() => {})
            }

            // Activity Recognition (Android 10+) — независимый от GPS источник активности.
            // Без него классификация опирается только на координаты, а в покое телефон
            // начинает «видеть» велосипед по дрожанию фиксов.
            if (perm.activityRecognition === false) {
              await invoke('tracking_request_activity_permission').catch(() => {})
            }

            // Предлагаем отключить Doze Mode оптимизацию батареи
            if (!perm.batteryOptimizationsIgnored) {
              await invoke('tracking_request_ignore_battery_optimizations').catch(() => {})
            }
          }
        }
        catch (e) {
          console.warn('[Tracking] Ошибка проверки расширенных прав трекинга:', e)
        }

        // Запускаем системный Android Foreground Service с CPU PARTIAL_WAKE_LOCK и постоянным уведомлением
        await invoke('tracking_start').catch((e) => {
          console.warn('[Tracking] Ошибка запуска нативного сервиса трекинга:', e)
        })

        // Слушатель изменения состояния сервиса (например, нажали «Остановить» в уведомлении)
        try {
          this.trackingStateListener = await addPluginListener<{ running: boolean }>(
            'tracking',
            'trackingStateChanged',
            (state) => {
              if (state && !state.running && this.isRunning) {
                void this.stop()
              }
            },
          )
        }
        catch (e) {
          console.warn('[Tracking] Ошибка подписки на статус сервиса:', e)
        }

        // Подписываемся на непрерывный поток координат из Android сервиса
        try {
          this.trackingPluginListener = await addPluginListener<{
            latitude: number
            longitude: number
            accuracy?: number | null
            altitude?: number | null
            speed?: number | null
            heading?: number | null
            timestamp?: number
            activity?: string | null
            activityConfidence?: number | null
          }>('tracking', 'locationUpdate', (pos) => {
            if (pos && typeof pos.latitude === 'number' && typeof pos.longitude === 'number') {
              this.handlePositionUpdate({
                coords: {
                  latitude: pos.latitude,
                  longitude: pos.longitude,
                  accuracy: pos.accuracy,
                  altitude: pos.altitude,
                  speed: pos.speed,
                  heading: pos.heading,
                },
                timestamp: pos.timestamp || Date.now(),
                activity: pos.activity,
                activityConfidence: pos.activityConfidence,
              })
            }
          })
        }
        catch (e) {
          console.warn('[Tracking] Ошибка подписки на события сервиса трекинга:', e)
        }

        // Выгружаем накопленные за время выключения точки
        void this.drainNativeBufferedPoints()

        // Дополнительно запускаем плагинный watchPosition пока экран включен
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
              this.handlePositionUpdate({
                coords: {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                  altitude: pos.coords.altitude,
                  speed: pos.coords.speed,
                  heading: pos.coords.heading,
                },
                timestamp: pos.timestamp,
              })
            }
          },
        )
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

    if (isMobileApp) {
      void invoke('tracking_stop').catch((e) => {
        console.warn('[Tracking] Ошибка остановки нативного сервиса трекинга:', e)
      })

      if (this.trackingPluginListener) {
        void this.trackingPluginListener.unregister().catch(() => {})
        this.trackingPluginListener = null
      }

      if (this.trackingStateListener) {
        void this.trackingStateListener.unregister().catch(() => {})
        this.trackingStateListener = null
      }
    }
  }

  private startWatchdog(): void {
    this.stopWatchdog()
    this.watchdogTimer = setInterval(() => {
      if (!this.isRunning) {
        this.stopWatchdog()
        return
      }

      // Поддерживаем активность аудио-пайплайна и системного WakeLock
      this.keepalive.ensureActive()
      void this.acquireWakeLock()
      void this.drainNativeBufferedPoints()

      const now = Date.now()
      const timeSinceLastFix = this.lastFixPoint ? (now - this.lastFixPoint.tsUtc) : (now - this.sessionStartedAt)

      // Если координаты не поступали более 20 секунд, принудительно запрашиваем фикс через оба канала
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
    // 1. Web Geolocation fix
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => this.handlePositionUpdate(pos),
        err => console.warn('[Tracking] Ошибка web immediate fix:', err?.message || err),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
      )
    }

    // 2. Tauri native FusedLocationProviderClient fix
    if (isMobileApp) {
      tauriGetCurrentPosition({ enableHighAccuracy: true, timeout: 8000, maximumAge: 0 })
        .then((pos) => {
          if (pos) {
            this.handlePositionUpdate({
              coords: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                altitude: pos.coords.altitude,
                speed: pos.coords.speed,
                heading: pos.coords.heading,
              },
              timestamp: pos.timestamp,
            })
          }
        })
        .catch((err) => {
          console.warn('[Tracking] Ошибка tauri immediate fix:', err)
        })
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
        let status = await tauriCheckPermissions()
        if (status.location !== 'granted' && status.coarseLocation !== 'granted') {
          status = await tauriRequestPermissions(['location', 'coarseLocation'])
        }

        const isGranted = status.location === 'granted' || status.coarseLocation === 'granted'
        if (!isGranted) {
          this.lastError = 'Доступ к геолокации запрещён. Для непрерывной записи при выключенном экране выберите «Разрешить в любом режиме» (Allow all the time) в настройках приложения Android.'
          return false
        }
        return true
      }
      catch (e: any) {
        const msg = e?.message || String(e)
        this.lastError = `Ошибка запроса прав геолокации: ${msg}`
        console.warn('[Tracking] Ошибка запроса прав в Tauri:', e)
        return false
      }
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          (err) => {
            this.handlePositionError(err)
            resolve(false)
          },
          { timeout: 10000, enableHighAccuracy: true },
        )
      })
    }

    return false
  }

  public async checkPermissions(): Promise<{
    location: boolean
    notifications: boolean
    batteryOptimizationsIgnored: boolean
    activityRecognition: boolean
  } | null> {
    if (!isMobileApp)
      return null
    try {
      const perm = await invoke<{
        location: boolean
        notifications: boolean
        batteryOptimizationsIgnored: boolean
        activityRecognition: boolean
      }>('tracking_check_permissions')
      if (perm) {
        this.batteryOptimizationsIgnored = perm.batteryOptimizationsIgnored
      }
      return perm
    }
    catch {
      return null
    }
  }

  /**
   * Разрешение на распознавание активности (Android 10+). Оно не критично: без него
   * трекер продолжает работать по координатам, поэтому отказ не считается ошибкой.
   */
  public async requestActivityPermission(): Promise<boolean> {
    if (!isMobileApp)
      return true
    try {
      const res = await invoke<boolean>('tracking_request_activity_permission')
      await this.checkPermissions()
      return res
    }
    catch {
      return false
    }
  }

  public async requestIgnoreBatteryOptimizations(): Promise<boolean> {
    if (!isMobileApp)
      return true
    try {
      const res = await invoke<boolean>('tracking_request_ignore_battery_optimizations')
      await this.checkPermissions()
      return res
    }
    catch {
      return false
    }
  }

  public async openAppSettings(): Promise<boolean> {
    if (!isMobileApp)
      return false
    try {
      return await invoke<boolean>('tracking_open_app_settings')
    }
    catch {
      return false
    }
  }

  /**
   * Регистрирует наблюдение Activity Recognition от Android. Окно ограничено по времени и
   * по количеству: старое наблюдение не должно влиять на текущее состояние.
   */
  private pushDeviceActivity(sample: DeviceActivitySample): void {
    if (!sample.tsUtc)
      sample.tsUtc = Date.now()
    this.deviceActivitySamples.push(sample)
    const from = Date.now() - DEVICE_ACTIVITY_WINDOW_MS
    this.deviceActivitySamples = this.deviceActivitySamples.filter(s => s.tsUtc >= from).slice(-10)
  }

  /**
   * Активность, подтверждённая устройством. Доверяем только повторяющемуся сигналу
   * (≥2 наблюдения с уверенностью ≥50): одиночный перескок Activity Recognition не должен
   * переворачивать состояние момента.
   */
  private deviceRecoHint(): { activity: ActivityType, confidence: number } | null {
    const trusted = this.deviceActivitySamples.filter(s => s.confidence >= DEVICE_ACTIVITY_MIN_CONFIDENCE)
    if (trusted.length < DEVICE_ACTIVITY_MIN_VOTES)
      return null

    const weights = new Map<ActivityType, number>()
    for (const s of trusted)
      weights.set(s.activity, (weights.get(s.activity) ?? 0) + s.confidence)

    let best: ActivityType | null = null
    let bestWeight = 0
    let bestVotes = 0
    for (const [act, weight] of weights) {
      if (weight > bestWeight) {
        best = act
        bestWeight = weight
        bestVotes = trusted.filter(s => s.activity === act).length
      }
    }
    if (!best || bestVotes < DEVICE_ACTIVITY_MIN_VOTES)
      return null

    return { activity: best, confidence: Math.round(bestWeight / bestVotes) }
  }

  /**
   * Итоговая активность момента. Геометрия окна — арбитр (она проверяема), сигнал устройства —
   * решающий голос там, где GPS слеп: движение без смещения координат (телефон в кармане,
   * велосипед на светофоре, медленная езда при плохом приёме). Ровно поэтому «сижу, а трекер
   * говорит велосипед» больше не возникает: без подтверждённого смещения поверить можно только
   * самому устройству, а оно в покое уверенно сообщает STILL.
   */
  private resolveLiveActivity(
    evidence: ReturnType<typeof movementEvidence>,
    speedMs: number,
  ): { activity: ActivityType, confidence: number } {
    if (evidence.credible)
      return { activity: estimateActivity(speedMs), confidence: 88 }

    const device = this.deviceRecoHint()
    if (device)
      return { activity: device.activity, confidence: Math.max(DEVICE_ACTIVITY_MIN_CONFIDENCE, Math.min(95, device.confidence)) }

    return { activity: 'still', confidence: 95 }
  }

  private handlePositionUpdate(pos: {
    coords: {
      latitude: number
      longitude: number
      accuracy?: number | null
      altitude?: number | null
      heading?: number | null
      speed?: number | null
    }
    timestamp?: number
    /** Активность из системного Activity Recognition (Android-плагин трекинга). */
    activity?: string | null
    /** Уверенность Activity Recognition, 0..100 или 0..1. */
    activityConfidence?: number | null
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

    const speed = typeof coords.speed === 'number' && Number.isFinite(coords.speed) && coords.speed >= 0 ? coords.speed : null
    let bearing = typeof coords.heading === 'number' && Number.isFinite(coords.heading) && coords.heading >= 0 ? coords.heading : null

    let dM = 0
    let gapDetected = false

    if (this.lastFixPoint) {
      dM = haversineM(this.lastFixPoint.lat, this.lastFixPoint.lng, lat, lng)

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
          // Окно живой оценки тоже сбрасываем: его координаты принадлежат «сбойной» серии
          this.liveFixes = []
          this.consecutiveRejectedCount = 0
        }
        return
      }

      this.consecutiveRejectedCount = 0

      // Если девайс не отдал азимут, рассчитываем
      if (bearing === null && dM > 3) {
        bearing = bearingDeg(this.lastFixPoint.lat, this.lastFixPoint.lng, lat, lng)
      }

      gapDetected = validity.isGap
    }

    // Живое состояние определяем по окну последних фиксов, а не по паре соседних:
    // при точности 30-40 м дрожание координат даёт «мгновенную скорость» 5-20 м/с
    // и сидящий телефон уезжает на велосипеде. Окно даёт прямое смещение, которое
    // сравнивается с погрешностью: не превышает — значит перемещение не доказано.
    this.liveFixes.push({ lat, lng, tsUtc: ts, accuracy })
    const liveWindowFrom = ts - LIVE_FIXES_WINDOW_MS
    this.liveFixes = this.liveFixes.filter(f => f.tsUtc >= liveWindowFrom).slice(-LIVE_FIXES_MAX)
    const evidence = movementEvidence(this.liveFixes)
    const speedMs = trustedSpeedMs(evidence, speed)

    // Сигнал Activity Recognition добавляем в окно наблюдений и используем как решающий
    // голос там, где геометрия не подтверждает перемещение.
    const deviceSample = normalizeDeviceActivity(pos.activity, pos.activityConfidence)
    if (deviceSample)
      this.pushDeviceActivity(deviceSample)
    const deviceActivity = deviceSample?.activity ?? null
    const deviceActivityConfidence = deviceSample?.confidence ?? null

    const resolved = this.resolveLiveActivity(evidence, speedMs)
    const activity = resolved.activity
    const activityConfidence = resolved.confidence

    // Одометр: прибавляем дистанцию только когда перемещение подтверждено окном,
    // иначе дрожание стоящего устройства накручивает километры.
    if (this.lastFixPoint && dM >= 1.5 && speedMs >= 0.3 && !gapDetected) {
      this.sessionDistanceM += dM
    }

    // Перемещение не подтверждено окном (activity === 'still'): группируем точки
    // в радиусе 5 метров, предотвращая создание сотен одинаковых точек в БД.
    // При нахождении на месте мы обновляем последнюю точку / телеметрию,
    // а новую точку в очередь пишем только раз в 3 минуты (или при выходе из радиуса 5м).
    const isStationary = activity === 'still'
    if (isStationary) {
      if (!this.stationaryAnchorPoint) {
        this.stationaryAnchorPoint = {
          clientPointId: uuidv4(),
          tsUtc: ts,
          lat,
          lng,
          altitude,
          accuracy,
          speed: 0,
          bearing,
          activity: 'still',
          activityConfidence,
          sessionId: this.currentSessionId || uuidv4(),
          deviceActivity,
          deviceActivityConfidence,
        }
      }
      else {
        const distFromAnchor = haversineM(this.stationaryAnchorPoint.lat, this.stationaryAnchorPoint.lng, lat, lng)
        if (distFromAnchor <= 5.0) {
          // Устройство всё ещё в пределах 5 метров от якорной стоянки.
          // Если с момента последней сохраненной точки прошло менее 3 минут,
          // обновляем только телеметрию и текущую точку, не создавая дубликат в очереди.
          const timeSinceLastSaved = this.lastFixPoint ? (ts - this.lastFixPoint.tsUtc) : 0
          if (timeSinceLastSaved < 3 * 60 * 1000) {
            // Обновляем текущее состояние без засорения БД
            const updatedPoint: TrackPoint = {
              clientPointId: this.lastFixPoint?.clientPointId || this.stationaryAnchorPoint.clientPointId,
              tsUtc: ts,
              lat: this.stationaryAnchorPoint.lat,
              lng: this.stationaryAnchorPoint.lng,
              altitude,
              accuracy,
              speed: 0,
              bearing,
              activity: 'still',
              activityConfidence,
              sessionId: this.currentSessionId || uuidv4(),
              deviceActivity,
              deviceActivityConfidence,
            }
            this.lastFixPoint = updatedPoint

            writeStoredSession({
              sessionId: this.currentSessionId || updatedPoint.sessionId,
              startedAt: this.sessionStartedAt,
              distanceM: this.sessionDistanceM,
              lastPoint: updatedPoint,
              isRunning: this.isRunning,
            })
            return
          }
        }
        else {
          // Вышли за 5м — сбрасываем старый якорь
          this.stationaryAnchorPoint = null
        }
      }
    }
    else {
      // Перемещение подтверждено окном — выходим из режима стоянки
      this.stationaryAnchorPoint = null
    }

    const point: TrackPoint = {
      clientPointId: uuidv4(),
      tsUtc: ts,
      lat,
      lng,
      altitude,
      accuracy,
      speed: speedMs,
      bearing,
      activity,
      activityConfidence,
      sessionId: this.currentSessionId || uuidv4(),
      deviceActivity,
      deviceActivityConfidence,
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

    // Обновляем живую телеметрию в шторке уведомлений Android
    const distFormatted = this.sessionDistanceM >= 1000
      ? `${(this.sessionDistanceM / 1000).toFixed(2)} км`
      : `${Math.round(this.sessionDistanceM)} м`
    const speedFormatted = speedMs > 0.3 ? `${Math.round(speedMs * 3.6)} км/ч` : '0 км/ч'
    this.keepalive.updateNotification(
      `Запись GPS: ${distFormatted} • ${speedFormatted}`,
      'TripScheduler • Фоновый трекинг активен',
    )
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

  async checkPermissions() {
    return trackerInstance.checkPermissions()
  },

  async requestIgnoreBatteryOptimizations(): Promise<boolean> {
    return trackerInstance.requestIgnoreBatteryOptimizations()
  },

  async openAppSettings(): Promise<boolean> {
    return trackerInstance.openAppSettings()
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

  // Сигнал Activity Recognition: не валидируем строго — отсутствие поля допустимо,
  // испорченное значение отбрасываем, чтобы не тащить мусор в классификацию дня.
  const deviceRaw = r.deviceActivity
  const deviceActivity = typeof deviceRaw === 'string' && activities.includes(deviceRaw as ActivityType)
    ? deviceRaw as ActivityType
    : null
  const rawDeviceConf = num(r.deviceActivityConfidence) ? (r.deviceActivityConfidence as number) : null
  const deviceActivityConfidence = rawDeviceConf == null
    ? null
    : Math.round(rawDeviceConf > 0 && rawDeviceConf <= 1 ? rawDeviceConf * 100 : Math.min(100, Math.max(0, rawDeviceConf)))

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
    deviceActivity,
    deviceActivityConfidence,
  }
}
