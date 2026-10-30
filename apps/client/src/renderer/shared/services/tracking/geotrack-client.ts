import type { TrackActivityType } from '@limiteddissolve/track-processing'
import type { PluginListener } from '@tauri-apps/api/core'
import { bearingDeg, evaluatePointValidity, haversineM, MAX_ACCURACY_M, movementEvidence, prepareTrack } from '@limiteddissolve/track-processing'
import { addPluginListener, invoke } from '@tauri-apps/api/core'
import {
  checkPermissions as tauriCheckPermissions,
  getCurrentPosition as tauriGetCurrentPosition,
  requestPermissions as tauriRequestPermissions,
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

function getTelemetrySpeedKmh(fix: TrackPoint | null): number | null {
  return fix?.activity === 'still' ? 0 : fix?.speed != null ? Math.round(fix.speed * 3.6) : null
}

function getTelemetryPosition(fix: TrackPoint | null): Pick<TrackingTelemetry, 'activity' | 'lat' | 'lng'> {
  return {
    activity: fix?.activity || 'still',
    lat: fix?.lat ?? null,
    lng: fix?.lng ?? null,
  }
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

interface DeviceActivitySample {
  activity: ActivityType
  confidence: number
  tsUtc: number
}

interface NativeTrackingPosition {
  latitude: number
  longitude: number
  accuracy?: number | null
  altitude?: number | null
  speed?: number | null
  heading?: number | null
  timestamp?: number
  activity?: string | null
  activityConfidence?: number | null
}

interface PositionUpdate {
  coords: {
    latitude: number
    longitude: number
    accuracy?: number | null
    altitude?: number | null
    heading?: number | null
    speed?: number | null
  }
  timestamp?: number
  activity?: string | null
  activityConfidence?: number | null
}

interface NormalizedFix {
  ts: number
  lat: number
  lng: number
  altitude: number | null
  accuracy: number | null
  speed: number | null
  bearing: number | null
}

interface ResolvedFixActivity {
  activity: ActivityType
  confidence: number
  speedMs: number
  deviceActivity: ActivityType | null
  deviceActivityConfidence: number | null
}

function getFiniteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getNonNegativeNumber(value: number | null | undefined): number | null {
  const number = getFiniteNumber(value)

  return number !== null && number >= 0 ? number : null
}

function hasValidCoordinates(lat: number, lng: number): boolean {
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && Math.abs(lat) <= 90
    && Math.abs(lng) <= 180
}

function hasAcceptableAccuracy(accuracy: number | null): boolean {
  return accuracy === null || (accuracy >= 0 && accuracy <= MAX_ACCURACY_M)
}

function normalizePositionUpdate(position: PositionUpdate, lastPoint: TrackPoint | null): NormalizedFix | null {
  const ts = position.timestamp && position.timestamp > 0 ? position.timestamp : Date.now()
  const { latitude: lat, longitude: lng } = position.coords

  if ((lastPoint && ts <= lastPoint.tsUtc) || !hasValidCoordinates(lat, lng))
    return null

  const accuracy = getFiniteNumber(position.coords.accuracy)

  if (!hasAcceptableAccuracy(accuracy))
    return null

  return {
    ts,
    lat,
    lng,
    altitude: getFiniteNumber(position.coords.altitude),
    accuracy,
    speed: getNonNegativeNumber(position.coords.speed),
    bearing: getNonNegativeNumber(position.coords.heading),
  }
}

function toPositionUpdate(position: NativeTrackingPosition): PositionUpdate | null {
  if (typeof position.latitude !== 'number' || typeof position.longitude !== 'number')
    return null

  return {
    coords: {
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      altitude: position.altitude,
      speed: position.speed,
      heading: position.heading,
    },
    timestamp: position.timestamp || Date.now(),
    activity: position.activity,
    activityConfidence: position.activityConfidence,
  }
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

/** Активность по скорости из окна фиксов: границы согласованы с пакетом @limiteddissolve/track-processing. */
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
function trustedSpeedMs(evidence: ReturnType<typeof movementEvidence>, deviceSpeedMs: number | null): number {
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

      this.stopBufferSource()

      this.bufferSource = this.audioContext.createBufferSource()
      this.bufferSource.buffer = this.createSilenceBuffer(this.audioContext)
      this.bufferSource.loop = true
      const gainNode = this.ensureGainNode(this.audioContext)
      this.bufferSource.connect(gainNode)
      this.bufferSource.start(0)
    }
    catch (e) {
      console.warn('[Tracking] Ошибка Web Audio keepalive:', e)
    }
  }

  private createSilenceBuffer(context: AudioContext): AudioBuffer {
    const sampleRate = context.sampleRate || 44100
    const buffer = context.createBuffer(1, sampleRate, sampleRate)
    const channelData = buffer.getChannelData(0)

    for (let i = 0; i < channelData.length; i++)
      channelData[i] = 0

    return buffer
  }

  private stopBufferSource() {
    if (!this.bufferSource)
      return

    try {
      this.bufferSource.stop()
      this.bufferSource.disconnect()
    }
    catch {}
  }

  private ensureGainNode(context: AudioContext): GainNode {
    if (this.gainNode)
      return this.gainNode

    const gainNode = context.createGain()
    gainNode.gain.value = 0.001
    gainNode.connect(context.destination)
    this.gainNode = gainNode

    return gainNode
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
    this.stopHtmlAudio()
    this.stopWebAudio()
    this.resetMediaSession()
  }

  private stopHtmlAudio() {
    if (!this.audio)
      return

    try {
      this.audio.pause()
      this.audio.currentTime = 0
    }
    catch {}
  }

  private stopWebAudio() {
    this.stopBufferSource()
    this.bufferSource = null

    if (!this.audioContext || this.audioContext.state === 'closed')
      return

    try {
      void this.audioContext.suspend().catch(() => {})
    }
    catch {}
  }

  private resetMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator))
      return

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

// ─── Трекер на базе Web Geolocation API и Tauri Geolocation ──────────────────

class WebGeolocationTracker {
  private watchId: number | null = null
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
  private recentMeasurements: TrackPoint[] = []
  private recentDistanceM = 0
  private displayFix: TrackPoint | null = null
  private displayStopAnchor: { lat: number, lng: number } | null = null
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
  private lastError: string | null = null
  private isRunning = false
  private consecutiveRejectedCount = 0
  private sessionGeneration = 0
  private wakeLockRequestId = 0
  private wakeLockAcquiring = false

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

  private getTelemetry(now: number): TrackingTelemetry | undefined {
    if (!this.isRunning && !this.lastFixPoint)
      return undefined

    const fix = this.displayFix ?? this.lastFixPoint
    const position = getTelemetryPosition(fix)

    return {
      speedKmh: getTelemetrySpeedKmh(fix),
      accuracyM: this.getTelemetryAccuracy(),
      distanceM: Math.round(this.sessionDistanceM),
      durationMs: this.getTelemetryDuration(now),
      ...position,
    }
  }

  private getTelemetryAccuracy(): number | null {
    const accuracy = this.lastFixPoint?.accuracy

    return accuracy != null ? Math.round(accuracy) : null
  }

  private getTelemetryDuration(now: number): number {
    const endTs = this.isRunning ? now : (this.sessionEndedAt || this.lastFixPoint?.tsUtc || now)

    return this.sessionStartedAt > 0 ? Math.max(0, endTs - this.sessionStartedAt) : 0
  }

  public getStatus(): TrackingStatus {
    const unsent = readStoredPoints()

    return {
      running: this.isRunning,
      unsentCount: unsent.length,
      network: detectNetwork(),
      lastFixTsUtc: this.lastFixPoint?.tsUtc ?? null,
      batteryIgnored: this.batteryOptimizationsIgnored,
      telemetry: this.getTelemetry(Date.now()),
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
    const generation = ++this.sessionGeneration

    // Начинаем новую сессию
    this.currentSessionId = uuidv4()
    this.sessionStartedAt = Date.now()
    this.sessionEndedAt = 0
    this.sessionDistanceM = 0
    this.recentMeasurements = []
    this.recentDistanceM = 0
    this.displayFix = null
    this.displayStopAnchor = null
    this.lastFixPoint = null
    this.liveFixes = []
    this.deviceActivitySamples = []
    this.isRunning = true

    writeStoredSession({
      sessionId: this.currentSessionId,
      startedAt: this.sessionStartedAt,
      distanceM: 0,
      lastPoint: null,
      isRunning: true,
    })

    try {
      void this.acquireWakeLock(generation)
      this.keepalive.start()
      await this.startWatchers(generation)
      this.startWatchdog()
      this.requestImmediateFix()

      return this.getStatus()
    }
    catch (e) {
      await this.stop()
      const msg = e instanceof Error ? e.message : String(e)
      this.lastError = msg
      throw e
    }
  }

  /** Автоматическое возобновление ранее активной сессии после перезапуска/сворачивания */
  private async resumeTracking(): Promise<void> {
    if (!this.isRunning)
      return

    const generation = ++this.sessionGeneration

    try {
      void this.acquireWakeLock(generation)
      this.keepalive.start()
      await this.startWatchers(generation)
      this.startWatchdog()
      this.requestImmediateFix()

      // Запускаем синк точек, накопившихся в буфере
      void import('./track-sync').then(m => m.runSync()).catch(() => {})
    }
    catch (e) {
      console.warn('[Tracking] Ошибка возобновления трекинга:', e)
      await this.stop()
    }
  }

  private canAcquireWakeLock(generation?: number): boolean {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator))
      return false

    if (!this.isRunning || (generation !== undefined && generation !== this.sessionGeneration))
      return false

    if (this.wakeLockSentinel && !this.wakeLockSentinel.released)
      return false

    return !this.wakeLockAcquiring
  }

  private isCurrentWakeLockRequest(timedOut: boolean, generation: number, requestId: number): boolean {
    return !timedOut
      && this.isRunning
      && this.sessionGeneration === generation
      && this.wakeLockRequestId === requestId
  }

  private async requestWakeLock(generation: number, requestId: number): Promise<any | null> {
    let timedOut = false
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined

    const rawPromise: Promise<any> = (navigator as any).wakeLock.request('screen')
    const safePromise = rawPromise
      .then((sentinel: any) => {
        if (this.isCurrentWakeLockRequest(timedOut, generation, requestId))
          return sentinel

        void sentinel.release().catch(() => {})

        return null
      })
      .catch(() => null)

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        timedOut = true
        reject(new Error('WakeLock timeout'))
      }, 2000)
    })

    try {
      return await Promise.race([safePromise, timeoutPromise])
    }
    finally {
      clearTimeout(timeoutTimer)
    }
  }

  private shouldResumeWakeLock(generation: number): boolean {
    return this.isRunning
      && this.sessionGeneration === generation
      && typeof document !== 'undefined'
      && document.visibilityState === 'visible'
  }

  private registerWakeLock(sentinel: any, generation: number) {
    if (this.wakeLockSentinel && this.wakeLockSentinel !== sentinel && !this.wakeLockSentinel.released)
      void this.wakeLockSentinel.release().catch(() => {})

    this.wakeLockSentinel = sentinel
    sentinel.addEventListener('release', () => {
      if (this.wakeLockSentinel === sentinel)
        this.wakeLockSentinel = null

      if (this.shouldResumeWakeLock(generation))
        void this.acquireWakeLock(generation)
    })
  }

  private async acquireWakeLock(generation?: number): Promise<void> {
    if (!this.canAcquireWakeLock(generation))
      return

    this.wakeLockAcquiring = true
    const currentRequestId = ++this.wakeLockRequestId
    const currentGen = generation ?? this.sessionGeneration

    try {
      const sentinel = await this.requestWakeLock(currentGen, currentRequestId)

      if (!sentinel)
        return

      this.registerWakeLock(sentinel, currentGen)
    }
    catch {
      // Игнорируем отказ или таймаут в wake lock (не критично для трекинга)
    }
    finally {
      this.wakeLockAcquiring = false
    }
  }

  private async releaseWakeLock(): Promise<void> {
    // Инвалидируем любые текущие и будущие разрешения in-flight запросов acquireWakeLock
    this.wakeLockRequestId++

    if (this.wakeLockSentinel) {
      const sentinel = this.wakeLockSentinel
      this.wakeLockSentinel = null

      try {
        let timeoutTimer: any
        const relPromise = sentinel.release()
        const timeoutPromise = new Promise((resolve) => {
          timeoutTimer = setTimeout(resolve, 1000)
        })
        await Promise.race([relPromise, timeoutPromise])
        clearTimeout(timeoutTimer)
      }
      catch {
        // игнорируем
      }
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

    void this.acquireWakeLock(this.sessionGeneration)
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

  private async startWatchers(generation: number): Promise<void> {
    this.stopWatchers()

    // 1. Web Geolocation Watcher (работает внутри Chromium WebView при активном аудио-кипаливе)
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        this.watchId = navigator.geolocation.watchPosition(pos => this.handlePositionUpdate(pos), err => this.handlePositionError(err), {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 15000,
        })
      }
      catch (e) {
        console.warn('[Tracking] Web watchPosition failed:', e)
      }
    }

    // 2. Нативный Android Foreground Service. Он является основным непрерывным
    // источником координат на мобильном устройстве и работает при погашенном экране.
    if (isMobileApp) {
      await this.startNativeWatchers(generation)
    }
  }

  private async ensureBaseLocationPermission(isCurrent: () => boolean): Promise<boolean> {
    let status = await tauriCheckPermissions()

    if (!isCurrent())
      return false

    if (status.location === 'prompt' || status.location === 'prompt-with-rationale') {
      status = await tauriRequestPermissions(['location', 'coarseLocation'])

      if (!isCurrent())
        return false
    }

    if (status.location === 'denied' && status.coarseLocation === 'denied')
      throw new Error('Доступ к геолокации запрещён в настройках Android. Разрешите доступ в настройках приложения.')

    return true
  }

  private async requestAndroidPermissionIfNeeded(needed: boolean, command: string, isCurrent: () => boolean): Promise<boolean> {
    if (needed)
      await invoke(command).catch(() => {})

    return isCurrent()
  }

  private async requestAdditionalAndroidPermissions(isCurrent: () => boolean): Promise<boolean> {
    try {
      const permissions = await invoke<{
        location: boolean
        notifications: boolean
        batteryOptimizationsIgnored: boolean
        activityRecognition: boolean
      }>('tracking_check_permissions')

      if (!isCurrent())
        return false

      if (!permissions)
        return true

      this.batteryOptimizationsIgnored = permissions.batteryOptimizationsIgnored

      const requests: Array<[boolean, string]> = [
        [!permissions.notifications, 'tracking_request_notification_permission'],
        [permissions.activityRecognition === false, 'tracking_request_activity_permission'],
        [!permissions.batteryOptimizationsIgnored, 'tracking_request_ignore_battery_optimizations'],
      ]

      for (const [needed, command] of requests) {
        if (!await this.requestAndroidPermissionIfNeeded(needed, command, isCurrent))
          return false
      }

      return true
    }
    catch (error) {
      console.warn('[Tracking] Ошибка проверки расширенных прав трекинга:', error)

      return isCurrent()
    }
  }

  private async listenNativeLocations(isCurrent: () => boolean): Promise<boolean> {
    const listener = await addPluginListener<NativeTrackingPosition>('tracking', 'locationUpdate', (position) => {
      if (!isCurrent())
        return

      const update = toPositionUpdate(position)

      if (update)
        this.handlePositionUpdate(update)
    })

    if (!isCurrent()) {
      void listener.unregister().catch(() => {})
      void invoke('tracking_stop').catch(() => {})

      return false
    }

    this.trackingPluginListener = listener
    void this.drainNativeBufferedPoints()

    return true
  }

  private async startNativeForegroundService(isCurrent: () => boolean): Promise<void> {
    await invoke('tracking_start')

    if (!isCurrent()) {
      void invoke('tracking_stop').catch(() => {})

      return
    }

    const stateListener = await addPluginListener<{ running: boolean }>('tracking', 'trackingStateChanged', (state) => {
      if (state && !state.running && isCurrent())
        void this.stop()
    })

    if (!isCurrent()) {
      void stateListener.unregister().catch(() => {})
      void invoke('tracking_stop').catch(() => {})

      return
    }

    this.trackingStateListener = stateListener
    await this.listenNativeLocations(isCurrent)
  }

  private async startNativeWatchers(generation: number): Promise<void> {
    const isCurrent = () => this.isRunning && this.sessionGeneration === generation

    if (!await this.ensureBaseLocationPermission(isCurrent))
      return

    if (!await this.requestAdditionalAndroidPermissions(isCurrent))
      return

    if (!isCurrent())
      return

    await this.startNativeForegroundService(isCurrent)
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
      navigator.geolocation.getCurrentPosition(pos => this.handlePositionUpdate(pos), err => console.warn('[Tracking] Ошибка web immediate fix:', err?.message || err), { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 })
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
    this.sessionGeneration++
    this.isRunning = false
    this.stopWatchers()
    this.stopWatchdog()
    this.keepalive.stop()
    void this.releaseWakeLock()

    if (this.sessionStartedAt > 0) {
      this.sessionEndedAt = Date.now()
    }

    writeStoredSession(null)

    return this.getStatus()
  }

  private async requestMobilePermission(): Promise<boolean> {
    try {
      let status = await tauriCheckPermissions()

      if (status.location !== 'granted' && status.coarseLocation !== 'granted')
        status = await tauriRequestPermissions(['location', 'coarseLocation'])

      const isGranted = status.location === 'granted' || status.coarseLocation === 'granted'

      if (isGranted)
        return true

      this.lastError = 'Доступ к геолокации запрещён. Для непрерывной записи при выключенном экране выберите «Разрешить в любом режиме» (Allow all the time) в настройках приложения Android.'

      return false
    }
    catch (error: any) {
      const message = error?.message || String(error)
      this.lastError = `Ошибка запроса прав геолокации: ${message}`
      console.warn('[Tracking] Ошибка запроса прав в Tauri:', error)

      return false
    }
  }

  private requestBrowserPermission(): Promise<boolean> {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(() => resolve(true), (error) => {
        this.handlePositionError(error)
        resolve(false)
      }, { timeout: 10000, enableHighAccuracy: true })
    })
  }

  public async requestPermission(): Promise<boolean> {
    if (isMobileApp)
      return this.requestMobilePermission()

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator)
      return this.requestBrowserPermission()

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
    const from = sample.tsUtc - DEVICE_ACTIVITY_WINDOW_MS
    this.deviceActivitySamples = this.deviceActivitySamples.filter(s => s.tsUtc >= from).slice(-10)
  }

  /**
   * Последнее состояние Transition API. Повторение в GPS-фиксах не повышает его вес.
   */
  private deviceRecoHint(): { activity: ActivityType, confidence: number } | null {
    // Transition events represent a persistent state; repeated GPS fixes are not independent votes.
    const latest = this.deviceActivitySamples[this.deviceActivitySamples.length - 1]

    return latest && latest.confidence >= DEVICE_ACTIVITY_MIN_CONFIDENCE
      ? { activity: latest.activity, confidence: latest.confidence }
      : null
  }

  /**
   * Итоговая активность момента. Геометрия окна — арбитр (она проверяема), сигнал устройства —
   * решающий голос там, где GPS слеп: движение без смещения координат (телефон в кармане,
   * велосипед на светофоре, медленная езда при плохом приёме). Ровно поэтому «сижу, а трекер
   * говорит велосипед» больше не возникает: без подтверждённого смещения поверить можно только
   * самому устройству, а оно в покое уверенно сообщает STILL.
   */
  private resolveLiveActivity(evidence: ReturnType<typeof movementEvidence>, speedMs: number): { activity: ActivityType, confidence: number } {
    const device = this.deviceRecoHint()

    if (device?.activity === 'still' && !evidence.credible)
      return device

    if (device && device.activity !== 'still')
      return device

    if (evidence.credible)
      return { activity: estimateActivity(speedMs), confidence: 88 }

    if (device)
      return { activity: device.activity, confidence: Math.max(DEVICE_ACTIVITY_MIN_CONFIDENCE, Math.min(95, device.confidence)) }

    return { activity: 'still', confidence: 95 }
  }

  private shouldRejectPosition(fix: NormalizedFix): boolean {
    const previous = this.lastFixPoint

    if (!previous)
      return false

    const distance = haversineM(
      previous.lat,
      previous.lng,
      fix.lat,
      fix.lng,
    )

    if (distance < 1 && fix.ts - previous.tsUtc < 800)
      return true

    const validity = evaluatePointValidity({ ...fix, tsUtc: fix.ts }, previous)

    if (!validity.isValid) {
      this.consecutiveRejectedCount++
      console.warn(`[Tracking] Точка пропущена из-за аномалии (${this.consecutiveRejectedCount}/3): ${validity.reason}`)
      this.resetAnchorAfterRepeatedRejections()

      return true
    }

    this.consecutiveRejectedCount = 0

    if (fix.bearing === null && distance > 3) {
      fix.bearing = bearingDeg(
        previous.lat,
        previous.lng,
        fix.lat,
        fix.lng,
      )
    }

    return false
  }

  private resetAnchorAfterRepeatedRejections() {
    if (this.consecutiveRejectedCount < 3)
      return

    console.warn('[Tracking] Серия отклонений: сброс якорной точки и перекалибровка на новые координаты.')
    this.lastFixPoint = null
    this.liveFixes = []
    this.consecutiveRejectedCount = 0
  }

  private resolvePositionActivity(fix: NormalizedFix, position: PositionUpdate): ResolvedFixActivity {
    // A rolling window distinguishes real movement from GPS drift while stationary.
    this.liveFixes.push({ lat: fix.lat, lng: fix.lng, tsUtc: fix.ts, accuracy: fix.accuracy })
    const liveWindowFrom = fix.ts - LIVE_FIXES_WINDOW_MS
    this.liveFixes = this.liveFixes.filter(item => item.tsUtc >= liveWindowFrom).slice(-LIVE_FIXES_MAX)
    const evidence = movementEvidence(this.liveFixes)
    const speedMs = trustedSpeedMs(evidence, fix.speed)
    const deviceSample = normalizeDeviceActivity(position.activity, position.activityConfidence)

    this.updateDeviceActivitySamples(deviceSample, fix.ts)

    const resolved = this.resolveLiveActivity(evidence, speedMs)

    return {
      ...resolved,
      speedMs,
      deviceActivity: deviceSample?.activity ?? null,
      deviceActivityConfidence: deviceSample?.confidence ?? null,
    }
  }

  private updateDeviceActivitySamples(sample: DeviceActivitySample | null, ts: number) {
    if (!sample) {
      this.deviceActivitySamples = []

      return
    }

    sample.tsUtc = ts
    this.pushDeviceActivity(sample)
  }

  private createTrackPoint(fix: NormalizedFix, activity: ResolvedFixActivity): TrackPoint {
    return {
      clientPointId: uuidv4(),
      tsUtc: fix.ts,
      lat: fix.lat,
      lng: fix.lng,
      altitude: fix.altitude,
      accuracy: fix.accuracy,
      speed: fix.speed,
      bearing: fix.bearing,
      activity: activity.activity,
      activityConfidence: activity.confidence,
      sessionId: this.currentSessionId || uuidv4(),
      deviceActivity: activity.deviceActivity,
      deviceActivityConfidence: activity.deviceActivityConfidence,
    }
  }

  private recalculateSessionDistance(point: TrackPoint) {
    this.recentMeasurements.push(point)
    const prepared = prepareTrack(this.recentMeasurements)
    let recentDistance = 0
    let committedDistance = 0
    const cutoff = point.tsUtc - 180_000

    for (let index = 1; index < prepared.length; index++) {
      const previous = prepared[index - 1]!
      const current = prepared[index]!
      const representsMovement = !current.stop && current.activity !== 'still' && current.tsUtc - previous.tsUtc <= 15_000
      const distance = representsMovement
        ? haversineM(
            previous.lat,
            previous.lng,
            current.lat,
            current.lng,
          )
        : 0

      recentDistance += distance

      if (previous.tsUtc < cutoff)
        committedDistance += distance
    }

    this.sessionDistanceM = Math.max(0, this.sessionDistanceM - this.recentDistanceM + recentDistance)
    this.recentDistanceM = recentDistance - committedDistance
    this.recentMeasurements = this.recentMeasurements.filter(item => item.tsUtc >= cutoff)

    return prepared
  }

  private updateDisplayFix(prepared: ReturnType<typeof prepareTrack>, point: TrackPoint) {
    const display = prepared[prepared.length - 1]

    if (display?.stop) {
      this.displayStopAnchor ??= { lat: display.lat, lng: display.lng }
      this.displayFix = { ...display, ...this.displayStopAnchor }
    }
    else {
      this.displayStopAnchor = null
      this.displayFix = display ?? point
    }
  }

  private persistTrackPoint(point: TrackPoint) {
    const queue = readStoredPoints()
    queue.push(point)
    writeStoredPoints(queue)
    writeStoredSession({
      sessionId: this.currentSessionId || point.sessionId,
      startedAt: this.sessionStartedAt,
      distanceM: this.sessionDistanceM,
      lastPoint: point,
      isRunning: this.isRunning,
    })
  }

  private updateTrackingNotification(speedMs: number) {
    const distFormatted = this.sessionDistanceM >= 1000
      ? `${(this.sessionDistanceM / 1000).toFixed(2)} км`
      : `${Math.round(this.sessionDistanceM)} м`
    const speedFormatted = speedMs > 0.3 ? `${Math.round(speedMs * 3.6)} км/ч` : '0 км/ч'

    this.keepalive.updateNotification(`Запись GPS: ${distFormatted} • ${speedFormatted}`, 'TripScheduler • Фоновый трекинг активен')
  }

  private handlePositionUpdate(position: PositionUpdate): void {
    const fix = normalizePositionUpdate(position, this.lastFixPoint)

    if (!fix || this.shouldRejectPosition(fix))
      return

    const activity = this.resolvePositionActivity(fix, position)
    const point = this.createTrackPoint(fix, activity)

    this.lastFixPoint = point
    const prepared = this.recalculateSessionDistance(point)
    this.updateDisplayFix(prepared, point)
    this.persistTrackPoint(point)
    this.updateTrackingNotification(activity.speedMs)
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

const TRACK_ACTIVITIES: ActivityType[] = ['still', 'walk', 'bike', 'vehicle', 'rail', 'unknown']

interface ValidTrackPointRecord extends Record<string, unknown> {
  clientPointId: string
  tsUtc: number
  lat: number
  lng: number
  activity: string
  sessionId: string
}

function isValidPointId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 64
}

function isValidSessionId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 4
}

function isValidCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function isValidTrackPointRecord(record: Record<string, unknown>): record is ValidTrackPointRecord {
  return isValidPointId(record.clientPointId)
    && typeof record.tsUtc === 'number' && Number.isFinite(record.tsUtc) && record.tsUtc > 0
    && isValidCoordinate(record.lat, -90, 90)
    && isValidCoordinate(record.lng, -180, 180)
    && typeof record.activity === 'string'
    && isValidSessionId(record.sessionId)
}

function normalizeConfidence(value: unknown, fallback: number): number {
  const raw = typeof value === 'number' && Number.isFinite(value) ? value : fallback

  return raw > 0 && raw <= 1
    ? Math.round(raw * 100)
    : Math.round(Math.min(100, Math.max(0, raw)))
}

function getValidOptionalNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]

  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getNonNegativeOptionalNumber(record: Record<string, unknown>, key: string): number | null {
  const value = getValidOptionalNumber(record, key)

  return value !== null && value >= 0 ? value : null
}

function normalizeBearing(value: number | null): number | null {
  return value === null ? null : (((value % 360) + 360) % 360)
}

function getStoredDeviceActivity(record: Record<string, unknown>): ActivityType | null {
  const value = record.deviceActivity

  return typeof value === 'string' && TRACK_ACTIVITIES.includes(value as ActivityType)
    ? value as ActivityType
    : null
}

function getStoredDeviceActivityConfidence(record: Record<string, unknown>): number | null {
  const value = record.deviceActivityConfidence

  return typeof value === 'number' && Number.isFinite(value) ? normalizeConfidence(value, 0) : null
}

export function parseTrackPoint(raw: unknown): TrackPoint | null {
  if (!isRecord(raw) || !isValidTrackPointRecord(raw))
    return null

  const activity = raw.activity as ActivityType

  if (!TRACK_ACTIVITIES.includes(activity))
    return null

  return {
    clientPointId: raw.clientPointId,
    tsUtc: Math.round(raw.tsUtc as number),
    lat: raw.lat as number,
    lng: raw.lng as number,
    altitude: getValidOptionalNumber(raw, 'altitude'),
    accuracy: getNonNegativeOptionalNumber(raw, 'accuracy'),
    speed: getNonNegativeOptionalNumber(raw, 'speed'),
    bearing: normalizeBearing(getValidOptionalNumber(raw, 'bearing')),
    activity,
    activityConfidence: normalizeConfidence(raw.activityConfidence, 85),
    sessionId: raw.sessionId,
    deviceActivity: getStoredDeviceActivity(raw),
    deviceActivityConfidence: getStoredDeviceActivityConfidence(raw),
  }
}
