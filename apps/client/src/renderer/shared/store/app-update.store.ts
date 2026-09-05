import { compareVersions } from 'compare-versions'
import { defineStore } from 'pinia'
import { isMobileApp } from '~/shared/lib/env'

const GITHUB_REPO = 'injurka/trip-scheduler'
export const API_GITHUB_RELEASES_LATEST = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
export const GITHUB_RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`

export interface AppUpdateState {
  hasUpdate: boolean
  latestVersion: string | null
  apkUrl: string | null
  releaseUrl: string
}

export const useAppUpdateStore = defineStore('appUpdate', {
  state: (): AppUpdateState => ({
    hasUpdate: false,
    latestVersion: null,
    apkUrl: null,
    releaseUrl: GITHUB_RELEASES_PAGE,
  }),

  actions: {
    async checkForUpdates(silent = true) {
      // Автопроверка выполняется только в мобильном приложении под Tauri (Android)
      if (silent && !isMobileApp) {
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

    startUpdate() {
      const url = this.apkUrl || this.releaseUrl
      if (url) {
        window.open(url, '_blank')
      }
      this.closePrompt()
    },

    closePrompt() {
      this.hasUpdate = false
    },
  },
})
