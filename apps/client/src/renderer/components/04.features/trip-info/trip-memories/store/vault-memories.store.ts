import { invoke } from '@tauri-apps/api/core'
import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { isTauri } from '~/shared/lib/env'

/**
 * Асинхронный адаптер vault-хранилища.
 * В Tauri команды реализованы в apps/native/src-tauri (Rust), в браузере — заглушки.
 */
interface IVaultBackend {
  getPath: () => Promise<string | null>
  selectFolder: () => Promise<string | null>
  checkFiles: (paths: string[]) => Promise<string[]>
  downloadFile: (url: string, path: string) => Promise<boolean>
  deleteFile: (path: string) => Promise<void>
}

function createTauriBackend(): IVaultBackend {
  return {
    getPath: () => invoke<string | null>('vault_get_path'),
    selectFolder: () => invoke<string | null>('vault_select_folder'),
    checkFiles: paths => invoke<string[]>('vault_check_files', { relativePaths: paths }),
    downloadFile: (url, path) => invoke<boolean>('vault_download_file', { url, relativePath: path }),
    deleteFile: async (path) => {
      await invoke('vault_delete_file', { relativePath: path })
    },
  }
}

function createNoopBackend(): IVaultBackend {
  return {
    getPath: async () => null,
    selectFolder: async () => null,
    checkFiles: async () => [],
    downloadFile: async () => false,
    deleteFile: async () => { },
  }
}

function createVaultBackend(): IVaultBackend {
  return isTauri ? createTauriBackend() : createNoopBackend()
}

// Единый бэкенд на время жизни модуля.
const backend = createVaultBackend()

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
    /** Нативное приложение (Tauri desktop/mobile); веб всегда без локального vault. */
    isNative: () => isTauri,
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
      if (!isTauri) {
        return
      }
      this.vaultPath = await backend.getPath()
    },

    async selectFolder() {
      if (!isTauri) {
        return
      }
      const path = await backend.selectFolder()
      if (path) {
        this.vaultPath = path
      }
    },

    async checkFilesAvailability(tripId: string, items: { imageId: string, dayId?: string }[]) {
      if (!isTauri || !this.vaultPath)
        return

      const paths = items.map(item => this.getRelPath(tripId, item.imageId, item.dayId))
      const existing = await backend.checkFiles(paths)

      existing.forEach(p => this.localFilesSet.add(p))
    },

    async syncImages(tripId: string, images: { id: string, url: string, sizeBytes: number, dayId: string }[]) {
      if (!isTauri)
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

      const existingPaths = await backend.checkFiles(tasks.map(t => t.relPath))
      const existingSet = new Set(existingPaths)

      existingPaths.forEach(p => this.localFilesSet.add(p))

      const toDownload = tasks.filter(t => !existingSet.has(t.relPath))

      this.syncState.total = toDownload.length

      if (toDownload.length === 0) {
        setTimeout(() => {
          this.syncState.isDownloading = false
        }, 500)
        return
      }

      const BATCH_SIZE = 5
      for (let i = 0; i < toDownload.length; i += BATCH_SIZE) {
        if (!this.syncState.isDownloading)
          break

        const batch = toDownload.slice(i, i + BATCH_SIZE)

        await Promise.all(batch.map(async (task) => {
          try {
            const success = await backend.downloadFile(task.url, task.relPath)
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
