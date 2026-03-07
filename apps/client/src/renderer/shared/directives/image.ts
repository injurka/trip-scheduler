import type { Directive, DirectiveBinding } from 'vue'
import type { ImageOptions } from '~/shared/lib/url'
import { resolveApiUrl } from '~/shared/lib/url'

export const vResolveSrc: Directive<HTMLImageElement, string | null | undefined> = {
  /**
   * Вызывается при монтировании элемента.
   * Устанавливает начальный src.
   */
  mounted(el: HTMLImageElement, binding: DirectiveBinding<string | null | undefined>) {
    const resolvedUrl = resolveApiUrl(binding.value)
    if (resolvedUrl) {
      el.src = resolvedUrl
    }
  },

  /**
   * Вызывается при обновлении значения, переданного в директиву.
   * Это важно для реактивного изменения src.
   */
  updated(el: HTMLImageElement, binding: DirectiveBinding<string | null | undefined>) {
    if (binding.value !== binding.oldValue) {
      const resolvedUrl = resolveApiUrl(binding.value)
      if (resolvedUrl) {
        el.src = resolvedUrl
      }
      else {
        el.removeAttribute('src')
      }
    }
  },
}

// <img v-image="{ src: image.url, w: 400, fmt: 'webp' }" />
export const vImage: Directive<HTMLImageElement, { src?: string | null } & ImageOptions> = {
  mounted(el, binding) {
    const { src, ...options } = binding.value ?? {}
    const url = getImageUrl(src, Object.keys(options).length ? options : undefined)
    if (url)
      el.src = url
  },
  updated(el, binding) {
    if (JSON.stringify(binding.value) !== JSON.stringify(binding.oldValue)) {
      const { src, ...options } = binding.value ?? {}
      const url = getImageUrl(src, Object.keys(options).length ? options : undefined)
      if (url)
        el.src = url
      else el.removeAttribute('src')
    }
  },
}
