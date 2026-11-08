import type { TrackingStatus, TrackingTelemetry } from '../services/tracking/geotrack-client'
import { getErrorMessage } from '@injurka/type-utils'
import { defineStore } from 'pinia'
import {
  geotrack,
  GeotrackUnavailableError,
  parseTrackPoint,
} from '../services/tracking/geotrack-client'
import { runSync } from '../services/tracking/track-sync'
import { useAuthStore } from './auth.store'

export interface ITrackingState {
  isSupported: boolean
  isRunning: boolean
  isStarting: boolean
  isSyncing: boolean
  unsentCount: number
  network: 'wifi' | 'cellular' | 'offline' | 'other'
  lastError: string | null
  hasPermissionDenied: boolean
  batteryIgnored: boolean | null
  syncError: string | null
  statusRevision: number
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
    batteryIgnored: null,
    syncError: null,
    statusRevision: 0,
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
    applyStatus(status: TrackingStatus) {
      this.isRunning = status.running
      this.unsentCount = status.unsentCount
      this.network = status.network
      this.batteryIgnored = status.batteryIgnored
      this.lastError = status.error ?? null
      this.hasPermissionDenied = Boolean(status.error?.includes('запрещ'))

      if (status.telemetry)
        this.telemetry = { ...status.telemetry }
    },

    handleStatusError(e: unknown) {
      if (e instanceof GeotrackUnavailableError) {
        this.isSupported = false
      }
      else {
        const msg = e instanceof Error ? getErrorMessage(e) : String(e)
        this.lastError = msg

        if (msg.toLowerCase().includes('запрещ') || msg.toLowerCase().includes('denied')) {
          this.hasPermissionDenied = true
        }
      }
    },

    /** Обновление статуса трекера и телеметрии */
    async refreshStatus() {
      if (this.isStarting)
        return

      const revision = ++this.statusRevision

      try {
        const available = await geotrack.isAvailable()
        this.isSupported = available

        if (!available)
          return

        const status: TrackingStatus = await geotrack.status()

        if (this.isStarting || status.transitioning || revision !== this.statusRevision)
          return

        this.applyStatus(status)
      }
      catch (e) {
        if (this.isStarting || revision !== this.statusRevision)
          return

        this.handleStatusError(e)
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

        this.hasPermissionDenied = true
        this.lastError = 'Доступ к геолокации запрещён пользователем или системой'

        return false
      }
      catch (e) {
        const msg = e instanceof Error ? getErrorMessage(e) : String(e)
        this.lastError = msg
        this.hasPermissionDenied = true

        return false
      }
    },

    async toggle(enable: boolean) {
      if (this.isStarting)
        throw new Error('Дождитесь завершения переключения GPS')

      this.isStarting = true
      this.statusRevision++
      this.lastError = null
      this.hasPermissionDenied = false

      try {
        const status = await (enable ? geotrack.start() : geotrack.stop())
        this.applyStatus(status)

        if (status.running !== enable)
          throw new Error('GPS-сервис не подтвердил переключение записи')

        if (!enable)
          void this.syncNow()
      }
      catch (e) {
        const msg = e instanceof Error ? getErrorMessage(e) : String(e)
        this.lastError = msg

        if (msg.toLowerCase().includes('запрещ') || msg.toLowerCase().includes('denied')) {
          this.hasPermissionDenied = true
        }

        throw e
      }
      finally {
        this.isStarting = false
        await this.refreshStatus()
      }
    },

    /** Принудительная синхронизация накопившихся точек */
    async syncNow(): Promise<number> {
      const auth = useAuthStore()

      if (!auth.isAuthenticated) {
        this.syncError = 'Для синхронизации точек войдите в аккаунт'

        return 0
      }

      try {
        return await runSync()
      }
      catch {
        return 0
      }
    },

    /** Отметить точки синхронизированными */
    async markSynced(clientPointIds: string[]) {
      await geotrack.markSynced(clientPointIds)
      const status = await geotrack.status()
      this.unsentCount = status.unsentCount
      this.lastSyncAt = Date.now()
    },

    clearError() {
      this.lastError = null
      this.hasPermissionDenied = false
    },

    async requestIgnoreBatteryOptimizations(): Promise<boolean> {
      const res = await geotrack.requestIgnoreBatteryOptimizations()
      await this.refreshStatus()

      return res
    },

    async openAppSettings(): Promise<boolean> {
      return geotrack.openAppSettings()
    },
  },
})

export { parseTrackPoint }
