import type { UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { compareVersions } from 'compare-versions'
import { defineStore } from 'pinia'
import { isMobile, isTauri } from '~/shared/lib/env'
import { openExternalUrl } from '~/shared/lib/opener'
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

export interface PlatformInfo {
  os: string
  is_appimage: boolean
  appimage_path: string | null
}

export interface AppUpdateState {
  hasUpdate: boolean
  latestVersion: string | null
  assetUrl: string | null
  assetName: string | null
  apkUrl: string | null // kept for compatibility
  releaseUrl: string
  targetPlatform: string
  isAppImage: boolean
  appImagePath: string | null
  isDownloading: boolean
  downloadProgress: number
  downloadedBytes: number
  totalBytes: number | null
  downloadedFilePath: string | null
  downloadError: string | null
  isInstalling: boolean
}

let unlistenProgress: UnlistenFn | null = null

export const useAppUpdateStore = defineStore('appUpdate', {
  state: (): AppUpdateState => ({
    hasUpdate: false,
    latestVersion: null,
    assetUrl: null,
    assetName: null,
    apkUrl: null,
    releaseUrl: GITHUB_RELEASES_PAGE,
    targetPlatform: 'android',
    isAppImage: false,
    appImagePath: null,
    isDownloading: false,
    downloadProgress: 0,
    downloadedBytes: 0,
    totalBytes: null,
    downloadedFilePath: null,
    downloadError: null,
    isInstalling: false,
  }),

  actions: {
    async detectTargetPlatform(): Promise<{ os: string, isAppImage: boolean, appImagePath: string | null }> {
      if (isTauri) {
        try {
          const info = await invoke<PlatformInfo>('get_platform_info')
          if (info) {
            return {
              os: info.os.toLowerCase(),
              isAppImage: info.is_appimage,
              appImagePath: info.appimage_path,
            }
          }
        }
        catch (e) {
          console.warn('[AppUpdate] Не удалось получить platform_info через invoke:', e)
        }
      }

      const ua = navigator.userAgent.toLowerCase()
      if (isMobile || /android/i.test(ua)) {
        return { os: 'android', isAppImage: false, appImagePath: null }
      }
      if (/linux/i.test(ua)) {
        return { os: 'linux', isAppImage: isTauri, appImagePath: null }
      }
      if (/win/i.test(ua)) {
        return { os: 'windows', isAppImage: false, appImagePath: null }
      }
      return { os: 'other', isAppImage: false, appImagePath: null }
    },

    async fetchLatestReleaseInfo(): Promise<{
      assetUrl: string | null
      apkUrl: string | null
      assetName: string | null
      latestVersion: string | null
      releaseUrl: string
      isAppImage: boolean
    }> {
      const platform = await this.detectTargetPlatform()
      this.isAppImage = platform.isAppImage
      this.appImagePath = platform.appImagePath
      this.targetPlatform = platform.os

      if (this.assetUrl && this.latestVersion) {
        return {
          assetUrl: this.assetUrl,
          apkUrl: this.apkUrl,
          assetName: this.assetName,
          latestVersion: this.latestVersion,
          releaseUrl: this.releaseUrl,
          isAppImage: this.isAppImage,
        }
      }

      try {
        const response = await fetch(API_GITHUB_RELEASES_LATEST)
        if (response.ok) {
          const latestRelease = await response.json()
          const tag = latestRelease.tag_name || ''
          const cleanLatestVersion = tag.replace(/^\D*/, '')
          const assets = latestRelease.assets || []

          let selectedAsset: any = null

          if (platform.os === 'linux') {
            // На Linux предпочитаем AppImage, либо deb
            selectedAsset = assets.find((a: any) => typeof a.name === 'string' && a.name.endsWith('.AppImage'))
              || assets.find((a: any) => typeof a.name === 'string' && a.name.endsWith('.deb'))
          }
          else if (platform.os === 'windows') {
            selectedAsset = assets.find((a: any) => typeof a.name === 'string' && (a.name.endsWith('.exe') || a.name.endsWith('.msi')))
          }
          else {
            // Android или mobile
            selectedAsset = assets.find((a: any) => typeof a.name === 'string' && a.name.endsWith('.apk'))
          }

          // Fallback если специфичный ассет не найден
          if (!selectedAsset && assets.length > 0) {
            selectedAsset = assets.find((a: any) => typeof a.name === 'string' && a.name.endsWith('.apk')) || assets[0]
          }

          const apkAsset = assets.find((a: any) => typeof a.name === 'string' && a.name.endsWith('.apk'))

          if (cleanLatestVersion) {
            this.latestVersion = cleanLatestVersion
          }
          if (selectedAsset) {
            this.assetUrl = selectedAsset.browser_download_url
            this.assetName = selectedAsset.name
            this.apkUrl = this.assetUrl
          }
          if (apkAsset) {
            this.apkUrl = apkAsset.browser_download_url
          }
          if (latestRelease.html_url) {
            this.releaseUrl = latestRelease.html_url
          }
        }
      }
      catch (e) {
        console.warn('[AppUpdate] Не удалось получить данные последнего релиза:', e)
      }

      return {
        assetUrl: this.assetUrl,
        apkUrl: this.apkUrl,
        assetName: this.assetName,
        latestVersion: this.latestVersion,
        releaseUrl: this.releaseUrl,
        isAppImage: this.isAppImage,
      }
    },

    async checkForUpdates(silent = true) {
      // Автопроверка по умолчанию выполняется только в Tauri (Android / Desktop)
      if (silent && !isTauri) {
        return
      }

      try {
        const { assetUrl, latestVersion, releaseUrl } = await this.fetchLatestReleaseInfo()
        if (!latestVersion) {
          return
        }

        const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
        if (compareVersions(latestVersion, currentVersion) <= 0) {
          return
        }

        this.hasUpdate = true
        this.latestVersion = latestVersion
        this.assetUrl = assetUrl
        this.apkUrl = this.apkUrl || assetUrl
        this.releaseUrl = releaseUrl
      }
      catch (e) {
        if (!silent) {
          throw e
        }
        console.error('[AppUpdate] Ошибка при проверке обновлений:', e)
      }
    },

    async downloadAppInBrowser() {
      const toastStore = useToastStore()
      toastStore.info('Подготовка к скачиванию...')

      let url = this.assetUrl || this.apkUrl
      if (!url) {
        const info = await this.fetchLatestReleaseInfo()
        url = info.assetUrl || info.apkUrl
      }

      const finalUrl = url || this.releaseUrl || GITHUB_RELEASES_PAGE
      if (url) {
        toastStore.success('Скачивание файла началось!')
      }
      else {
        toastStore.info('Переход на страницу релиза...')
      }

      const isDirectDownloadFile = finalUrl.endsWith('.apk') || finalUrl.endsWith('.AppImage') || finalUrl.endsWith('.deb') || finalUrl.endsWith('.exe')
      if (typeof document !== 'undefined' && isDirectDownloadFile) {
        const link = document.createElement('a')
        link.href = finalUrl
        link.setAttribute('download', '')
        link.setAttribute('target', '_blank')
        link.setAttribute('rel', 'noopener noreferrer')
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        return
      }

      await openExternalUrl(finalUrl)
    },

    async startUpdate() {
      const downloadUrl = this.assetUrl || this.apkUrl
      // Если это среда Tauri и есть прямая ссылка на файл — скачиваем с прогрессом
      if (isTauri && downloadUrl) {
        await this.downloadUpdateInApp()
        return
      }

      await this.downloadAppInBrowser()
    },

    async downloadUpdateInApp() {
      const downloadUrl = this.assetUrl || this.apkUrl
      if (!downloadUrl) {
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

        const defaultFilename = this.isAppImage
          ? `trip-scheduler-v${this.latestVersion || 'latest'}.AppImage`
          : `trip-scheduler-v${this.latestVersion || 'latest'}.apk`

        const filename = this.assetName || defaultFilename
        const filePath = await invoke<string>('download_app_update', {
          url: downloadUrl,
          filename,
        })

        this.downloadedFilePath = filePath
        this.downloadProgress = 100
        this.isDownloading = false

        toastStore.success('Обновление успешно загружено!')

        // Если это мобильное приложение — сразу открываем системный установщик
        if (isMobile) {
          await this.installUpdate()
        }
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

    async installUpdate() {
      if (!this.downloadedFilePath || this.isInstalling) {
        return
      }

      const toastStore = useToastStore()
      this.isInstalling = true
      try {
        if (this.isAppImage) {
          toastStore.info('Замена AppImage и перезапуск приложения...')
        }
        await invoke('install_app_update', { path: this.downloadedFilePath })
      }
      catch (e: any) {
        console.error('[AppUpdate] Ошибка установки обновления:', e)
        const msg = typeof e === 'string' ? e : (e?.message || 'Ошибка установки обновления')
        toastStore.error(msg)
      }
      finally {
        this.isInstalling = false
      }
    },

    async installApk() {
      await this.installUpdate()
    },

    async openExternalRelease() {
      const url = this.assetUrl || this.apkUrl || this.releaseUrl
      if (url) {
        await openExternalUrl(url)
      }
    },

    closePrompt() {
      this.hasUpdate = false
    },
  },
})
