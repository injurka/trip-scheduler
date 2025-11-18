import { resolve } from 'node:path'
import process from 'node:process'
import Vue from '@vitejs/plugin-vue'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import AutoImport from 'unplugin-auto-import/vite'
import Icons from 'unplugin-icons/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { autoImportOptionsCfg } from './cfg/auto-import'
import { iconsCfg } from './cfg/icons'
import { pwaCfg } from './cfg/pwa'
import { visualizerPlugin } from './lib/helpers'

// Конфигурация для Electron
export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      ...visualizerPlugin('main'),
    ],
    build: {
      sourcemap: process.env.NODE_ENV === 'development',
      rollupOptions: {
        input: {
          index: resolve(__dirname, '../src/main/index.ts'),
        },
      },
    },
    resolve: {
      alias: {
        '~main': resolve('src/main'),
        '~renderer': resolve('src/renderer'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, '../src/preload/index.ts'),
        },
      },
      sourcemap: process.env.NODE_ENV === 'development',
    },
  },
  renderer: {
    resolve: {
      alias: {
        '~/': `${resolve(__dirname, '../src/renderer')}/`,
      },
    },
    plugins: [
      Vue(),
      AutoImport(autoImportOptionsCfg),
      Icons(iconsCfg),
      VitePWA(pwaCfg),
      ...visualizerPlugin('renderer'),
    ],
    worker: {
      format: 'es',
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use '~/assets/scss/_setup.scss' as *;`,
        },
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, '../src/renderer/index.html'),
        },
      },
      sourcemap: process.env.NODE_ENV === 'development',
    },
  },
})
