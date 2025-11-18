import { useThemeStore } from '~/shared/store/theme.store'

/**
 * Инициализирует наблюдатель, который отслеживает изменения темы
 * и автоматически обновляет мета-тег 'theme-color'.
 *
 * Эта функция должна вызываться только на стороне клиента.
 */
export function setupThemeColorMetaTagUpdater() {
  const themeStore = useThemeStore()

  const themeColor = computed(() => {
    switch (themeStore.activeThemeName) {
      case 'light':
        return '#e8eaeb'
      case 'dark':
        return '#121314'
      case 'custom':
        return themeStore.customThemePalette['bg-secondary-color'] || '#e8eaeb'
      default:
        return '#e8eaeb'
    }
  })

  watch(themeColor, (newColor) => {
    let metaTag = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

    if (!metaTag) {
      metaTag = document.createElement('meta')
      metaTag.name = 'theme-color'
      document.head.appendChild(metaTag)
    }

    metaTag.content = newColor
  }, {
    immediate: true,
  })
}
