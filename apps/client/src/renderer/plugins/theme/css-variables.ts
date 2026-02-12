import { useThemeStore } from '~/shared/store/theme.store'

/**
 * Вспомогательная функция для конвертации HEX-цвета в строку RGB-компонентов.
 * @param hex - Цвет в формате HEX (например, '#RRGGBB' или '#RGB').
 * @returns Строка вида "R, G, B" или null, если формат неверный.
 */
function hexToRgbString(hex: string): string | null {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
  hex = hex.replace(shorthandRegex, (_, r, g, b) => {
    return r + r + g + g + b + b
  })

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${Number.parseInt(result[1], 16)}, ${Number.parseInt(result[2], 16)}, ${Number.parseInt(result[3], 16)}`
    : null
}

function applyColorPalette(element: HTMLElement, palette: Record<string, string>) {
  for (const key in palette) {
    const colorValue = palette[key]
    element.style.setProperty(`--${key}`, colorValue)

    if (colorValue.startsWith('#')) {
      const rgbString = hexToRgbString(colorValue)
      if (rgbString) {
        const rgbKey = `--${key}-rgb`
        element.style.setProperty(rgbKey, rgbString)
      }
    }
  }
}

function applyGenericPalette(element: HTMLElement, palette: Record<string, string>) {
  for (const key in palette) {
    element.style.setProperty(`--${key}`, palette[key])
  }
}

export function setupCssVariablesUpdater() {
  const themeStore = useThemeStore()

  watchEffect(() => {
    const htmlElement = document.documentElement

    // 1. Применяем настройки контента
    if (themeStore.backgroundSettings.enableContentDimming) {
      const opacity = themeStore.backgroundSettings.contentDimmingOpacity ?? 1
      const width = themeStore.backgroundSettings.contentGradientWidth ?? 100
      htmlElement.style.setProperty('--content-bg-opacity', opacity.toString())
      htmlElement.style.setProperty('--content-gradient-width', `${width}px`)
    }
    else {
      // Если выключено — полностью прозрачно и без градиентов
      htmlElement.style.setProperty('--content-bg-opacity', '0')
      htmlElement.style.setProperty('--content-gradient-width', '0px')
    }

    // 2. Применяем настройки темы
    if (themeStore.isCustomThemeActive) {
      htmlElement.setAttribute('data-theme', 'custom')

      applyColorPalette(htmlElement, themeStore.customThemePalette)
      applyGenericPalette(htmlElement, themeStore.customThemeRadius)
      applyGenericPalette(htmlElement, themeStore.customThemeShadows)
    }
    else {
      htmlElement.setAttribute('data-theme', themeStore.activeThemeName)

      // Чтобы не потерять переменные, которые мы установили в пункте 1, при очистке cssText:
      const currentOpacity = htmlElement.style.getPropertyValue('--content-bg-opacity')
      const currentWidth = htmlElement.style.getPropertyValue('--content-gradient-width')

      htmlElement.style.cssText = ''

      if (currentOpacity)
        htmlElement.style.setProperty('--content-bg-opacity', currentOpacity)
      if (currentWidth)
        htmlElement.style.setProperty('--content-gradient-width', currentWidth)
    }
  })
}
