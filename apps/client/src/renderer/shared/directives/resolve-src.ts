import type { Directive, DirectiveBinding } from 'vue'
import { resolveApiUrl } from '~/shared/lib/url'

export const resolveSrc: Directive<HTMLImageElement, string | null | undefined> = {
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
