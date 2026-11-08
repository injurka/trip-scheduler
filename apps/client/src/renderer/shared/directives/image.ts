import type { Directive, DirectiveBinding } from 'vue'
import type { ImageOptions } from '~/shared/lib/url'
import { isAppOnline } from '~/shared/lib/connectivity'
import { getOfflineImageUrl } from '~/shared/lib/offline-cache'
import { getImageUrl, resolveApiUrl } from '~/shared/lib/url'

const cachedImages = new WeakMap<HTMLImageElement, { url: string, blob?: string }>()

function releaseImage(el: HTMLImageElement) {
  const current = cachedImages.get(el)

  if (current?.blob)
    URL.revokeObjectURL(current.blob)

  cachedImages.delete(el)
}

function applyImageSrc(el: HTMLImageElement, url: string | null | undefined) {
  releaseImage(el)

  if (!url) {
    el.removeAttribute('src')

    return
  }

  const current = { url, blob: undefined as string | undefined }
  cachedImages.set(el, current)
  const restore = async () => {
    if (current.blob)
      return

    const blob = await getOfflineImageUrl(url)

    if (!blob)
      return

    if (cachedImages.get(el) !== current) {
      URL.revokeObjectURL(blob)

      return
    }

    current.blob = blob
    el.src = blob
  }
  el.onerror = () => {
    void restore()
  }

  if (isAppOnline()) {
    el.src = url
  }
  else {
    el.removeAttribute('src')
    void restore()
  }
}

export const vResolveSrc: Directive<HTMLImageElement, string | null | undefined> = {
  unmounted: releaseImage,
  mounted(el: HTMLImageElement, binding: DirectiveBinding<string | null | undefined>) {
    if (!el.hasAttribute('loading')) {
      el.loading = 'lazy'
    }

    if (!el.hasAttribute('decoding')) {
      el.decoding = 'async'
    }

    const resolvedUrl = resolveApiUrl(binding.value)
    applyImageSrc(el, resolvedUrl)
  },

  updated(el: HTMLImageElement, binding: DirectiveBinding<string | null | undefined>) {
    if (binding.value !== binding.oldValue) {
      const resolvedUrl = resolveApiUrl(binding.value)
      applyImageSrc(el, resolvedUrl)
    }
  },
}

export const vImage: Directive<HTMLImageElement, { src?: string | null } & ImageOptions> = {
  unmounted: releaseImage,
  mounted(el, binding) {
    if (!el.hasAttribute('loading')) {
      el.loading = 'lazy'
    }

    if (!el.hasAttribute('decoding')) {
      el.decoding = 'async'
    }

    const { src, ...options } = binding.value ?? {}
    const url = getImageUrl(src, Object.keys(options).length ? options : undefined)
    applyImageSrc(el, url)
  },
  updated(el, binding) {
    if (JSON.stringify(binding.value) !== JSON.stringify(binding.oldValue)) {
      const { src, ...options } = binding.value ?? {}
      const url = getImageUrl(src, Object.keys(options).length ? options : undefined)
      applyImageSrc(el, url)
    }
  },
}
