import { invoke } from '@tauri-apps/api/core'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useToast } from '~/shared/composables/use-toast'
import { isMobileApp, isTauri } from '~/shared/lib/env'
import { resolveApiUrl } from '~/shared/lib/url'
import { useVaultMemoriesStore } from '../store/vault-memories.store'

export function useTripMemoriesVault() {
  const vaultStore = useVaultMemoriesStore()
  const { plan: tripData, memories } = useModuleStore(['plan', 'memories'])
  const { memoriesForSelectedDay } = storeToRefs(memories)
  const syncState = reactive({ isDownloading: false, current: 0, total: 0, loadedBytes: 0 })

  async function handleDownloadVault() {
    if (!isTauri || syncState.isDownloading)
      return

    // Snapshot the day before the folder dialog: switching days cannot change this export.
    const media = [...new Map(memoriesForSelectedDay.value
      .filter(memory => memory.image)
      .map(memory => [memory.image!.id, memory.image!])).values()]

    if (!tripData.currentTripId || !media.length)
      return

    syncState.isDownloading = true
    syncState.current = 0
    syncState.total = media.length
    syncState.loadedBytes = 0
    let failed = 0

    try {
      const folder = await invoke<string | null>('memory_export_folder')

      if (!folder)
        return

      const exportId = crypto.randomUUID().slice(0, 8)

      for (const image of media) {
        try {
          const originalName = (image.originalName || image.name || `${image.id}.jpg`)
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
            .slice(-160)
          const fileName = `${exportId}-${syncState.current + 1}-${originalName}`
          syncState.loadedBytes += await invoke<number>('memory_export_file', {
            folder,
            url: resolveApiUrl(image.url),
            fileName,
            mimeType: image.fileType || 'application/octet-stream',
          })
        }
        catch (error) {
          failed++
          console.error('Memory export failed:', image.id, error)
        }
        finally {
          syncState.current++
        }
      }

      const saved = media.length - failed
      const location = isMobileApp ? 'Загрузки/TripScheduler' : folder

      if (failed)
        useToast().error(`Сохранено ${saved} из ${media.length}. Не удалось скачать: ${failed}. Повторите скачивание. Папка: ${location}`)
      else
        useToast().success(`Сохранено ${saved} медиа. Папка: ${location}`)
    }
    catch (error) {
      useToast().error(error instanceof Error ? error.message : String(error))
    }
    finally {
      syncState.isDownloading = false
    }
  }

  return { vaultStore, handleDownloadVault, isNative: computed(() => isTauri), syncState }
}
