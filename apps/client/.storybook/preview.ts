import type { Preview } from '@storybook/vue3-vite'
import { setup } from '@storybook/vue3-vite'
import { createPinia } from 'pinia'
import router from '../src/renderer/shared/lib/router'

import { withTheme } from './with-theme.decorator'

import '../src/renderer/assets/scss/normalize.scss'
import '../src/renderer/assets/scss/fonts.scss'
import '../src/renderer/assets/scss/global.scss'
import '../src/renderer/assets/scss/atomic.scss'
import '../src/renderer/assets/scss/animation.scss'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

const pinia = createPinia()

setup((app) => {
  app.use(pinia)
  app.use(router)
})

const preview: Preview = {
  parameters: {
    backgrounds: {},
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },

  initialGlobals: {
    backgrounds: {
      value: 'light',
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
