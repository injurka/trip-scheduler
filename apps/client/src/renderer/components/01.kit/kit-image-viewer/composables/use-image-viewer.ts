import type { ImageViewerImage, ImageViewerOptions } from '../models/types'

export function useImageViewer(options: ImageViewerOptions = {}) {
  const {
    enableKeyboard = true,
    enableTouch = true,
    maxZoom = 4,
    minZoom = 1,
    zoomStep = 0.5,
    animationDuration = 300,
  } = options

  const isOpen = ref(false)
  const images = ref<ImageViewerImage[]>([])
  const currentIndex = ref(0)
  const isLoading = ref(false)

  const currentImage = computed(() => images.value[currentIndex.value])
  const hasMultipleImages = computed(() => images.value.length > 1)
  const canZoomIn = computed(() => true) // Will be controlled by component
  const canZoomOut = computed(() => true) // Will be controlled by component

  let originalOverflow = ''

  // Body scroll lock management
  watch(isOpen, (value) => {
    if (value) {
      originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    else {
      document.body.style.overflow = originalOverflow
    }
  })

  onUnmounted(() => {
    document.body.style.overflow = originalOverflow
  })

  function open(imageList: ImageViewerImage[], startIndex = 0) {
    images.value = imageList
    currentIndex.value = Math.max(0, Math.min(startIndex, imageList.length - 1))
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function next() {
    if (!hasMultipleImages.value)
      return
    currentIndex.value = (currentIndex.value + 1) % images.value.length
  }

  function prev() {
    if (!hasMultipleImages.value)
      return
    currentIndex.value = (currentIndex.value - 1 + images.value.length) % images.value.length
  }

  function goToIndex(index: number) {
    if (index >= 0 && index < images.value.length) {
      currentIndex.value = index
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen.value || !enableKeyboard)
      return

    const target = e.target as HTMLElement
    const isEditing = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)

    switch (e.key) {
      case 'ArrowRight':
      case ' ':
        if (isEditing)
          return
        e.preventDefault()
        next()
        break
      case 'ArrowLeft':
        if (isEditing)
          return
        e.preventDefault()
        prev()
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'Home':
        if (isEditing)
          return
        e.preventDefault()
        goToIndex(0)
        break
      case 'End':
        if (isEditing)
          return
        e.preventDefault()
        goToIndex(images.value.length - 1)
        break
    }
  }

  if (enableKeyboard) {
    useEventListener(document, 'keydown', handleKeydown)
  }

  return {
    // State
    isOpen,
    isLoading,
    currentImage,
    currentIndex,
    hasMultipleImages,
    images,
    canZoomIn,
    canZoomOut,

    // Actions
    open,
    close,
    next,
    prev,
    goToIndex,

    // Options
    options: {
      enableTouch,
      maxZoom,
      minZoom,
      zoomStep,
      animationDuration,
    },
  }
}
