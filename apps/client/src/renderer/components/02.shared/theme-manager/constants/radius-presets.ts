import type { RadiusPalette } from '~/shared/store/theme.store'

export interface RadiusPreset {
  name: string
  radius: RadiusPalette
}

export const radiusPresets: RadiusPreset[] = [
  {
    name: 'Острые углы',
    radius: {
      'r-full': '9999px',
      'r-2xl': '0px',
      'r-xl': '0px',
      'r-l': '0px',
      'r-m': '0px',
      'r-s': '0px',
      'r-xs': '0px',
      'r-2xs': '0px',
    },
  },
  {
    name: 'Слегка скруглённые',
    radius: {
      'r-full': '9999px',
      'r-2xl': '12px',
      'r-xl': '10px',
      'r-l': '8px',
      'r-m': '6px',
      'r-s': '4px',
      'r-xs': '2px',
      'r-2xs': '2px',
    },
  },
  {
    name: 'Округлые',
    radius: {
      'r-full': '9999px',
      'r-2xl': '24px',
      'r-xl': '20px',
      'r-l': '16px',
      'r-m': '12px',
      'r-s': '8px',
      'r-xs': '6px',
      'r-2xs': '4px',
    },
  },
  {
    name: 'Капсула',
    radius: {
      'r-full': '9999px',
      'r-2xl': '32px',
      'r-xl': '28px',
      'r-l': '24px',
      'r-m': '20px',
      'r-s': '16px',
      'r-xs': '12px',
      'r-2xs': '10px',
    },
  },
]
