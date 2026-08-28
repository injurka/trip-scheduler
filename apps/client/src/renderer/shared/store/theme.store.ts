import type { ThemeType } from '~/shared/types/models/theme'
import { useStorage } from '@vueuse/core'

export interface ColorPalette {
  [key: string]: string
}

export interface RadiusPalette {
  [key: string]: string
}

export interface ShadowPalette {
  [key: string]: string
}

export interface BackgroundSettings {
  showSymbols: boolean
  showImage: boolean
  customImageUrl: string
  imageOpacity: number // 0 - 1
  enableContentDimming: boolean
  contentDimmingOpacity: number // 0 - 1
  contentGradientWidth: number // px (0 - 500)
}

const defaultLightPalette: ColorPalette = {
  // BG
  'bg-primary-color': '#faf4f2',
  'bg-secondary-color': '#f2edeb',
  'bg-tertiary-color': '#e0dad9',
  'bg-header-color': '242, 237, 235',
  'bg-disabled-color': '#f2edeb',
  'bg-inverted-color': '#29242a',
  'bg-accent-overlay-color': '#e160324d',
  'bg-accent-color': '#fce9e4',
  'bg-pressed-color': '#29242a0d',
  'bg-overlay-primary-color': '#706b6e36',
  'bg-overlay-secondary-color': '#a59fa0dc',
  'bg-action-hover-color': '#f37a51',
  'bg-hover-color': '#ede7e5bf',
  'bg-focus-color': '#fce9e4',
  'bg-highlight-color': '#fdf5d7',

  // BG STATUS
  'bg-success-color': '#d4e6d6',
  'bg-error-color': '#f3d9e0',
  'bg-warning-color': '#fce9e4',
  'bg-info-color': '#fdecd7',

  // FG
  'fg-primary-color': '#29242a',
  'fg-secondary-color': '#706b6e',
  'fg-tertiary-color': '#a59fa0',
  'fg-muted-color': '#29242a66',
  'fg-accent-color': '#e16032',
  'fg-action-color': '#e16032',
  'fg-inverted-color': '#faf4f2',
  'fg-disabled-color': '#29242a4d',
  'fg-pressed-color': '#29242a',
  'fg-highlight-color': '#d99f47',

  // FG STATUS
  'fg-success-color': '#269d69',
  'fg-error-color': '#e14775',
  'fg-warning-color': '#e16032',
  'fg-info-color': '#cc7a0a',

  // Border
  'border-primary-color': '#d2cdcb',
  'border-secondary-color': '#e0dad9',
  'border-accent-color': '#f37a51',
  'border-disabled-color': '#e0dad9',
  'border-button-secondary-color': '#f5d6cb',
  'border-focus-color': '#e16032',
  'border-pressed-color': '#e16032',

  // BORDER STATUS
  'border-success-color': '#5bbd8b',
  'border-error-color': '#e87899',
  'border-warning-color': '#f37a51',
  'border-info-color': '#d99f47',
}

const defaultRadiusPalette: RadiusPalette = {
  'r-full': '1000px',
  'r-2xl': '32px',
  'r-xl': '24px',
  'r-l': '16px',
  'r-m': '12px',
  'r-s': '8px',
  'r-xs': '6px',
  'r-2xs': '4px',
}

function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : null
}

function generateShadowsFromColor(color: string): ShadowPalette {
  const rgb = hexToRgb(color)
  if (!rgb) {
    console.error('Invalid hex color for shadow generation:', color)
    return {}
  }
  const rgbStr = `${rgb.r}, ${rgb.g}, ${rgb.b}`
  return {
    's-xs': `0 1px 2px 0 rgba(${rgbStr}, 0.05)`,
    's-s': `0 1px 3px 0 rgba(${rgbStr}, 0.1), 0 1px 2px -1px rgba(${rgbStr}, 0.1)`,
    's-m': `0 4px 6px -1px rgba(${rgbStr}, 0.1), 0 2px 4px -2px rgba(${rgbStr}, 0.1)`,
    's-l': `0 10px 15px -3px rgba(${rgbStr}, 0.1), 0 4px 6px -4px rgba(${rgbStr}, 0.1)`,
    's-xl': `0 20px 25px -5px rgba(${rgbStr}, 0.1), 0 8px 10px -6px rgba(${rgbStr}, 0.1)`,
    's-inset': `inset 0 2px 4px 0 rgba(${rgbStr}, 0.05)`,
  }
}

const defaultLightShadowColor = '#29242a'
const defaultLightShadows = generateShadowsFromColor(defaultLightShadowColor)

const defaultBackgroundSettings: BackgroundSettings = {
  showSymbols: true,
  showImage: true,
  customImageUrl: '',
  imageOpacity: 0.05,
  enableContentDimming: true,
  contentDimmingOpacity: 0.95,
  contentGradientWidth: 100, // px
}

export const useThemeStore = defineStore('theme', () => {
  const isCreatorOpen = ref(false)

  const activeThemeName = useStorage<ThemeType>('active-theme', 'light')
  const customThemePalette = useStorage<ColorPalette>('custom-theme-palette', defaultLightPalette)
  const customThemeRadius = useStorage<RadiusPalette>('custom-theme-radius', defaultRadiusPalette)
  const customThemeShadowColor = useStorage<string>('custom-theme-shadow-color', defaultLightShadowColor)
  const customThemeShadows = useStorage<ShadowPalette>('custom-theme-shadows', defaultLightShadows)
  const backgroundSettings = useStorage<BackgroundSettings>('custom-theme-background', defaultBackgroundSettings)

  const isCustomThemeActive = computed(() => activeThemeName.value === 'custom')
  const currentTheme = computed(() => activeThemeName.value)

  function resetBackgroundSettings() {
    backgroundSettings.value = { ...defaultBackgroundSettings }
  }

  function setTheme(name: ThemeType) {
    activeThemeName.value = name
    if (name !== 'custom') {
      resetBackgroundSettings()
    }
  }

  function resetCustomTheme() {
    customThemePalette.value = { ...defaultLightPalette }
    setTheme('custom')
  }

  function resetCustomRadius() {
    customThemeRadius.value = { ...defaultRadiusPalette }
    setTheme('custom')
  }

  function resetCustomShadows() {
    customThemeShadowColor.value = defaultLightShadowColor
    customThemeShadows.value = { ...defaultLightShadows }
  }

  function applyCustomPalette(newPalette: ColorPalette) {
    Object.assign(customThemePalette.value, newPalette)
  }

  function applyCustomRadius(newRadius: RadiusPalette) {
    customThemeRadius.value = { ...newRadius }
  }

  function applyCustomShadowColor(color: string) {
    customThemeShadowColor.value = color
    customThemeShadows.value = generateShadowsFromColor(color)
  }

  function openCreator() {
    isCreatorOpen.value = true
  }

  function closeCreator() {
    isCreatorOpen.value = false
  }

  function loadInitialTheme() {
    if (!customThemePalette.value || Object.keys(customThemePalette.value).length === 0) {
      customThemePalette.value = { ...defaultLightPalette }
    }
    if (!customThemeRadius.value || Object.keys(customThemeRadius.value).length === 0) {
      customThemeRadius.value = { ...defaultRadiusPalette }
    }
    if (!customThemeShadowColor.value) {
      customThemeShadowColor.value = defaultLightShadowColor
    }
    if (!customThemeShadows.value || Object.keys(customThemeShadows.value).length === 0) {
      customThemeShadows.value = generateShadowsFromColor(customThemeShadowColor.value)
    }
    if (!backgroundSettings.value) {
      backgroundSettings.value = { ...defaultBackgroundSettings }
    }
    if (typeof backgroundSettings.value.contentDimmingOpacity === 'undefined') {
      backgroundSettings.value.contentDimmingOpacity = defaultBackgroundSettings.contentDimmingOpacity
    }
    if (typeof backgroundSettings.value.contentGradientWidth === 'undefined') {
      backgroundSettings.value.contentGradientWidth = defaultBackgroundSettings.contentGradientWidth
    }
  }

  return {
    isCreatorOpen,
    applyCustomPalette,
    applyCustomRadius,
    currentTheme,
    activeThemeName,
    customThemePalette,
    customThemeRadius,
    customThemeShadowColor,
    customThemeShadows,
    backgroundSettings,
    isCustomThemeActive,
    setTheme,
    openCreator,
    closeCreator,
    loadInitialTheme,
    resetCustomTheme,
    resetCustomRadius,
    resetCustomShadows,
    resetBackgroundSettings,
    applyCustomShadowColor,
  }
})
