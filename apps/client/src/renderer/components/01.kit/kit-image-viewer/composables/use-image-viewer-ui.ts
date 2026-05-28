import type { Ref } from 'vue'
import type { ImageQuality, ImageViewerImage } from '../models/types'
import { useFullscreen, useStorage } from '@vueuse/core'

export interface UseImageViewerUiOptions {
  currentImage: Readonly<Ref<ImageViewerImage | null>>
  containerRef: Ref<HTMLElement | null>
  thumbnailsRef: Ref<HTMLElement | null>
  qualityModel?: Ref<ImageQuality | undefined> // <-- Новое поле
  onQualityChange?: (quality: ImageQuality) => void // <-- Callback для обновления внешнего состояния
  onDownload?: (image: ImageViewerImage, quality: ImageQuality) => void
}

export function useImageViewerUi(options: UseImageViewerUiOptions) {
  const { currentImage, containerRef, thumbnailsRef, qualityModel, onQualityChange } = options

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

    const items: { value: ImageQuality, label: string, icon: string, available: boolean }[] = [
      {
        value: 'medium',
        label: 'Среднее',
        icon: 'mdi:image-size-select-small',
        available: !!image.variants?.medium,
      },
      {
        value: 'large',
        label: 'Высокое',
        icon: 'mdi:image-size-select-large',
        available: !!image.variants?.large,
      },
      {
        value: 'original',
        label: 'Оригинал',
        icon: 'mdi:image-size-select-actual',
        available: !!image.url,
      },
    ]

    return items.filter(i => i.available)
  })

  const displayUrl = computed(() => {
    const image = currentImage.value
    if (!image)
      return ''

    const { variants, url } = image
    const resolve = (u?: string | null) => u ?? ''

    switch (selectedQuality.value) {
      case 'medium': return resolve(variants?.medium) || resolve(variants?.large) || url
      case 'large': return resolve(variants?.large) || resolve(variants?.medium) || url
      case 'original': return url
      default: return url
    }
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
      const thumb = strip.children[index] as HTMLElement | undefined
      thumb?.scrollIntoView({ behavior, block: 'nearest', inline: 'center' })
    })
  }

  // --- Fullscreen ---
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef)

  // --- Download ---
  const isDownloading = ref(false)

  async function downloadCurrentImage() {
    const image = currentImage.value
    if (!image || isDownloading.value)
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

  function onImageLoad() {
    isImageLoaded.value = true
    isImageError.value = false
  }

  function onImageError() {
    isImageLoaded.value = false
    isImageError.value = true
  }

  // Единый watcher: сбрасываем всё при смене изображения
  watch(currentImage, () => {
    isImageLoaded.value = false
    isImageError.value = false

    if (isCaptionEditing.value)
      cancelCaptionEdit()

    if (!hasMetadata.value)
      isMetadataPanelOpen.value = false
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
    onImageLoad,
    onImageError,

    // Util
    isTextInputFocused,
  }
}

export type ImageViewerUi = ReturnType<typeof useImageViewerUi>
