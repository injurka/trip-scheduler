import type { Preview } from '@storybook/vue3-vite'
import { setup } from '@storybook/vue3-vite'
import { createPinia } from 'pinia'

import { withTheme } from './with-theme.decorator'

import '../src/assets/scss/normalize.scss'
import '../src/assets/scss/fonts.scss'
import '../src/assets/scss/global.scss'
import '../src/assets/scss/atomic.scss'

import '../src/assets/scss/animation.scss'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

const pinia = createPinia()

setup((app) => {
  app.use(pinia)
  app.use(router)
})

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'light',
    },
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
}

export const globalTypes = {
  theme: {
    name: 'Theme',
    description: 'Global theme for components',
    toolbar: {
      icon: 'paintbrush',
      items: [
        { value: 'light', title: 'Light', left: '🌞' },
        { value: 'dark', title: 'Dark', left: '🌛' },
      ],
      dynamicTitle: true,
    },
  },
}

export const decorators = [withTheme]
export default preview
