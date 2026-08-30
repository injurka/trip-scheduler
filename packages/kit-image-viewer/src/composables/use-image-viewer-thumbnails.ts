import type { Ref } from 'vue'
import type { ImageViewerImage, VirtualThumbnailItem } from '../models/types'
import { useElementSize, useMediaQuery } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'

export type { VirtualThumbnailItem }

export interface UseImageViewerThumbnailsOptions {
  images: Readonly<Ref<ImageViewerImage[]>>
  currentIndex: Readonly<Ref<number>>
  thumbnailsRef?: Ref<HTMLElement | null>
  overscan?: number
  gap?: number
  resolveUrl?: (url: string) => string
}

export function isVideoImage(img?: ImageViewerImage | null): boolean {
  if (!img)
    return false
  return (
    img.mediaType === 'video'
    || img.meta?.mediaType === 'video'
    || /\.(?:mp4|webm|mov|mkv|avi|ogg|quicktime)$/i.test(img.url || '')
  )
}

export function resolveThumbnailUrl(image: ImageViewerImage, resolveUrl?: (url: string) => string): string {
  const v = image.variants
  const rawUrl = v?.small || v?.thumbnail || v?.thumb || v?.preview || v?.medium || image.url || ''
  return resolveUrl ? resolveUrl(rawUrl) : rawUrl
}

export function useImageViewerThumbnails(options: UseImageViewerThumbnailsOptions) {
  const {
    images,
    currentIndex,
    overscan = 5,
    gap = 10,
    resolveUrl,
  } = options

  const thumbnailsRef = options.thumbnailsRef ?? ref<HTMLElement | null>(null)
  const isMobile = useMediaQuery('(max-width: 959px)')
  const { width: containerWidth } = useElementSize(thumbnailsRef)

  const thumbnailSize = computed(() => (isMobile.value ? 44 : 56))
  const itemPitch = computed(() => thumbnailSize.value + gap)
  const totalWidth = computed(() => {
    const len = images.value.length
    return len > 0 ? len * itemPitch.value - gap : 0
  })

  const scrollLeft = ref(0)
  const failedThumbnails = ref<Set<number>>(new Set())
  const loadedThumbnails = ref<Set<number>>(new Set())

  watch(images, () => {
    failedThumbnails.value = new Set()
    loadedThumbnails.value = new Set()
  })

  function onThumbnailsScroll(event?: Event) {
    const target = (event?.target as HTMLElement | null) ?? thumbnailsRef.value
    if (target) {
      scrollLeft.value = target.scrollLeft
    }
  }

  const startIndex = computed(() => {
    const len = images.value.length
    if (!len)
      return 0

    const width = containerWidth.value
    if (width <= 0) {
      return Math.max(0, currentIndex.value - overscan)
    }

    const paddingLeft = Math.max(0, (width - thumbnailSize.value) / 2)
    const visibleLeft = scrollLeft.value - paddingLeft
    const rawStart = Math.floor(visibleLeft / itemPitch.value)
    return Math.max(0, rawStart - overscan)
  })

  const endIndex = computed(() => {
    const len = images.value.length
    if (!len)
      return 0

    const width = containerWidth.value
    if (width <= 0) {
      return Math.min(len - 1, currentIndex.value + overscan)
    }

    const paddingLeft = Math.max(0, (width - thumbnailSize.value) / 2)
    const visibleLeft = scrollLeft.value - paddingLeft
    const visibleRight = visibleLeft + width
    const rawEnd = Math.ceil(visibleRight / itemPitch.value)
    return Math.min(len - 1, rawEnd + overscan)
  })

  const visibleThumbnails = computed<VirtualThumbnailItem[]>(() => {
    const list = images.value
    const len = list.length
    if (!len)
      return []

    const items: VirtualThumbnailItem[] = []
    const start = Math.min(startIndex.value, len - 1)
    const end = Math.min(endIndex.value, len - 1)
    const pitch = itemPitch.value

    for (let i = start; i <= end; i++) {
      const img = list[i]
      if (img) {
        items.push({
          index: i,
          image: img,
          offset: i * pitch,
        })
      }
    }
    return items
  })

  function scrollThumbnailIntoView(index: number, behavior: ScrollBehavior = 'smooth') {
    const targetScrollLeft = index * itemPitch.value
    scrollLeft.value = targetScrollLeft

    nextTick(() => {
      const strip = thumbnailsRef.value
      if (!strip)
        return
      strip.scrollTo({
        left: targetScrollLeft,
        behavior,
      })
    })
  }

  function getThumbnailUrl(image: ImageViewerImage): string {
    return resolveThumbnailUrl(image, resolveUrl)
  }

  return {
    thumbnailsRef,
    thumbnailSize,
    gap,
    itemPitch,
    totalWidth,
    visibleThumbnails,
    failedThumbnails,
    loadedThumbnails,
    scrollLeft,
    containerWidth,
    startIndex,
    endIndex,
    onThumbnailsScroll,
    scrollThumbnailIntoView,
    resolveThumbnailUrl: getThumbnailUrl,
    isVideoImage,
  }
}

export type ImageViewerThumbnails = ReturnType<typeof useImageViewerThumbnails>
