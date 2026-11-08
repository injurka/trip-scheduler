import { fileURLToPath, URL } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import { autoImportOptionsCfg } from './cfg/auto-import'
import { iconsCfg } from './cfg/icons'
import { postcssHoverMedia } from './lib/postcss-hover-media'

export default defineConfig({
  css: {
    postcss: {
      plugins: [postcssHoverMedia()],
    },
    preprocessorOptions: {
      scss: {
        additionalData: `@use '~/assets/scss/_setup.scss' as *;`,
      },
    },
  },
  plugins: [
    Vue(),
    AutoImport(autoImportOptionsCfg),
    Icons(iconsCfg),
  ],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('../src/renderer', import.meta.url)),
    },
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
  },
  optimizeDeps: {
    exclude: ['vue-router', 'pinia'],
  },
})
