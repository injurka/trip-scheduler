import { createRequire } from 'node:module'
import path, { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import React from '@vitejs/plugin-react'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import { compression as Compression } from 'vite-plugin-compression2'
import { VitePWA } from 'vite-plugin-pwa'
import packageJson from '../package.json' with { type: 'json' }
import { autoImportOptionsCfg } from './cfg/auto-import.ts'
import { iconsCfg } from './cfg/icons.ts'
import { pwaCfg } from './cfg/pwa.ts'
import { resolveAppVersion, visualizerPlugin } from './lib/helpers.ts'
import { getVendorChunkName } from './vendor-chunks.ts'

const require = createRequire(import.meta.url)
const appVersion = resolveAppVersion(packageJson.version)

export default defineConfig({
  base: '/',
  root: resolve(import.meta.dirname, '../src/renderer'),
  publicDir: resolve(import.meta.dirname, '../public'),
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
    host: true,
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
    dedupe: ['vue', 'vue-router', 'pinia', 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    alias: {
      '~': fileURLToPath(new URL('../src/renderer', import.meta.url)),
      '@limiteddissolve/kit-image-viewer': resolve(import.meta.dirname, '../../../packages/kit-image-viewer/src/index.ts'),
      'react': path.dirname(require.resolve('react/package.json')),
      'react-dom': path.dirname(require.resolve('react-dom/package.json')),
    },
  },
  build: {
    cssCodeSplit: true,
    outDir: resolve(import.meta.dirname, '../dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, '../src/renderer/index.html'),
      },
      output: {
        manualChunks: getVendorChunkName,
      },
    },
  },
})
