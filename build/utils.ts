import type { Options as AutoImportOptions } from 'unplugin-auto-import/types'

// Plugins options

export const autoImportOptions: AutoImportOptions = {
  imports: ['vue-router', '@vueuse/core', 'vue', 'pinia'],
  dirs: [
    './components/domain/',
    './components/modules/',
    './components/shared/',
    //
    './src/shared/lib/',
    './src/shared/types/',
  ],
  dts: './src/types/dts/auto-imports.d.ts',
}
