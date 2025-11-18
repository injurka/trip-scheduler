import { useThemeStore } from '~/shared/store/theme.store'

/**
 * Вспомогательная функция для конвертации HEX-цвета в строку RGB-компонентов.
 * @param hex - Цвет в формате HEX (например, '#RRGGBB' или '#RGB').
 * @returns Строка вида "R, G, B" или null, если формат неверный.
 */
function hexToRgbString(hex: string): string | null {
  // Разворачиваем сокращенный формат (например, #03F -> #0033FF)
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
  hex = hex.replace(shorthandRegex, (_, r, g, b) => {
    return r + r + g + g + b + b
  })

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${Number.parseInt(result[1], 16)}, ${Number.parseInt(result[2], 16)}, ${Number.parseInt(result[3], 16)}`
    : null
}

/**
 * Применяет палитру цветов, создавая как обычные, так и RGB-переменные.
 * @param element - HTML-элемент, к которому применяются стили.
 * @param palette - Объект с ключами-именами переменных и HEX-значениями.
 */
function applyColorPalette(element: HTMLElement, palette: Record<string, string>) {
  for (const key in palette) {
    const colorValue = palette[key]

    // 1. Устанавливаем основную переменную, например, `--bg-primary-color: #eeeeee`
    element.style.setProperty(`--${key}`, colorValue)

    // 2. Если значение - это HEX-цвет, создаем RGB-версию
    if (colorValue.startsWith('#')) {
      const rgbString = hexToRgbString(colorValue)
      if (rgbString) {
        // Создаем ключ вида `--bg-primary-color-rgb`
        const rgbKey = `--${key}-rgb`
        element.style.setProperty(rgbKey, rgbString)
      }
    }
  }
}

/**
 * Применяет палитру (например, радиусов или теней) как CSS переменные.
 * @param element - HTML-элемент.
 * @param palette - Объект с переменными.
 */
function applyGenericPalette(element: HTMLElement, palette: Record<string, string>) {
  for (const key in palette) {
    element.style.setProperty(`--${key}`, palette[key])
  }
}

/**
 * Инициализирует наблюдатель, который отслеживает изменения в теме
 * и динамически применяет CSS-переменные к `<html>`.
 */
export function setupCssVariablesUpdater() {
  const themeStore = useThemeStore()

  watchEffect(() => {
    const htmlElement = document.documentElement

    if (themeStore.isCustomThemeActive) {
      htmlElement.setAttribute('data-theme', 'custom')

      applyColorPalette(htmlElement, themeStore.customThemePalette)
      applyGenericPalette(htmlElement, themeStore.customThemeRadius)
      applyGenericPalette(htmlElement, themeStore.customThemeShadows)
    }
    else {
      htmlElement.setAttribute('data-theme', themeStore.activeThemeName)
      htmlElement.style.cssText = ''
    }
  })
}
