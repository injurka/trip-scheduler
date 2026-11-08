import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '~': fileURLToPath(new URL('../src/renderer', import.meta.url)) } },
  css: { preprocessorOptions: { scss: { additionalData: '@use "~/assets/scss/_setup.scss" as *;' } } },
  test: { environment: 'happy-dom', include: ['test/kit-image.spec.ts'], maxWorkers: 1 },
})
