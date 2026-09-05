import { addCollection } from '@iconify/vue'
import { createHead } from '@vueuse/head'

// файл генерируется скриптом
import iconsBundle from '~/assets/icons-bundle.json'

import { isTauri } from '~/shared/lib/env'
import router from '~/shared/lib/router'
import { initializePwaUpdater } from '~/shared/services/pwa/pwa.service'
import { startSyncWorker } from '~/shared/services/tracking/track-sync'
import { useAppUpdateStore } from '~/shared/store/app-update.store'
import { useTrackingStore } from '~/shared/store/tracking.store'
// @ts-expect-error бред какой то
import application from './app.vue'
import { requestPlugin } from './plugins/request'
import { restoreSession } from './plugins/session-restore'
import { themePlugin } from './plugins/theme'
import { vImage, vResolveSrc } from './shared/directives/image'
import { TRPCDatabaseClient } from './shared/services/api'

/**
 * Асинхронная функция для инициализации приложения.
 */
async function initializeApp() {
  if (isTauri && typeof document !== 'undefined') {
    document.documentElement.classList.add('is-tauri')
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

  await restoreSession(pinia)
  initializePwaUpdater(pinia)

  // Проверка обновлений APK для мобильного приложения (Tauri)
  const appUpdateStore = useAppUpdateStore(pinia)
  void appUpdateStore.checkForUpdates()

  // GPS-трекинг: инициализация опроса статуса и синк-воркера
  const trackingStore = useTrackingStore(pinia)
  void trackingStore.startPolling()
  startSyncWorker()

  app.mount('#app')
}

initializeApp()
