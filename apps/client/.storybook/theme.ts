import { create } from '@storybook/theming'

export const customTheme = create({
  base: 'light',

  // Brand
  brandTitle: 'TripScheduler Storybook',
  brandUrl: '/',

  // Colors from your palette
  colorPrimary: '#e16032', // fg-accent-color
  colorSecondary: '#f37a51', // bg-action-hover-color

  // UI colors
  appBg: '#faf4f2', // bg-primary-color
  appContentBg: '#f2edeb', // bg-secondary-color
  appPreviewBg: '#faf4f2', // bg-primary-color
  appBorderColor: '#d2cdcb', // border-primary-color
  appBorderRadius: 8,

  // Text colors
  textColor: '#29242a', // fg-primary-color
  textInverseColor: '#faf4f2', // fg-inverted-color
  textMutedColor: '#706b6e', // fg-secondary-color

  // Toolbar colors
  barTextColor: '#29242a', // fg-primary-color
  barHoverColor: '#ede7e5bf', // bg-hover-color
  barSelectedColor: '#e16032', // fg-accent-color
  barBg: '#f2edeb', // bg-secondary-color

  // Form colors
  inputBg: '#faf4f2', // bg-primary-color
  inputBorder: '#d2cdcb', // border-primary-color
  inputTextColor: '#29242a', // fg-primary-color
  inputBorderRadius: 4,

  // Button colors
  buttonBg: '#fce9e4', // bg-accent-color
  buttonBorder: '#e1603233', // border-button-secondary-color
})
