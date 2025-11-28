/* eslint-disable no-console */
import type { Pinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import { ref, watch } from 'vue' // Добавляем явный импорт ref и watch
import { usePwaStore } from '~/shared/store/pwa.store'

/**
 * Инициализирует PWA и периодическую проверку обновлений.
 */
function initializePwaUpdater(pinia: Pinia): void {
  const pwaStore = usePwaStore(pinia)
  const intervalMS = 60 * 1 * 1000

  // 1. Создаем реактивные переменные вручную, так как мы отказались от useRegisterSW
  const offlineReady = ref(false)
  const needRefresh = ref(false)

  // 2. Используем чистую функцию registerSW
  const updateServiceWorker = registerSW({
    immediate: true, // Регистрируем сразу

    // Эти колбэки заменяют реактивность useRegisterSW
    onOfflineReady() {
      offlineReady.value = true
    },
    onNeedRefresh() {
      needRefresh.value = true
    },
    onRegistered(r) {
      if (r) {
        setInterval(async () => {
          // Проверяем, не идет ли уже установка и есть ли интернет
          if (r.installing || !navigator.onLine)
            return

          // Проверяем наличие обновлений на сервере
          if ('update' in r) {
            await r.update()
          }
        }, intervalMS)
      }
    },
    onRegisterError(error) {
      console.error('Error during Service Worker registration:', error)
    },
  })

  // 3. Логика вотчеров остается прежней
  watch(offlineReady, (value) => {
    console.log(`App ready to work offline: ${value}`)
    pwaStore.setOfflineReady(value)
  }, { immediate: true })

  watch(needRefresh, (value) => {
    console.log(`New content available, show refresh prompt: ${value}`)
    pwaStore.setNeedRefresh(value)
  }, { immediate: true })

  pwaStore.setUpdateFunction(updateServiceWorker)
}

export { initializePwaUpdater }
