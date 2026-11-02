import type { Component } from 'vue'
import { addCollection } from '@iconify/vue'
import { createSSRApp } from 'vue'
import icons from '~/assets/icons-bundle.json'

export function createStaticPageApp(component: Component) {
  addCollection(icons)

  return createSSRApp(component, { standalone: true })
}
