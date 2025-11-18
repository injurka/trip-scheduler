import type { RemovableRef } from '@vueuse/core'
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { ImageQuality, ImageViewerImage } from '../models/types'

interface SwipeState {
  isSwipe: boolean
  startX: number
  currentX: number
  startTime: number
}

interface UseSwipeNavigationOptions {
  onNext: () => void
  onPrev: () => void
  threshold: number
  velocity: number
  images: Ref<ImageViewerImage[]>
  currentIndex: Ref<number>
  isZoomed: MaybeRefOrGetter<boolean>
  preferredQuality: RemovableRef<ImageQuality>
}

/**
 * Вспомогательная функция для получения URL изображения с учетом выбранного качества и запасных вариантов.
 * @param image - Объект изображения.
 * @param quality - Предпочтительное качество.
 * @returns URL изображения или null.
 */
function getImageUrl(image: ImageViewerImage | null, quality: ImageQuality): string | null {
  if (!image)
    return null

  const { variants, url } = image

  switch (quality) {
    case 'medium':
      return variants?.medium || variants?.large || url
    case 'large':
      return variants?.large || url
    case 'original':
      return url
    default:
      // Запасной вариант для любых непредвиденных значений
      return variants?.large || url
  }
}

export function useSwipeNavigation(options: UseSwipeNavigationOptions) {
  const {
    onNext,
    onPrev,
    threshold = 80,
    velocity = 0.3,
    images,
    currentIndex,
    isZoomed,
    preferredQuality,
  } = options

  const swipeState = ref<SwipeState>({
    isSwipe: false,
    startX: 0,
    currentX: 0,
    startTime: 0,
  })
  const translateX = ref(0)
  const isAnimating = ref(false)

  const canSwipeNext = computed(() => currentIndex.value < images.value.length - 1)
  const canSwipePrev = computed(() => currentIndex.value > 0)

  const swipeProgress = computed(() => {
    if (toValue(isZoomed))
      return 0
    const containerWidth = window.innerWidth || 1
    return Math.max(-1, Math.min(1, translateX.value / containerWidth))
  })

  const nextImageSrc = computed(() => {
    if (!canSwipeNext.value)
      return null
    const nextImage = images.value[currentIndex.value + 1]
    return getImageUrl(nextImage, preferredQuality.value)
  })

  const prevImageSrc = computed(() => {
    if (!canSwipePrev.value)
      return null
    const prevImage = images.value[currentIndex.value - 1]
    return getImageUrl(prevImage, preferredQuality.value)
  })

  function handleTouchStart(event: TouchEvent) {
    if (toValue(isZoomed) || images.value.length <= 1)
      return

    const touch = event.touches[0]
    swipeState.value = {
      isSwipe: true,
      startX: touch.clientX,
      currentX: touch.clientX,
      startTime: Date.now(),
    }
    isAnimating.value = false
  }

  function handleTouchMove(event: TouchEvent) {
    if (!swipeState.value.isSwipe || toValue(isZoomed))
      return

    event.preventDefault()
    const touch = event.touches[0]
    swipeState.value.currentX = touch.clientX

    let diff = touch.clientX - swipeState.value.startX

    if ((diff > 0 && !canSwipePrev.value) || (diff < 0 && !canSwipeNext.value))
      diff /= 3

    translateX.value = diff
  }

  function handleTouchEnd() {
    if (!swipeState.value.isSwipe || toValue(isZoomed))
      return

    const deltaX = swipeState.value.currentX - swipeState.value.startX
    const deltaTime = Date.now() - swipeState.value.startTime
    const swipeVelocity = Math.abs(deltaX) / deltaTime

    const shouldTrigger = Math.abs(deltaX) > threshold || swipeVelocity > velocity
    isAnimating.value = true

    if (shouldTrigger) {
      if (deltaX > 0 && canSwipePrev.value) {
        translateX.value = window.innerWidth
        setTimeout(() => {
          onPrev()
          resetSwipe()
        }, 200)
      }
      else if (deltaX < 0 && canSwipeNext.value) {
        translateX.value = -window.innerWidth
        setTimeout(() => {
          onNext()
          resetSwipe()
        }, 200)
      }
      else {
        resetSwipe(true)
      }
    }
    else {
      resetSwipe(true)
    }

    swipeState.value.isSwipe = false
  }

  function resetSwipe(withAnimation = false) {
    if (!withAnimation)
      isAnimating.value = false

    translateX.value = 0
    if (withAnimation) {
      setTimeout(() => {
        isAnimating.value = false
      }, 200)
    }
  }

  watch(currentIndex, () => {
    isAnimating.value = true
    resetSwipe()
  })

  const containerStyle = computed(() => ({
    transform: `translateX(${translateX.value}px)`,
    transition: isAnimating.value ? 'transform 0.2s ease-out' : 'none',
  }))

  const currentImageStyle = computed(() => {
    const progress = Math.abs(swipeProgress.value)
    const opacity = 1 - progress * 0.3

    const style: Record<string, any> = {
      opacity: isAnimating.value ? 1 : opacity,
      transition: isAnimating.value ? 'transform 0.2s ease-out, opacity 0.2s ease-out' : 'none',
    }

    // Только применяем трансформацию масштабирования, если свайп действительно происходит.
    // Это предотвращает переопределение трансформации масштабирования от useImageViewerTransform, когда изображение не смахивается.
    if (progress > 0) {
      const scale = 1 - progress * 0.1
      style.transform = `scale(${scale})`
    }

    return style
  })

  const adjacentImageStyle = computed(() => {
    const progress = Math.abs(swipeProgress.value)
    const opacity = progress * 1.2
    return {
      opacity: Math.min(1, opacity),
      transition: isAnimating.value ? 'opacity 0.2s ease-out' : 'none',
    }
  })

  return {
    nextImageSrc,
    prevImageSrc,
    containerStyle,
    currentImageStyle,
    adjacentImageStyle,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  }
}
