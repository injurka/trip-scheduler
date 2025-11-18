import type { App } from 'vue'
import { useThemeStore } from '~/shared/store/theme.store'
import { setupCssVariablesUpdater } from './css-variables'
import { setupThemeColorMetaTagUpdater } from './meta-updater'

export const themePlugin = {
  install(app: App) {
    const pinia = app.config.globalProperties.$pinia
    if (!pinia) {
      console.error('Theme plugin requires Pinia to be installed first.')
      return
    }

    const themeStore = useThemeStore(pinia)

    // 1. Загружаем начальное состояние темы
    themeStore.loadInitialTheme()

    // 2. Инициализируем модуль обновления CSS-переменных
    setupCssVariablesUpdater()

    // 3. Инициализируем модуль обновления мета-тега theme-color
    setupThemeColorMetaTagUpdater()
  },
}
