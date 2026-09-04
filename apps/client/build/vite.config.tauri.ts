import { createRequire } from 'node:module'
import path, { resolve } from 'node:path'

import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import React from '@vitejs/plugin-react'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import { compression as Compression } from 'vite-plugin-compression2'
import { VitePWA } from 'vite-plugin-pwa'
import packageJson from '../package.json' with { type: 'json' }
import { autoImportOptionsCfg } from './cfg/auto-import'
import { iconsCfg } from './cfg/icons'
import { visualizerPlugin } from './lib/helpers'

const require = createRequire(import.meta.url)

const appVersion = process.env.VITE_APP_VERSION || packageJson.version

// Конфигурация для нативной сборки (Tauri: десктоп + мобилки).
// Относительный base обязателен: ассеты грузятся из tauri://localhost и file://.
export default defineConfig({
  base: './',
  root: resolve(__dirname, '../src/renderer'),
  publicDir: resolve(__dirname, '../public'),
  envDir: '../..',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia', '@vueuse/core', '@vueuse/head'],
  },
  plugins: [
    Vue(),
    React(),
    AutoImport(autoImportOptionsCfg),
    Compression({
      algorithms: ['gzip'],
      exclude: [/\.(br)$/, /\.(gz)$/],
    }),
    Compression({
      algorithms: ['brotliCompress'],
      exclude: [/\.(br)$/, /\.(gz)$/],
    }),
    Icons(iconsCfg),
    // Service Worker в нативном вебвью не нужен (обновления приезжают с новой сборкой).
    VitePWA({ disable: true }),
    ...visualizerPlugin('renderer'),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use '~/assets/scss/_setup.scss' as *;`,
      },
    },
  },
  server: {
    host: process.env.TAURI_DEV_HOST || true,
    port: 1420,
    strictPort: true,
    hmr: process.env.TAURI_DEV_HOST
      ? {
          protocol: 'ws',
          host: process.env.TAURI_DEV_HOST,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**', '../../native/src-tauri/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  clearScreen: false,
  resolve: {
    dedupe: ['vue', 'vue-router', 'pinia', 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    alias: {
      '~': fileURLToPath(new URL('../src/renderer', import.meta.url)),
      '@injurka/kit-image-viewer': resolve(__dirname, '../../../packages/kit-image-viewer/src/index.ts'),
      'react': path.dirname(require.resolve('react/package.json')),
      'react-dom': path.dirname(require.resolve('react-dom/package.json')),
    },
  },
  build: {
    cssCodeSplit: true,
    outDir: resolve(__dirname, '../dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        main: resolve(__dirname, '../src/renderer/index.html'),
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules'))
            return undefined

          if (/[\\/]node_modules[\\/](?:vue|vue-router|pinia|@vueuse)[\\/]/.test(id))
            return 'vendor-core'
          if (id.includes('react') || id.includes('react-dom'))
            return 'vendor-react'
          if (id.includes('@excalidraw') || id.includes('veaury'))
            return 'vendor-excalidraw'
          if (id.includes('@milkdown'))
            return 'vendor-milkdown'
          if (id.includes('mermaid') || id.includes('katex') || id.includes('elkjs'))
            return 'vendor-editor-addons'
          if (id.includes('ol') || id.includes('d3-geo') || id.includes('@mapbox/polyline'))
            return 'vendor-map'
          if (id.includes('reka-ui') || id.includes('@iconify'))
            return 'vendor-ui'
          if (id.includes('chart.js') || id.includes('vue-chartjs'))
            return 'vendor-charts'
          if (id.includes('workbox') || id.includes('localforage'))
            return 'vendor-storage'
          if (
            id.includes('vue-advanced-cropper')
            || id.includes('fflate')
            || id.includes('uuid')
            || id.includes('maska')
            || id.includes('ofetch')
            || id.includes('@internationalized/date')
            || id.includes('@trpc')
          ) {
            return 'vendor-utils'
          }

          return 'vendor-others'
        },
      },
    },
  },
})
