import type { TrackingStatus } from '../services/tracking/geotrack-client'
import { defineStore } from 'pinia'
import { geotrack, GeotrackUnavailableError, parseTrackPoint } from '../services/tracking/geotrack-client'

export interface ITrackingState {
  isSupported: boolean
  isRunning: boolean
  isStarting: boolean
  unsentCount: number
  network: 'wifi' | 'cellular' | 'offline' | 'other'
  lastError: string | null
  lastSyncAt: number | null
}

let pollTimer: ReturnType<typeof setInterval> | null = null

/**
 * Статус трекинга. Тумблер в UI + счётчик несинхронизированных точек.
 * Нативный слой — плагин geotrack (Android foreground service).
 */
export const useTrackingStore = defineStore('tracking', {
  state: (): ITrackingState => ({
    isSupported: false,
    isRunning: false,
    isStarting: false,
    unsentCount: 0,
    network: 'other',
    lastError: null,
    lastSyncAt: null,
  }),

  getters: {
    /** Показывать ли тумблер: только в мобильной Tauri-сборке. */
    canToggle: state => state.isSupported,
  },

  actions: {
    /** Опрос статуса при открытом приложении; ошибка ⇒ плагин недоступен (web/desktop). */
    async refreshStatus() {
      try {
        const status: TrackingStatus = await geotrack.status()
        this.isSupported = true
        this.isRunning = status.running
        this.unsentCount = status.unsentCount
        this.network = status.network
        this.lastError = null
      }
      catch (e) {
        this.isSupported = false
        if (!(e instanceof GeotrackUnavailableError)) {
          this.lastError = e instanceof Error ? e.message : String(e)
        }
      }
    },

    async startPolling(intervalMs = 5000) {
      await this.refreshStatus()
      if (!pollTimer && this.isSupported) {
        pollTimer = setInterval(() => {
          void this.refreshStatus()
        }, intervalMs)
      }
    },

    stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    },

    async toggle(enable: boolean) {
      this.isStarting = true
      this.lastError = null
      try {
        const status = enable ? await geotrack.start() : await geotrack.stop()
        this.isRunning = status.running
        this.unsentCount = status.unsentCount
      }
      catch (e) {
        this.lastError = e instanceof Error ? e.message : String(e)
        throw e
      }
      finally {
        this.isStarting = false
      }
    },

    /** Отметить точки синхронизированными в нативном буфере. */
    async markSynced(clientPointIds: string[]) {
      await geotrack.markSynced(clientPointIds)
      this.unsentCount = Math.max(0, this.unsentCount - clientPointIds.length)
      this.lastSyncAt = Date.now()
    },
  },
})

export { parseTrackPoint }
