import type { BackgroundMemoryExportStatus } from '../lib/background-memory-export'
import { invoke } from '@tauri-apps/api/core'
import { storeToRefs } from 'pinia'
import { computed, getCurrentInstance, onBeforeUnmount, onMounted } from 'vue'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useToast } from '~/shared/composables/use-toast'
import { isMobileApp, isTauri } from '~/shared/lib/env'
import { observeBackgroundMemoryExport, startBackgroundMemoryExport } from '../lib/background-memory-export'
import { exportMemoryFiles } from '../lib/export-memories'
import { useVaultMemoriesStore } from '../store/vault-memories.store'

const observers = new WeakMap<object, Promise<void>>()
const completedJobs = new WeakMap<object, string>()

export function useTripMemoriesVault() {
  const vaultStore = useVaultMemoriesStore()
  const { plan: tripData, memories } = useModuleStore(['plan', 'memories'])
  const { memoriesForSelectedDay } = storeToRefs(memories)
  // Shared across day changes so a second view cannot start a duplicate download.
  const syncState = computed(() => vaultStore.syncState)

  function notifyResult(
    total: number,
    failed: number,
    folder: string,
    skipped: number,
  ) {
    const saved = total - failed - skipped
    const location = isMobileApp ? 'Загрузки/TripScheduler' : folder

    if (failed)
      useToast().error(`Сохранено ${saved} из ${total}. Не удалось скачать: ${failed}. Повторите скачивание. Уже на устройстве: ${skipped}. Папка: ${location}`)
    else
      useToast().success(`Сохранено ${saved} медиа. Уже на устройстве: ${skipped}. Папка: ${location}`)
  }

  function observeNative(initial: BackgroundMemoryExportStatus): Promise<void> {
    const existing = observers.get(vaultStore)

    if (existing)
      return existing

    if (initial.id && completedJobs.get(vaultStore) === initial.id)
      return Promise.resolve()

    const observer = (async () => {
      try {
        const status = await observeBackgroundMemoryExport(vaultStore.syncState, initial)

        if (status.id)
          completedJobs.set(vaultStore, status.id)

        if (status.error) {
          useToast().error(status.error)
        }
        else if (status.cancelled) {
          useToast().info(`Скачивание остановлено. Обработано ${status.current} из ${status.total}. Сохранённые файлы останутся на устройстве.`)
        }
        else {
          notifyResult(
            status.total,
            status.failed,
            'Downloads/TripScheduler',
            status.skippedCount ?? 0,
          )
        }
      }
      catch (error) {
        useToast().error(String(error))
      }
      finally {
        vaultStore.syncState.isDownloading = false
        observers.delete(vaultStore)
      }
    })()
    observers.set(vaultStore, observer)

    return observer
  }

  async function restoreNativeProgress() {
    if (!isMobileApp || observers.has(vaultStore) || vaultStore.syncState.isDownloading || document.hidden)
      return

    try {
      const status = await invoke<BackgroundMemoryExportStatus>('memory_export_status')

      // A click may have started a new job while this status request was in flight.
      if (vaultStore.syncState.isDownloading || observers.has(vaultStore))
        return

      if (status.id)
        await observeNative(status)
      else
        vaultStore.syncState.isDownloading = false
    }
    catch (error) {
      if (vaultStore.syncState.isDownloading)
        useToast().error(`Не удалось получить прогресс скачивания: ${String(error)}`)

      vaultStore.syncState.isDownloading = false
    }
  }

  if (isMobileApp && getCurrentInstance()) {
    onMounted(() => {
      void restoreNativeProgress()
      document.addEventListener('visibilitychange', restoreNativeProgress)
    })
    onBeforeUnmount(() => document.removeEventListener('visibilitychange', restoreNativeProgress))
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

    vaultStore.syncState = {
      isDownloading: true,
      current: 0,
      total: media.length,
      loadedBytes: 0,
      skippedCount: 0,
    }

    try {
      if (isMobileApp) {
        await startBackgroundMemoryExport(media)
        const status = await invoke<BackgroundMemoryExportStatus>('memory_export_status')
        await observeNative(status)

        return
      }

      const folder = await invoke<string | null>('memory_export_folder')

      if (!folder)
        return

      const failed = await exportMemoryFiles(media, folder, vaultStore.syncState)
      notifyResult(
        media.length,
        failed,
        folder,
        vaultStore.syncState.skippedCount ?? 0,
      )
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
