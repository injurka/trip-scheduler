import type { UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { compareVersions } from 'compare-versions'
import { defineStore } from 'pinia'
import { isTauri } from '~/shared/lib/env'
import { useToastStore } from './toast.store'

const GITHUB_REPO = 'injurka/trip-scheduler'
export const API_GITHUB_RELEASES_LATEST = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
export const GITHUB_RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`

export interface DownloadProgressPayload {
  downloaded: number
  total: number | null
  percentage: number
  done: boolean
  path?: string | null
}

export interface AppUpdateState {
  hasUpdate: boolean
  latestVersion: string | null
  apkUrl: string | null
  releaseUrl: string
  isDownloading: boolean
  downloadProgress: number
  downloadedBytes: number
  totalBytes: number | null
  downloadedFilePath: string | null
  downloadError: string | null
}

let unlistenProgress: UnlistenFn | null = null

export const useAppUpdateStore = defineStore('appUpdate', {
  state: (): AppUpdateState => ({
    hasUpdate: false,
    latestVersion: null,
    apkUrl: null,
    releaseUrl: GITHUB_RELEASES_PAGE,
    isDownloading: false,
    downloadProgress: 0,
    downloadedBytes: 0,
    totalBytes: null,
    downloadedFilePath: null,
    downloadError: null,
  }),

  actions: {
    async checkForUpdates(silent = true) {
      // Автопроверка по умолчанию выполняется только в Tauri (Android / Desktop)
      if (silent && !isTauri) {
        return
      }

      try {
        const response = await fetch(API_GITHUB_RELEASES_LATEST)
        if (!response.ok) {
          return
        }

        const latestRelease = await response.json()
        const tag = latestRelease.tag_name || ''
        const cleanLatestVersion = tag.replace(/^\D*/, '')
        const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'

        if (!cleanLatestVersion) {
          return
        }

        if (compareVersions(cleanLatestVersion, currentVersion) <= 0) {
          return
        }

        const apkAsset = latestRelease.assets?.find((asset: any) =>
          typeof asset.name === 'string' && asset.name.endsWith('.apk'),
        )

        this.hasUpdate = true
        this.latestVersion = cleanLatestVersion
        this.apkUrl = apkAsset?.browser_download_url ?? null
        this.releaseUrl = latestRelease.html_url || GITHUB_RELEASES_PAGE
      }
      catch (e) {
        if (!silent) {
          throw e
        }
        console.error('[AppUpdate] Ошибка при проверке обновлений:', e)
      }
    },

    async startUpdate() {
      // Если это среда Tauri и есть прямая ссылка на APK — скачиваем с прогрессом
      if (isTauri && this.apkUrl) {
        await this.downloadUpdateInApp()
        return
      }

      // Фолбэк для веба или если нет прямого APK (переход на релиз / браузерная загрузка)
      const url = this.apkUrl || this.releaseUrl
      if (!url) {
        this.closePrompt()
        return
      }

      const toastStore = useToastStore()
      toastStore.info('Переход к загрузке обновления...')
      window.open(url, '_blank')
    },

    async downloadUpdateInApp() {
      if (!this.apkUrl) {
        return
      }

      const toastStore = useToastStore()
      this.isDownloading = true
      this.downloadProgress = 0
      this.downloadedBytes = 0
      this.totalBytes = null
      this.downloadError = null
      this.downloadedFilePath = null

      try {
        if (unlistenProgress) {
          unlistenProgress()
          unlistenProgress = null
        }

        unlistenProgress = await listen<DownloadProgressPayload>('app-update://progress', (event) => {
          const payload = event.payload
          this.downloadedBytes = payload.downloaded
          this.totalBytes = payload.total
          this.downloadProgress = Math.round(payload.percentage)

          if (payload.done && payload.path) {
            this.downloadedFilePath = payload.path
            this.downloadProgress = 100
          }
        })

        const filename = `trip-scheduler-v${this.latestVersion || 'latest'}.apk`
        const filePath = await invoke<string>('download_app_update', {
          url: this.apkUrl,
          filename,
        })

        this.downloadedFilePath = filePath
        this.downloadProgress = 100
        this.isDownloading = false

        toastStore.success('Обновление успешно загружено!')

        // Сразу пробуем открыть установщик
        await this.installApk()
      }
      catch (err: any) {
        console.error('[AppUpdate] Ошибка при загрузке обновления:', err)
        this.isDownloading = false
        this.downloadError = typeof err === 'string' ? err : (err?.message || 'Не удалось загрузить обновление')
        toastStore.error(`Ошибка загрузки: ${this.downloadError}`)
      }
      finally {
        if (unlistenProgress) {
          unlistenProgress()
          unlistenProgress = null
        }
      }
    },

    async installApk() {
      if (!this.downloadedFilePath) {
        return
      }

      const toastStore = useToastStore()
      try {
        await invoke('open_downloaded_apk', { path: this.downloadedFilePath })
      }
      catch (e: any) {
        console.error('[AppUpdate] Ошибка открытия APK:', e)
        toastStore.error('Не удалось открыть установщик APK')
      }
    },

    openExternalRelease() {
      const url = this.apkUrl || this.releaseUrl
      if (url) {
        window.open(url, '_blank')
      }
    },

    closePrompt() {
      this.hasUpdate = false
    },
  },
})
