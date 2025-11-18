import { h, onMounted, shallowReactive, watch } from 'vue'

import StoryWrapper from './app-wrapper.vue'

export const DEFAULT_THEME = 'light'

const theme = shallowReactive({ themeName: DEFAULT_THEME })

export function withTheme(storyFn: any, context: any) {
  theme.themeName = context.globals.theme || DEFAULT_THEME
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
    setTheme(context.globals.theme ?? DEFAULT_THEME)
  })

  return () => {
    return h(StoryWrapper, theme, {
      story: () => h(story, { ...context.args }),
    })
  }
}
