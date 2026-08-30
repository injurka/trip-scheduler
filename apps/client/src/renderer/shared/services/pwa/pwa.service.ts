/* eslint-disable no-console */
import type { Pinia } from 'pinia'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { usePwaStore } from '~/shared/store/pwa.store'

/**
 * Инициализирует PWA и периодическую проверку обновлений.
 */
function initializePwaUpdater(pinia: Pinia): void {
  const pwaStore = usePwaStore(pinia)
  const intervalMS = 60 * 60 * 1000

  const {
    offlineReady,
    needRefresh,
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (r) {
        setInterval(async () => {
          if (!navigator || !navigator.onLine)
            return

          if (('connection' in navigator) && !navigator.onLine)
            return

          try {
            if (swUrl) {
              const resp = await fetch(swUrl, {
                cache: 'no-store',
                headers: {
                  'cache': 'no-store',
                  'cache-control': 'no-cache',
                },
              })
              if (resp?.status !== 200)
                return
            }

            const currentReg = await navigator.serviceWorker?.getRegistration()
            if (currentReg && !currentReg.installing) {
              await currentReg.update()
            }
          }
          catch (e) {
            if (import.meta.env.DEV) {
              console.warn('[PWA] Service Worker update warning:', e)
            }
          }
        }, intervalMS)
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
