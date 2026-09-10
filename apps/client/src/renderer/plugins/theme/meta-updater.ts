import { invoke } from '@tauri-apps/api/core'
import { isMobileApp } from '~/shared/lib/env'
import { useThemeStore } from '~/shared/store/theme.store'

/**
 * Нормализует цвет в формат #RRGGBB (поддерживает 3-значный #RGB и обрезает альфу)
 */
export function normalizeHexColor(hexColor: string): string | null {
  if (!hexColor)
    return null
  let clean = hexColor.trim().replace(/^#/, '')
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('')
  }
  if (clean.length >= 6) {
    return `#${clean.substring(0, 6)}`
  }
  return null
}

/**
 * Проверяет, является ли цвет темным (по формуле перцептивной яркости HSP)
 */
function isColorDark(hexColor: string): boolean {
  const normalized = normalizeHexColor(hexColor)
  if (!normalized)
    return false
  const clean = normalized.slice(1)
  const r = Number.parseInt(clean.substring(0, 2), 16)
  const g = Number.parseInt(clean.substring(2, 4), 16)
  const b = Number.parseInt(clean.substring(4, 6), 16)
  // Формула перцептивной яркости HSP
  const brightness = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b))
  return brightness < 128
}

/**
 * Инициализирует наблюдатель, который отслеживает изменения темы
 * и автоматически обновляет мета-тег 'theme-color' и нативный System Bar (Android).
 *
 * Эта функция должна вызываться только на стороне клиента.
 */
export function setupThemeColorMetaTagUpdater() {
  const themeStore = useThemeStore()

  const themeColor = computed(() => {
    switch (themeStore.activeThemeName) {
      case 'light':
        return '#faf4f2'
      case 'dark':
        return '#121314'
      case 'custom':
        return normalizeHexColor(themeStore.customThemePalette['bg-primary-color']) || '#faf4f2'
      default:
        return '#faf4f2'
    }
  })

  const isDarkTheme = computed(() => {
    if (themeStore.activeThemeName === 'dark')
      return true
    if (themeStore.activeThemeName === 'light')
      return false
    return isColorDark(themeColor.value)
  })

  watch([themeColor, isDarkTheme], ([newColor, isDark]) => {
    let metaTag = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

    if (!metaTag) {
      metaTag = document.createElement('meta')
      metaTag.name = 'theme-color'
      document.head.appendChild(metaTag)
    }

    metaTag.content = newColor

    // В мобильном Tauri APK обновляем нативные System Bars (Status Bar + Nav Bar)
    if (isMobileApp) {
      invoke('set_system_bars_theme', {
        payload: {
          isDark,
          statusBarColor: newColor,
          navigationBarColor: newColor,
        },
      }).catch((e) => {
        console.warn('[Theme] Failed to set native system bars theme:', e)
      })
    }
  }, {
    immediate: true,
  })
}
