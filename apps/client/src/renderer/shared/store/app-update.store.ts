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

interface GitHubReleaseAsset {
  name?: string
  browser_download_url?: string
}

interface GitHubRelease {
  tag_name?: string
  assets?: GitHubReleaseAsset[]
  html_url?: string
}

const preferredAssetSuffixes: Record<string, string[]> = {
  linux: ['.AppImage', '.deb'],
  windows: ['.exe', '.msi'],
}

function findAssetWithSuffix(assets: GitHubReleaseAsset[], suffix: string): GitHubReleaseAsset | undefined {
  return assets.find(asset => typeof asset.name === 'string' && asset.name.endsWith(suffix))
}

function selectReleaseAssets(assets: GitHubReleaseAsset[], platform: string): {
  selectedAsset: GitHubReleaseAsset | null
  apkAsset: GitHubReleaseAsset | undefined
} {
  const suffixes = preferredAssetSuffixes[platform] ?? ['.apk']
  const selectedAsset = suffixes
    .map(suffix => findAssetWithSuffix(assets, suffix))
    .find((asset): asset is GitHubReleaseAsset => Boolean(asset))
    ?? findAssetWithSuffix(assets, '.apk')
    ?? assets[0]
    ?? null

  return {
    selectedAsset,
    apkAsset: findAssetWithSuffix(assets, '.apk'),
  }
}

function applyReleaseMetadata(
  store: Pick<AppUpdateState, 'latestVersion' | 'assetUrl' | 'assetName' | 'apkUrl' | 'releaseUrl'>,
  release: GitHubRelease,
  cleanLatestVersion: string,
  selectedAsset: GitHubReleaseAsset | null,
  apkAsset: GitHubReleaseAsset | undefined,
): void {
  if (cleanLatestVersion)
    store.latestVersion = cleanLatestVersion

  if (selectedAsset) {
    store.assetUrl = selectedAsset.browser_download_url ?? null
    store.assetName = selectedAsset.name ?? null
    store.apkUrl = store.assetUrl
  }

  if (apkAsset)
    store.apkUrl = apkAsset.browser_download_url ?? null

  if (release.html_url)
    store.releaseUrl = release.html_url
}

async function resolveBrowserDownloadUrl(store: Pick<AppUpdateState, 'assetUrl' | 'apkUrl'>, fetchLatestReleaseInfo: () => Promise<{ assetUrl: string | null, apkUrl: string | null }>): Promise<string | null> {
  let url = store.assetUrl || store.apkUrl

  if (!url) {
    const info = await fetchLatestReleaseInfo()
    url = info.assetUrl || info.apkUrl
  }

  return url
}

function isDirectDownloadFile(url: string): boolean {
  return ['.apk', '.AppImage', '.deb', '.exe'].some(extension => url.endsWith(extension))
}

function downloadDirectFile(url: string): boolean {
  if (typeof document === 'undefined' || !isDirectDownloadFile(url))
    return false

  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', '')
  link.setAttribute('target', '_blank')
  link.setAttribute('rel', 'noopener noreferrer')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  return true
}

function resetDownloadProgress(store: Pick<AppUpdateState, 'isDownloading' | 'downloadProgress' | 'downloadedBytes' | 'totalBytes' | 'downloadError' | 'downloadedFilePath'>): void {
  store.isDownloading = true
  store.downloadProgress = 0
  store.downloadedBytes = 0
  store.totalBytes = null
  store.downloadError = null
  store.downloadedFilePath = null
}

async function listenForDownloadProgress(store: Pick<AppUpdateState, 'downloadedBytes' | 'totalBytes' | 'downloadProgress' | 'downloadedFilePath'>): Promise<void> {
  if (unlistenProgress) {
    unlistenProgress()
    unlistenProgress = null
  }

  unlistenProgress = await listen<DownloadProgressPayload>('app-update://progress', (event) => {
    const payload = event.payload
    store.downloadedBytes = payload.downloaded
    store.totalBytes = payload.total
    store.downloadProgress = Math.round(payload.percentage)

    if (payload.done && payload.path) {
      store.downloadedFilePath = payload.path
      store.downloadProgress = 100
    }
  })
}

function clearDownloadProgressListener(): void {
  if (!unlistenProgress)
    return

  unlistenProgress()
  unlistenProgress = null
}

function getUpdateFilename(store: Pick<AppUpdateState, 'isAppImage' | 'latestVersion' | 'assetName'>): string {
  const extension = store.isAppImage ? 'AppImage' : 'apk'
  const defaultFilename = `trip-scheduler-v${store.latestVersion || 'latest'}.${extension}`

  return store.assetName || defaultFilename
}

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
          const latestRelease = await response.json() as GitHubRelease
          const tag = latestRelease.tag_name || ''
          const cleanLatestVersion = tag.replace(/^\D*/, '')
          const assets = latestRelease.assets || []
          const { selectedAsset, apkAsset } = selectReleaseAssets(assets, platform.os)

          applyReleaseMetadata(
            this,
            latestRelease,
            cleanLatestVersion,
            selectedAsset,
            apkAsset,
          )
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

      const url = await resolveBrowserDownloadUrl(this, () => this.fetchLatestReleaseInfo())

      const finalUrl = url || this.releaseUrl || GITHUB_RELEASES_PAGE

      if (url) {
        toastStore.success('Скачивание файла началось!')
      }
      else {
        toastStore.info('Переход на страницу релиза...')
      }

      if (downloadDirectFile(finalUrl))
        return

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
      resetDownloadProgress(this)

      try {
        await listenForDownloadProgress(this)

        const filename = getUpdateFilename(this)
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
        clearDownloadProgressListener()
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
