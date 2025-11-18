import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { autoImportOptionsCfg } from './cfg/auto-import'
import { iconsCfg } from './cfg/icons'
import { pwaCfg } from './cfg/pwa'
import { visualizerPlugin } from './lib/helpers'

// Конфигурация для Web и PWA
export default defineConfig({
  base: '/',
  root: resolve(__dirname, '../src/renderer'),
  publicDir: resolve(__dirname, '../public'),
  envDir: '../..',
  plugins: [
    Vue({}),
    AutoImport(autoImportOptionsCfg),
    Icons(iconsCfg),
    VitePWA(pwaCfg),
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
    allowedHosts: ['2b9c3075ee15.ngrok-free.app'],
    port: 1420,
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

  resolve: {
    alias: {
      '~': fileURLToPath(new URL('../src/renderer', import.meta.url)),
    },
  },

  build: {
    outDir: resolve(__dirname, '../dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, '../src/renderer/index.html'),
      },
    },
  },
})
