import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useVaultMemoriesStore = defineStore('vaultMemories', {
  state: () => ({
    vaultPath: null as string | null,
    isLocalMode: useStorage('vault-local-mode', false),
    localFilesSet: new Set<string>(),

    syncState: {
      isDownloading: false,
      current: 0,
      total: 0,
      loadedBytes: 0,
    },
  }),

  getters: {
    isElectron: () => !!window.electronAPI,
    isConfigured: state => !!state.vaultPath,
    getRelPath: () => (tripId: string, imageId: string, dayId?: string) => {
      if (dayId) {
        return `trips/${tripId}/days/${dayId}/${imageId}.jpg`
      }
      return `trips/${tripId}/unsorted/${imageId}.jpg`
    },
  },

  actions: {
    async init() {
      if (this.isElectron) {
        this.vaultPath = await window.electronAPI.vault.getPath()
      }
    },

    async selectFolder() {
      if (!this.isElectron)
        return

      const path = await window.electronAPI.vault.selectFolder()
      if (path) {
        this.vaultPath = path
      }
    },

    async checkFilesAvailability(tripId: string, items: { imageId: string, dayId?: string }[]) {
      if (!this.isElectron || !this.vaultPath)
        return

      const paths = items.map(item => this.getRelPath(tripId, item.imageId, item.dayId))
      const existing = await window.electronAPI.vault.checkFiles(paths)

      existing.forEach(p => this.localFilesSet.add(p))
    },

    async syncImages(tripId: string, images: { id: string, url: string, sizeBytes: number, dayId: string }[]) {
      if (!this.isElectron)
        return

      this.syncState = {
        isDownloading: true,
        current: 0,
        total: 0,
        loadedBytes: 0,
      }

      const tasks = images.map(img => ({
        ...img,
        relPath: this.getRelPath(tripId, img.id, img.dayId),
      }))

      const existingPaths = await window.electronAPI.vault.checkFiles(tasks.map(t => t.relPath))
      const existingSet = new Set(existingPaths)

      existingPaths.forEach(p => this.localFilesSet.add(p))

      const toDownload = tasks.filter(t => !existingSet.has(t.relPath))

      this.syncState.total = toDownload.length

      if (toDownload.length === 0) {
        setTimeout(() => { this.syncState.isDownloading = false }, 500)
        return
      }

      const BATCH_SIZE = 5
      for (let i = 0; i < toDownload.length; i += BATCH_SIZE) {
        if (!this.syncState.isDownloading)
          break

        const batch = toDownload.slice(i, i + BATCH_SIZE)

        await Promise.all(batch.map(async (task) => {
          try {
            const success = await window.electronAPI.vault.downloadFile(task.url, task.relPath)
            if (success) {
              this.localFilesSet.add(task.relPath)
              this.syncState.loadedBytes += task.sizeBytes
            }
          }
          catch (e) {
            console.error(`Failed to download ${task.relPath}`, e)
          }
          finally {
            this.syncState.current++
          }
        }))
      }

      setTimeout(() => {
        this.syncState.isDownloading = false
      }, 1000)
    },
  },
})
