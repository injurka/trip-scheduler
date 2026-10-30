/* eslint-disable no-console */
import type { Pinia } from 'pinia'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { usePwaStore } from '~/shared/store/pwa.store'

function isOnline(): boolean {
  if (!navigator || !navigator.onLine)
    return false

  return !('connection' in navigator) || navigator.onLine
}

async function isServiceWorkerScriptAvailable(swUrl?: string): Promise<boolean> {
  if (!swUrl)
    return true

  const response = await fetch(swUrl, {
    cache: 'no-store',
    headers: {
      'cache': 'no-store',
      'cache-control': 'no-cache',
    },
  })

  return response?.status === 200
}

async function updateCurrentServiceWorker(): Promise<void> {
  const currentReg = await navigator.serviceWorker?.getRegistration()

  if (currentReg && !currentReg.installing)
    await currentReg.update()
}

async function checkForServiceWorkerUpdate(swUrl?: string): Promise<void> {
  if (!isOnline())
    return

  try {
    if (!await isServiceWorkerScriptAvailable(swUrl))
      return

    await updateCurrentServiceWorker()
  }
  catch (error) {
    if (import.meta.env.DEV)
      console.warn('[PWA] Service Worker update warning:', error)
  }
}

/**
 * Инициализирует PWA и периодическую проверку обновлений.
 */
function initializePwaUpdater(pinia: Pinia): void {
  if (import.meta.env.DEV)
    return

  const pwaStore = usePwaStore(pinia)
  const intervalMS = 60 * 60 * 1000

  const {
    offlineReady,
    needRefresh,
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (r) {
        setInterval(checkForServiceWorkerUpdate, intervalMS, swUrl)
      }
    },
    onRegisterError(error) {
      if (import.meta.env.DEV) {
        console.error('Error during Service Worker registration:', error)
      }
    },
  })

  watch(offlineReady, (value) => {
    if (import.meta.env.DEV) {
      console.log(`App ready to work offline: ${value}`)
    }

    pwaStore.setOfflineReady(value)
  })

  watch(needRefresh, (value) => {
    if (import.meta.env.DEV) {
      console.log(`New content available, show refresh prompt: ${value}`)
    }

    pwaStore.setNeedRefresh(value)
  })

  pwaStore.setUpdateFunction(updateServiceWorker)
}

export { initializePwaUpdater }
