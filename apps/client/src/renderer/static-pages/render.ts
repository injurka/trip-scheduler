import type { Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createStaticPageApp } from './app'

export async function render(component: Component) {
  return renderToString(createStaticPageApp(component))
}
