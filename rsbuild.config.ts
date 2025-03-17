import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from '@rsbuild/core'
import { pluginCssMinimizer } from '@rsbuild/plugin-css-minimizer'
import { pluginSass } from '@rsbuild/plugin-sass'
import { pluginVue } from '@rsbuild/plugin-vue'
import pluginAutoImport from 'unplugin-auto-import/rspack'
import { autoImportOptions } from './build/utils'

// eslint-disable-next-line node/prefer-global/process
const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [
    pluginVue(),
    pluginSass({
      sassLoaderOptions: {
        additionalData: `
          @use '~/assets/scss/_setup.scss' as *;
        `,
      },
    }),
    pluginCssMinimizer(),
  ],

  server: {
    port: 1420,
    host: host || 'localhost',
  },

  dev: {
    hmr: !!host,
    client: {
      port: 1420,
      host: host || 'localhost',
    },
  },

  html: {
    template: './index.html',
  },
  source: {
    entry: {
      index: './src/main.ts',
    },
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
    include: ['**/*.js', '**/*.json', '**/*.jsx', '**/*.mjs', '**/*.ts', '**/*.tsx', '**/*.vue'],
  },

  tools: {
    rspack: {
      plugins: [pluginAutoImport(autoImportOptions)],
    },
    lightningcssLoader: false,
  },

})
