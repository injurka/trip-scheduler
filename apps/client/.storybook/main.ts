import type { StorybookConfig } from '@storybook/vue3-vite'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

// Создаем локальную функцию require, совместимую с ES-модулями
const require = createRequire(import.meta.url)

/**
 * Функция для получения абсолютного пути к директории пакета.
 * Это необходимо для корректной работы в окружениях с pnpm.
 */
function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, 'package.json')))
}

const config: StorybookConfig = {
  stories: [
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-themes'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/vue3-vite'),
    options: {
      builder: {
        viteConfigPath: './build/build-storybook.ts',
      },
    },
  },
}

export default config
