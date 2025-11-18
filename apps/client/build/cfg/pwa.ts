import type { VitePWA } from 'vite-plugin-pwa'

export const pwaCfg: Parameters<typeof VitePWA>[0] = {
  strategies: 'injectManifest',
  srcDir: 'service-worker',
  filename: 'sw.ts',
  registerType: 'prompt',
  base: '/',
  scope: '/',
  includeAssets: ['favicon.ico'],
  manifest: {
    name: 'Trip Scheduler',
    short_name: 'TripScheduler',
    description: 'Ваш планировщик путешествий',
    theme_color: '#ffffff',
    lang: 'ru',
    icons: [{
      src: 'pwa-64x64.png',
      sizes: '64x64',
      type: 'image/png',
    }, {
      src: 'pwa-192x192.png',
      sizes: '192x192',
      type: 'image/png',
    }, {
      src: 'pwa-512x512.png',
      sizes: '512x512',
      type: 'image/png',
    }, {
      src: 'maskable-icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    }],
  },
  injectManifest: {
    globPatterns: ['**/*.{js,json,css,html,txt,svg,png,ico,webp,woff,woff2,ttf,eot,otf,wasm}'],
    globIgnores: ['emojis/**', 'manifest**.webmanifest'],
    maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
    dontCacheBustURLsMatching: /\.\w{8}\./,
    additionalManifestEntries: [{
      url: '/',
      revision: new Date().toString(),
      // revision: import.meta.env.APP_VERSION || new Date().toString(),
    }],
  },
}
