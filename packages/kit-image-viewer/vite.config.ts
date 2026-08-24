import { resolve } from 'node:path'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    Vue(),
  ],
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'KitImageViewer',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'vue',
        '@vueuse/core',
        '@iconify/vue',
        '@floating-ui/vue',
      ],
      output: {
        globals: {
          'vue': 'Vue',
          '@vueuse/core': 'VueUse',
          '@iconify/vue': 'IconifyVue',
          '@floating-ui/vue': 'FloatingUiVue',
        },
      },
    },
    emptyOutDir: true,
  },
  test: {
    environment: 'happy-dom',
  },
})
