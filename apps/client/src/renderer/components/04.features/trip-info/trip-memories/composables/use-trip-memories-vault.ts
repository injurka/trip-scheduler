import { invoke } from '@tauri-apps/api/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useToast } from '~/shared/composables/use-toast'
import { isMobileApp, isTauri } from '~/shared/lib/env'
import { exportMemoryFiles } from '../lib/export-memories'
import { useVaultMemoriesStore } from '../store/vault-memories.store'

export function useTripMemoriesVault() {
  const vaultStore = useVaultMemoriesStore()
  const { plan: tripData, memories } = useModuleStore(['plan', 'memories'])
  const { memoriesForSelectedDay } = storeToRefs(memories)
  // Shared across day changes so a second view cannot start a duplicate download.
  const syncState = computed(() => vaultStore.syncState)

  function notifyResult(total: number, failed: number, folder: string) {
    const saved = total - failed
    const location = isMobileApp ? 'Загрузки/TripScheduler' : folder

    if (failed)
      useToast().error(`Сохранено ${saved} из ${total}. Не удалось скачать: ${failed}. Повторите скачивание. Папка: ${location}`)
    else
      useToast().success(`Сохранено ${saved} медиа. Папка: ${location}`)
  }

  async function handleDownloadVault() {
    if (!isTauri || vaultStore.syncState.isDownloading)
      return

    // Snapshot the day before the folder dialog.
    const media = [...new Map(memoriesForSelectedDay.value
      .filter(memory => memory.image)
      .map(memory => [memory.image!.id, memory.image!])).values()]

    if (!tripData.currentTripId || !media.length)
      return

    vaultStore.syncState = { isDownloading: true, current: 0, total: media.length, loadedBytes: 0 }

    try {
      const folder = await invoke<string | null>('memory_export_folder')

      if (!folder)
        return

      const failed = await exportMemoryFiles(media, folder, vaultStore.syncState)
      notifyResult(media.length, failed, folder)
    }
    catch (error) {
      useToast().error(String(error))
    }
    finally {
      vaultStore.syncState.isDownloading = false
    }
  }

  return { vaultStore, handleDownloadVault, isNative: computed(() => isTauri), syncState }
}
