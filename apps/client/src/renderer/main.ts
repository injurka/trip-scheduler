import { addCollection } from '@iconify/vue'
import { addPluginListener } from '@tauri-apps/api/core'
import { createHead } from '@vueuse/head'// файл генерируется скриптом
import iconsBundle from '~/assets/icons-bundle.json'import { useTripPlanStore } from '~/components/04.features/trip-info/trip-plan/store/trip-plan.store'
import { useRequestStore } from '~/plugins/request/store/request.store'
import { initializeDeepLinks } from '~/shared/lib/deep-link'
import { isMobileApp, isTauri } from '~/shared/lib/env'
import router from '~/shared/lib/router'
import { initializePwaUpdater } from '~/shared/services/pwa/pwa.service'
import { startSyncWorker } from '~/shared/services/tracking/track-sync'
import { useAppSettingsStore } from '~/shared/store/app-settings.store'
import { useAppUpdateStore } from '~/shared/store/app-update.store'
import { useAuthStore } from '~/shared/store/auth.store'
import { useNotificationStore } from '~/shared/store/notification.store'
import { useOfflineStore } from '~/shared/store/offline.store'
import { useTrackingStore } from '~/shared/store/tracking.store'
// @ts-expect-error бред какой то
import application from './app.vue'
import { requestPlugin } from './plugins/request'
import { restoreSession } from './plugins/session-restore'
import { themePlugin } from './plugins/theme'
import { vImage, vResolveSrc } from './shared/directives/image'
import { TRPCDatabaseClient } from './shared/services/api'

/** Настройка Eruda (девтулы для мобильного приложения) */
function setupMobileDevtools(settingsStore: ReturnType<typeof useAppSettingsStore>) {
  if (!isMobileApp) {
    return
  }

  void import('~/shared/services/dev/eruda.service').then(({ setErudaEnabled }) => {
    watch(() => settingsStore.enableEruda, (enabled) => {
      void setErudaEnabled(enabled)
    }, { immediate: true })
  })
}

/**
 * Асинхронная функция для инициализации приложения.
 */
async function initializeApp() {
  if (isTauri && typeof document !== 'undefined') {
    document.documentElement.classList.add('is-tauri')
  }

  if (isMobileApp && typeof document !== 'undefined') {
    document.documentElement.classList.add('is-mobile-app')
  }

  addCollection(iconsBundle)

  const app = createApp(application)
  const pinia = createPinia()
  const head = createHead()
  const databaseService = new TRPCDatabaseClient()

  app.directive('resolve-src', vResolveSrc)
  app.directive('image', vImage)

  app.use(pinia)
  app.use(head)
  app.use(requestPlugin, { databaseService })
  app.use(router)
  app.use(themePlugin)

  // Настройки приложения и мобильные devtools
  const appSettingsStore = useAppSettingsStore(pinia)
  setupMobileDevtools(appSettingsStore)

  // Инициализация Deep Link для внешних OAuth редиректов и ссылок приложения
  const sessionReady = restoreSession(pinia)
  initializeDeepLinks(pinia, router, sessionReady)

  await sessionReady

  const authStore = useAuthStore(pinia)
  const offlineStore = useOfflineStore(pinia)
  await offlineStore.initStorage()

  // Old unscoped caches cannot be attributed to a downloader safely.
  if (typeof caches !== 'undefined') {
    const names = await caches.keys().catch(() => [])
    await Promise.all(names.filter(name => name === 'trip-scheduler-offline-media' || name === 'trip-scheduler-images' || name.startsWith('trip-scheduler-api-')).map(name => caches.delete(name).catch(() => false)))
  }

  const notificationStore = useNotificationStore(pinia)
  watch(() => authStore.user?.id, (userId, previousUserId) => {
    if (userId !== previousUserId) {
      notificationStore.subscribedTripIds.clear()
      offlineStore.$reset()
      void offlineStore.initStorage()

      if (previousUserId) {
        const requests = useRequestStore(pinia)

        for (const controller of requests.controllers.values())
          controller.abort()

        requests.$reset()
        useTripPlanStore(pinia).$reset()
      }
    }

    if (userId)
      void notificationStore.syncNativePushToken()
  }, { flush: 'sync' })

  if (authStore.user?.id)
    void notificationStore.syncNativePushToken()

  if (isMobileApp) {
    addPluginListener<{ token: string }>('tracking', 'pushTokenUpdated', ({ token }) => {
      void notificationStore.syncNativePushToken(token)
    }).catch((error) => {
      console.warn('[Notifications] Не удалось подписаться на обновление FCM-токена', error)
    })
  }

  initializePwaUpdater(pinia)

  // Проверка обновлений APK для мобильного приложения (Tauri)
  const appUpdateStore = useAppUpdateStore(pinia)
  void appUpdateStore.checkForUpdates()

  // GPS-трекинг: инициализация опроса статуса и синк-воркера
  const trackingStore = useTrackingStore(pinia)
  void trackingStore.startPolling()
  startSyncWorker()

  window.addEventListener('storage', (event) => {
    if (event.key === 'auth_user')
      window.location.reload()
  })
  app.mount('#app')
}

initializeApp()
