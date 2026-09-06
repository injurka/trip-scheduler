import type { Directive, DirectiveBinding } from 'vue'
import type { ImageOptions } from '~/shared/lib/url'
import { resolveApiUrl } from '~/shared/lib/url'

const OFFLINE_MEDIA_CACHE_NAME = 'trip-scheduler-offline-media'

async function tryLoadFromCache(el: HTMLImageElement, url: string) {
  if (typeof caches === 'undefined' || !url)
    return
  try {
    const cache = await caches.open(OFFLINE_MEDIA_CACHE_NAME)
    const match = await cache.match(url)
    if (match) {
      const blob = await match.blob()
      el.src = URL.createObjectURL(blob)
    }
  }
  catch {
    // Ignore cache load failure
  }
}

function applyImageSrc(el: HTMLImageElement, url: string | null | undefined) {
  if (!url) {
    el.removeAttribute('src')
    return
  }

  el.onerror = () => {
    void tryLoadFromCache(el, url)
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    void tryLoadFromCache(el, url)
  }
  else {
    el.src = url
  }
}

export const vResolveSrc: Directive<HTMLImageElement, string | null | undefined> = {
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
