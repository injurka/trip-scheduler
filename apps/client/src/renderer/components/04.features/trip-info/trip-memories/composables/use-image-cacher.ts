import { useStorage } from '@vueuse/core'
import { ref } from 'vue'

export interface CachableImage {
  url: string
  variants?: {
    small?: string
    medium?: string
    large?: string
    [key: string]: string | undefined
  } | null
}

export type ImageQuality = 'small' | 'medium' | 'large' | 'original'

const isCaching = ref(false)
const isManualCaching = ref(false)
const cachedCount = ref(0)
const totalToCache = ref(0)
const cacheQueue = ref<string[]>([])
const selectedQuality = ref<ImageQuality>('large')

const isBackgroundCaching = useStorage('trip-background-caching-enabled', false)
const backgroundCachingQuality = useStorage<ImageQuality>('trip-background-caching-quality', 'large')

export function useImageCacher() {
  function preloadImage(url: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = () => resolve() // resolve anyway to continue queue
      img.src = url
    })
  }

  async function processQueue() {
    if (cacheQueue.value.length === 0) {
      isCaching.value = false
      isManualCaching.value = false
      return
    }

    isCaching.value = true
    const url = cacheQueue.value.shift()
    if (url) {
      await preloadImage(url)
      cachedCount.value++
    }

    if (isCaching.value) { // if not stopped
      processQueue()
    }
  }

  function startCaching(images: CachableImage[], quality: ImageQuality = 'large', mode: 'manual' | 'background' = 'manual') {
    selectedQuality.value = quality

    const urlsToCache = images.map((img) => {
      if (quality === 'original')
        return img.url
      return img.variants?.[quality] || img.url
    })

    cacheQueue.value = urlsToCache
    totalToCache.value = urlsToCache.length
    cachedCount.value = 0
    isCaching.value = true
    isManualCaching.value = mode === 'manual'

    if (mode === 'manual') {
      isBackgroundCaching.value = false
    }

    processQueue()
  }

  function stopCaching() {
    isCaching.value = false
    isManualCaching.value = false
    cacheQueue.value = []
  }

  function toggleBackgroundCaching(images: CachableImage[], quality?: ImageQuality) {
    if (quality) {
      backgroundCachingQuality.value = quality
    }
    isBackgroundCaching.value = !isBackgroundCaching.value
    if (isBackgroundCaching.value) {
      startCaching(images, backgroundCachingQuality.value, 'background')
    }
    else {
      stopCaching()
    }
  }

  return {
    isCaching,
    isManualCaching,
    isBackgroundCaching,
    backgroundCachingQuality,
    cachedCount,
    totalToCache,
    selectedQuality,
    startCaching,
    stopCaching,
    toggleBackgroundCaching,
  }
}
