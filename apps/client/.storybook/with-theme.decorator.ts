import type { Decorator } from '@storybook/vue3-vite'
import { h, onMounted, shallowReactive, watch } from 'vue'
import StoryWrapper from './app-wrapper.vue'

export const DEFAULT_THEME = 'light'

const theme = shallowReactive({ themeName: DEFAULT_THEME })

export const withTheme: Decorator = (storyFn, context) => {
  theme.themeName = typeof context.globals.theme === 'string' ? context.globals.theme : DEFAULT_THEME
  const story = storyFn()

  const setTheme = (value: string) => {
    const rootElement = document.querySelector('html')

    if (rootElement)
      rootElement.dataset.theme = value
  }

  watch(theme, () => {
    setTheme(theme.themeName)
  })

  onMounted(() => {
    setTheme(theme.themeName)
  })

  return () => {
    return h(StoryWrapper, theme, {
      story: () => h(story, { ...context.args }),
    })
  }
}
