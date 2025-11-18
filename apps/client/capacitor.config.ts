import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // --- Основная информация о приложении ---
  appId: 'com.tripscheduler.app',
  appName: 'TripScheduler',
  webDir: 'dist',

  // --- Конфигурация плагинов ---
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
    },
  },

  // --- Специфичные настройки для Android ---
  android: {
    allowMixedContent: true, // Полезно при работе с HTTP контентом
    backgroundColor: '#ffffff',
  },

  // --- Специфичные настройки для iOS ---
  ios: {
    allowsLinkPreview: false, // Отключает предварительный просмотр ссылок при долгом нажатии
    backgroundColor: '#ffffff',
  },
}

export default config
