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
import { autoImportOptionsCfg } from './cfg/auto-import'
import { iconsCfg } from './cfg/icons'
import { pwaCfg } from './cfg/pwa'
import { visualizerPlugin } from './lib/helpers'

const require = createRequire(import.meta.url)

export default defineConfig({
  base: '/',
  root: resolve(__dirname, '../src/renderer'),
  publicDir: resolve(__dirname, '../public'),
  envDir: '../..',
  plugins: [
    Vue(),
    React(),
    AutoImport(autoImportOptionsCfg),
    Compression({
      algorithms: ['gzip'],
      exclude: [/\\.(br)$/, /\\.(gz)$/],
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
    port: 1420,
    proxy: {
      '/api/rm': {
        target: 'https://realtimemap.ru',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/rm/, ''),
      },
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
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    alias: {
      '~': fileURLToPath(new URL('../src/renderer', import.meta.url)),
      'react': path.dirname(require.resolve('react/package.json')),
      'react-dom': path.dirname(require.resolve('react-dom/package.json')),
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
