import type { Ref } from 'vue'
import type { ImageQuality, ImageViewerImage } from '../models/types'
import { tryOnUnmounted, useFullscreen, useStorage } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'

export interface UseImageViewerUiOptions {
  currentImage: Readonly<Ref<ImageViewerImage | null>>
  containerRef: Ref<HTMLElement | null>
  thumbnailsRef: Ref<HTMLElement | null>
  qualityModel?: Ref<ImageQuality | undefined>
  qualityLabels?: Record<string, string>
  onQualityChange?: (quality: ImageQuality) => void
  onDownload?: (image: ImageViewerImage, quality: ImageQuality) => void
  resolveUrl?: (url: string) => string
}

const DEFAULT_QUALITY_ORDER = [
  'thumbnail',
  'thumb',
  'small',
  'preview',
  'medium',
  'hd',
  'large',
  'fhd',
  '2k',
  '4k',
  'original',
  'raw',
]

const DEFAULT_QUALITY_LABELS: Record<string, string> = {
  'thumbnail': 'Миниатюра',
  'thumb': 'Миниатюра',
  'small': 'Small (Превью)',
  'preview': 'Предпросмотр',
  'medium': 'Medium (720p)',
  'hd': 'HD (720p)',
  'large': 'Large (1080p)',
  'fhd': 'Full HD (1080p)',
  '2k': '2K (QHD)',
  '4k': '4K (Ultra HD)',
  'original': 'Оригинал',
  'raw': 'RAW',
}

const DEFAULT_QUALITY_ICONS: Record<string, string> = {
  'thumbnail': 'mdi:image-size-select-small',
  'thumb': 'mdi:image-size-select-small',
  'small': 'mdi:image-size-select-small',
  'preview': 'mdi:image-size-select-small',
  'medium': 'mdi:image-size-select-small',
  'hd': 'mdi:high-definition',
  'large': 'mdi:image-size-select-large',
  'fhd': 'mdi:image-filter-hdr',
  '2k': 'mdi:image-size-select-actual',
  '4k': 'mdi:image-filter-hdr',
  'original': 'mdi:image-size-select-actual',
  'raw': 'mdi:raw',
}

export function useImageViewerUi(options: UseImageViewerUiOptions) {
  const {
    currentImage,
    containerRef,
    thumbnailsRef,
    qualityModel,
    qualityLabels,
    onQualityChange,
  } = options

  // --- Quality ---
  const storedQuality = useStorage<ImageQuality>('viewer-quality-preference', 'large')

  const selectedQuality = computed<ImageQuality>({
    get: () => qualityModel?.value ?? storedQuality.value,
    set: (val) => {
      storedQuality.value = val
      onQualityChange?.(val)
    },
  })

  const qualityItems = computed(() => {
    const image = currentImage.value
    if (!image)
      return []

    const keys = new Set<string>()
    if (image.variants) {
      for (const [k, v] of Object.entries(image.variants)) {
        if (v && typeof v === 'string')
          keys.add(k)
      }
    }
    if (image.url && !keys.has('original')) {
      keys.add('original')
    }

    const sortedKeys = Array.from(keys).sort((a, b) => {
      const idxA = DEFAULT_QUALITY_ORDER.indexOf(a)
      const idxB = DEFAULT_QUALITY_ORDER.indexOf(b)
      if (idxA !== -1 && idxB !== -1)
        return idxA - idxB
      if (idxA !== -1)
        return -1
      if (idxB !== -1)
        return 1
      return a.localeCompare(b)
    })

    return sortedKeys.map((key) => {
      const label = qualityLabels?.[key] || DEFAULT_QUALITY_LABELS[key] || (key.charAt(0).toUpperCase() + key.slice(1))
      const icon = DEFAULT_QUALITY_ICONS[key] || 'mdi:image-outline'
      return {
        value: key as ImageQuality,
        label,
        icon,
        available: true,
      }
    })
  })

  const displayUrl = computed(() => {
    const image = currentImage.value
    if (!image)
      return ''

    const { variants, url } = image
    const q = selectedQuality.value
    let rawUrl = ''

    if (variants && variants[q])
      rawUrl = variants[q]!
    else if (q === 'original' && url)
      rawUrl = url
    else
      rawUrl = variants?.large || variants?.medium || variants?.small || url || ''

    return options.resolveUrl ? options.resolveUrl(rawUrl) : rawUrl
  })

  // --- Caption ---
  const isCaptionEditing = ref(false)
  const captionDraft = ref('')

  function startCaptionEdit() {
    captionDraft.value = currentImage.value?.caption ?? ''
    isCaptionEditing.value = true
  }

  function cancelCaptionEdit() {
    isCaptionEditing.value = false
    captionDraft.value = ''
  }

  // --- Metadata panel ---
  const isMetadataPanelOpen = ref(false)

  const hasMetadata = computed(() => {
    const meta = currentImage.value?.meta
    if (!meta)
      return false
    return !!(meta.camera?.make || meta.camera?.model || meta.takenAt || meta.latitude)
  })

  function toggleMetadataPanel() {
    if (!hasMetadata.value)
      return
    isMetadataPanelOpen.value = !isMetadataPanelOpen.value
  }

  function closeMetadataPanel() {
    isMetadataPanelOpen.value = false
  }

  // --- Thumbnails ---
  const isThumbnailsVisible = ref(true)

  function toggleThumbnails() {
    isThumbnailsVisible.value = !isThumbnailsVisible.value
  }

  function scrollThumbnailIntoView(index: number, behavior: ScrollBehavior = 'smooth') {
    nextTick(() => {
      const strip = thumbnailsRef.value
      if (!strip)
        return
      const isMobile = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 959px)')?.matches
      const itemPitch = (isMobile ? 44 : 56) + 10
      const targetScrollLeft = index * itemPitch

      strip.scrollTo({
        left: targetScrollLeft,
        behavior,
      })
    })
  }

  // --- Fullscreen ---
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef)

  // --- Download ---
  const isDownloading = ref(false)

  async function downloadCurrentImage() {
    const image = currentImage.value
    if (!image || isDownloading.value || typeof document === 'undefined')
      return

    isDownloading.value = true
    try {
      const response = await fetch(displayUrl.value)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = objectUrl
      a.download = image.alt ?? `image-${Date.now()}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    }
    catch (e) {
      console.error('[ImageViewer] Download failed:', e)
    }
    finally {
      isDownloading.value = false
    }
  }

  // --- Image loading state ---
  const isImageLoaded = ref(false)
  const isImageError = ref(false)
  const showLoaderDelayed = ref(false)
  let loaderTimeout: ReturnType<typeof setTimeout> | null = null
  let loadStateTimeout: ReturnType<typeof setTimeout> | null = null

  function clearLoaderTimeout() {
    if (loaderTimeout) {
      clearTimeout(loaderTimeout)
      loaderTimeout = null
    }
  }

  function clearLoadStateTimeout() {
    if (loadStateTimeout) {
      clearTimeout(loadStateTimeout)
      loadStateTimeout = null
    }
  }

  function onImageLoad() {
    clearLoadStateTimeout()
    isImageLoaded.value = true
    isImageError.value = false
    showLoaderDelayed.value = false
    clearLoaderTimeout()
  }

  function onImageError() {
    clearLoadStateTimeout()
    isImageLoaded.value = false
    isImageError.value = true
    showLoaderDelayed.value = false
    clearLoaderTimeout()
  }

  watch(currentImage, () => {
    clearLoadStateTimeout()

    // Даем микро-задержку перед сбросом isImageLoaded. Если новое фото уже есть в кеше
    // браузера (что почти всегда так после предзагрузки в соседнем preview),
    // onImageLoad сработает мгновенно и opacity не упадет до 0. Идеально для плавных свайпов.
    loadStateTimeout = setTimeout(() => {
      isImageLoaded.value = false
    }, 50)

    isImageError.value = false
    showLoaderDelayed.value = false
    clearLoaderTimeout()

    loaderTimeout = setTimeout(() => {
      if (!isImageLoaded.value && !isImageError.value) {
        showLoaderDelayed.value = true
      }
    }, 1000)

    if (isCaptionEditing.value)
      cancelCaptionEdit()

    if (!hasMetadata.value)
      isMetadataPanelOpen.value = false
  }, { immediate: true })

  tryOnUnmounted(() => {
    clearLoadStateTimeout()
    clearLoaderTimeout()
  })

  // --- Util ---
  const isTextInputFocused = computed(() => isCaptionEditing.value)

  return {
    // Quality
    selectedQuality,
    qualityItems,
    displayUrl,

    // Caption
    isCaptionEditing,
    captionDraft,
    startCaptionEdit,
    cancelCaptionEdit,

    // Metadata
    isMetadataPanelOpen,
    hasMetadata,
    toggleMetadataPanel,
    closeMetadataPanel,

    // Thumbnails
    isThumbnailsVisible,
    toggleThumbnails,
    scrollThumbnailIntoView,

    // Fullscreen
    isFullscreen,
    toggleFullscreen,

    // Download
    isDownloading,
    downloadCurrentImage,

    // Image state
    isImageLoaded,
    isImageError,
    showLoaderDelayed,
    onImageLoad,
    onImageError,

    // Util
    isTextInputFocused,
  }
}

export type ImageViewerUi = ReturnType<typeof useImageViewerUi>
