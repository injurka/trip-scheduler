import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      dts: false,
    }),
  ],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('../src/renderer', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@use "~/assets/scss/_setup.scss" as *;',
      },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['test/upload-manager.spec.ts'],
    maxWorkers: 1,
  },
})
