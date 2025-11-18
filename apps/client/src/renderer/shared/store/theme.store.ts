import type { ThemeType } from '~/shared/types/models/theme'
import { useStorage } from '@vueuse/core'

export interface ColorPalette {
  [key: string]: string // e.g., 'bg-primary-color': '#eeeeee'
}

export interface RadiusPalette {
  [key: string]: string // e.g., 'r-m': '12px'
}

export interface ShadowPalette {
  [key: string]: string // e.g., 's-m': '0 4px 6px -1px rgba(34, 38, 59, 0.1)...'
}

const defaultLightPalette: ColorPalette = {
  // BG
  'bg-primary-color': '#eeeeee',
  'bg-secondary-color': '#e8eaeb',
  'bg-tertiary-color': '#dce0e4',
  'bg-header-color': '220, 223, 225',
  'bg-disabled-color': '#e7e9ed',
  'bg-inverted-color': '#22263b',
  'bg-accent-overlay-color': '#818bb5',
  'bg-accent-color': '#d7e0f3',
  'bg-pressed-color': '#22263b0d',
  'bg-overlay-primary-color': '#454a6115',
  'bg-overlay-secondary-color': '#94a1abdc',
  'bg-action-hover-color': '#828dca',
  'bg-hover-color': '#dfe1e6',
  'bg-focus-color': '#d7e0f3',
  'bg-highlight-color': '#e3e2ff',

  // BG STATUS
  'bg-success-color': '#d0e6d2',
  'bg-error-color': '#ebd5d9',
  'bg-warning-color': '#fcefdc',
  'bg-info-color': '#d4e8f7',

  // FG
  'fg-primary-color': '#22263b',
  'fg-secondary-color': '#22263bcc',
  'fg-tertiary-color': '#22263b99',
  'fg-muted-color': '#22263b66',
  'fg-accent-color': '#344079',
  'fg-action-color': '#424c86',
  'fg-inverted-color': '#ffffff',
  'fg-disabled-color': '#22263b4d',
  'fg-pressed-color': '#22263b',
  'fg-highlight-color': '#7371c9',

  // FG STATUS
  'fg-success-color': '#1e6627',
  'fg-error-color': '#8c2b3d',
  'fg-warning-color': '#8a5a1b',
  'fg-info-color': '#2a5a7f',

  // Border
  'border-primary-color': '#22263b54',
  'border-secondary-color': '#22263b1a',
  'border-accent-color': '#bbcef8',
  'border-disabled-color': '#22263b1a',
  'border-button-secondary-color': '#34407933',
  'border-focus-color': '#344079',
  'border-pressed-color': '#344079',

  // BORDER STATUS
  'border-success-color': '#5b9d63',
  'border-error-color': '#c58c99',
  'border-warning-color': '#e6c58d',
  'border-info-color': '#89b9d9',
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

const defaultLightShadowColor = '#22263b'
const defaultLightShadows = generateShadowsFromColor(defaultLightShadowColor)

export const useThemeStore = defineStore('theme', () => {
  const isCreatorOpen = ref(false)

  const activeThemeName = useStorage<ThemeType>('active-theme', 'light')
  const customThemePalette = useStorage<ColorPalette>('custom-theme-palette', defaultLightPalette)
  const customThemeRadius = useStorage<RadiusPalette>('custom-theme-radius', defaultRadiusPalette)
  const customThemeShadowColor = useStorage<string>('custom-theme-shadow-color', defaultLightShadowColor)
  const customThemeShadows = useStorage<ShadowPalette>('custom-theme-shadows', defaultLightShadows)

  // --- GETTERS ---
  const isCustomThemeActive = computed(() => activeThemeName.value === 'custom')
  const currentTheme = computed(() => activeThemeName.value)

  // --- ACTIONS ---
  function setTheme(name: ThemeType) {
    activeThemeName.value = name
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
    isCustomThemeActive,
    setTheme,
    openCreator,
    closeCreator,
    loadInitialTheme,
    resetCustomTheme,
    resetCustomRadius,
    resetCustomShadows,
    applyCustomShadowColor,
  }
})
