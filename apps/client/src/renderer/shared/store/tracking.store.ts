import type { TrackingStatus, TrackingTelemetry } from '../services/tracking/geotrack-client'
import { defineStore } from 'pinia'
import { geotrack, GeotrackUnavailableError, parseTrackPoint } from '../services/tracking/geotrack-client'
import { runSync } from '../services/tracking/track-sync'

export interface ITrackingState {
  isSupported: boolean
  isRunning: boolean
  isStarting: boolean
  isSyncing: boolean
  unsentCount: number
  network: 'wifi' | 'cellular' | 'offline' | 'other'
  lastError: string | null
  hasPermissionDenied: boolean
  lastSyncAt: number | null
  telemetry: TrackingTelemetry
}

let pollTimer: ReturnType<typeof setInterval> | null = null

const defaultTelemetry: TrackingTelemetry = {
  speedKmh: null,
  accuracyM: null,
  distanceM: 0,
  durationMs: 0,
  activity: 'still',
  lat: null,
  lng: null,
}

/**
 * Хранилище GPS-трекинга: статус записи, живая телеметрия, буфер и синхронизация.
 */
export const useTrackingStore = defineStore('tracking', {
  state: (): ITrackingState => ({
    isSupported: true,
    isRunning: false,
    isStarting: false,
    isSyncing: false,
    unsentCount: 0,
    network: 'other',
    lastError: null,
    hasPermissionDenied: false,
    lastSyncAt: null,
    telemetry: { ...defaultTelemetry },
  }),

  getters: {
    canToggle: state => state.isSupported,
    hasTelemetry: state => state.isRunning || state.telemetry.distanceM > 0 || state.telemetry.speedKmh !== null,
    formattedDuration: (state) => {
      const ms = state.telemetry.durationMs
      if (!ms || ms <= 0)
        return '00:00:00'
      const totalSec = Math.floor(ms / 1000)
      const h = Math.floor(totalSec / 3600)
      const m = Math.floor((totalSec % 3600) / 60)
      const s = totalSec % 60
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    },
    formattedDistance: (state) => {
      const d = state.telemetry.distanceM
      if (d < 1000)
        return `${Math.round(d)} м`
      return `${(d / 1000).toFixed(2)} км`
    },
    accuracyQuality: (state): 'good' | 'medium' | 'poor' | 'unknown' => {
      const acc = state.telemetry.accuracyM
      if (acc === null)
        return 'unknown'
      if (acc <= 15)
        return 'good'
      if (acc <= 35)
        return 'medium'
      return 'poor'
    },
  },

  actions: {
    /** Обновление статуса трекера и телеметрии */
    async refreshStatus() {
      try {
        const available = await geotrack.isAvailable()
        this.isSupported = available
        if (!available)
          return

        const status: TrackingStatus = await geotrack.status()
        this.isRunning = status.running
        this.unsentCount = status.unsentCount
        this.network = status.network
        if (status.telemetry) {
          this.telemetry = { ...status.telemetry }
        }
        this.hasPermissionDenied = false
      }
      catch (e) {
        if (e instanceof GeotrackUnavailableError) {
          this.isSupported = false
        }
        else {
          const msg = e instanceof Error ? e.message : String(e)
          this.lastError = msg
          if (msg.toLowerCase().includes('запрещ') || msg.toLowerCase().includes('denied')) {
            this.hasPermissionDenied = true
          }
        }
      }
    },

    async startPolling(intervalMs = 3000) {
      await this.refreshStatus()
      if (pollTimer) {
        clearInterval(pollTimer)
      }
      pollTimer = setInterval(() => {
        void this.refreshStatus()
      }, intervalMs)
    },

    stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    },

    async requestPermission(): Promise<boolean> {
      try {
        const granted = await geotrack.requestPermission()
        if (granted) {
          this.hasPermissionDenied = false
          this.lastError = null
          await this.toggle(true)
          return true
        }
        else {
          this.hasPermissionDenied = true
          this.lastError = 'Доступ к геолокации запрещён пользователем или системой'
          return false
        }
      }
      catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        this.lastError = msg
        this.hasPermissionDenied = true
        return false
      }
    },

    async toggle(enable: boolean) {
      this.isStarting = true
      this.lastError = null
      this.hasPermissionDenied = false
      try {
        const status = enable ? await geotrack.start() : await geotrack.stop()
        this.isRunning = status.running
        this.unsentCount = status.unsentCount
        if (status.telemetry) {
          this.telemetry = { ...status.telemetry }
        }
        if (!enable) {
          // При остановке сразу отправляем оставшиеся точки на сервер
          void this.syncNow()
        }
      }
      catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        this.lastError = msg
        if (msg.toLowerCase().includes('запрещ') || msg.toLowerCase().includes('denied')) {
          this.hasPermissionDenied = true
        }
        throw e
      }
      finally {
        this.isStarting = false
      }
    },

    /** Принудительная синхронизация накопившихся точек */
    async syncNow(): Promise<number> {
      if (this.isSyncing)
        return 0
      this.isSyncing = true
      try {
        const synced = await runSync()
        await this.refreshStatus()
        this.lastSyncAt = Date.now()
        return synced
      }
      catch (e) {
        this.lastError = e instanceof Error ? e.message : 'Ошибка синхронизации'
        return 0
      }
      finally {
        this.isSyncing = false
      }
    },

    /** Отметить точки синхронизированными */
    async markSynced(clientPointIds: string[]) {
      await geotrack.markSynced(clientPointIds)
      this.unsentCount = Math.max(0, this.unsentCount - clientPointIds.length)
      this.lastSyncAt = Date.now()
    },

    clearError() {
      this.lastError = null
      this.hasPermissionDenied = false
    },
  },
})

export { parseTrackPoint }
