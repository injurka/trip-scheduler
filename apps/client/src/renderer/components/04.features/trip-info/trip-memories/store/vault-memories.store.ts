import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useVaultMemoriesStore = defineStore('vaultMemories', {
  state: () => ({
    vaultPath: ref<string | null>(null),
    isLocalMode: useStorage('vault-local-mode', false),
    localFilesSet: ref<Set<string>>(new Set()),

    syncState: ref({
      isDownloading: false,
      current: 0,
      total: 0,
      loadedBytes: 0,
    }),
  }),

  getters: {
    isElectron: () => !!window.electronAPI,
    isConfigured: state => !!state.vaultPath,
    getRelPath: () => (tripId: string, imageId: string) => `${tripId}/${imageId}.jpg`,
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

    async checkFilesAvailability(tripId: string, imageIds: string[]) {
      if (!this.isElectron || !this.vaultPath)
        return

      const paths = imageIds.map(id => this.getRelPath(tripId, id))
      const existing = await window.electronAPI.vault.checkFiles(paths)

      existing.forEach(p => this.localFilesSet.add(p))
    },

    async syncImages(tripId: string, images: { id: string, url: string, sizeBytes: number }[]) {
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
        relPath: this.getRelPath(tripId, img.id),
      }))

      const existingPaths = await window.electronAPI.vault.checkFiles(tasks.map(t => t.relPath))
      const existingSet = new Set(existingPaths)

      const toDownload = tasks.filter(t => !existingSet.has(t.relPath))

      this.syncState.total = toDownload.length

      if (toDownload.length === 0) {
        setTimeout(() => { this.syncState.isDownloading = false }, 500)
        return
      }

      const BATCH_SIZE = 5
      for (let i = 0; i < toDownload.length; i += BATCH_SIZE) {
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
