import type { MaybeRefOrGetter, Ref } from 'vue'
import type { ImageQuality, ImageViewerImage } from '../models/types'
import { tryOnUnmounted } from '@vueuse/core'

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
  preferredQuality: Ref<ImageQuality>
  baseTransform: MaybeRefOrGetter<string>
}

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
      return variants?.large || url
  }
}

export function useImageViewerSwipe(options: UseSwipeNavigationOptions) {
  const {
    onNext,
    onPrev,
    threshold = 80,
    velocity = 0.3,
    images,
    currentIndex,
    isZoomed,
    preferredQuality,
    baseTransform,
  } = options

  const swipeState = ref<SwipeState>({
    isSwipe: false,
    startX: 0,
    currentX: 0,
    startTime: 0,
  })
  const translateX = ref(0)
  const isAnimating = ref(false)

  let swipeTimeout: ReturnType<typeof setTimeout> | null = null
  let pendingSwipeAction: (() => void) | null = null

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

  // Если юзер быстро нажимает снова во время анимации, мгновенно вызываем событие
  function flushPendingSwipe() {
    if (swipeTimeout) {
      clearTimeout(swipeTimeout)
      swipeTimeout = null
    }
    if (pendingSwipeAction) {
      pendingSwipeAction()
      pendingSwipeAction = null
    }
  }

  function handleTouchStart(event: TouchEvent) {
    if (toValue(isZoomed) || images.value.length <= 1)
      return

    if (pendingSwipeAction) {
      flushPendingSwipe()
      resetSwipe() // мгновенно обнуляем translateX для начала нового свайпа
    }

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

    flushPendingSwipe()

    if (shouldTrigger) {
      if (deltaX > 0 && canSwipePrev.value) {
        translateX.value = window.innerWidth
        pendingSwipeAction = onPrev
        swipeTimeout = setTimeout(() => {
          flushPendingSwipe()
        }, 200)
      }
      else if (deltaX < 0 && canSwipeNext.value) {
        translateX.value = -window.innerWidth
        pendingSwipeAction = onNext
        swipeTimeout = setTimeout(() => {
          flushPendingSwipe()
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

  watch(currentIndex, async () => {
    await nextTick()
    // Делаем сброс позиции только если в данный момент юзер уже не потянул картинку (не перекрываем его новый свайп)
    if (!swipeState.value.isSwipe && !pendingSwipeAction) {
      resetSwipe()
    }
  })

  tryOnUnmounted(() => {
    if (swipeTimeout) {
      clearTimeout(swipeTimeout)
      swipeTimeout = null
    }
    pendingSwipeAction = null
  })

  const containerStyle = computed(() => ({
    transform: `translateX(${translateX.value}px)`,
    transition: isAnimating.value ? 'transform 0.2s ease-out' : 'none',
  }))

  const currentImageStyle = computed(() => {
    const progress = Math.abs(swipeProgress.value)
    const style: Record<string, any> = {}

    if (progress > 0 || isAnimating.value) {
      const opacity = 1 - progress * 0.3
      const brightness = 1 - progress * 0.4
      style.opacity = opacity
      style.filter = `brightness(${brightness})`
      style.transition = isAnimating.value
        ? 'transform 0.2s ease-out, opacity 0.2s ease-out, filter 0.2s ease-out'
        : 'none'
    }

    if (progress > 0) {
      const scale = 1 - progress * 0.1
      style.transform = `${toValue(baseTransform)} scale(${scale})`
    }

    return style
  })

  const adjacentImageStyle = computed(() => {
    const progress = Math.abs(swipeProgress.value)
    const opacity = progress * 1.2
    const brightness = 0.6 + progress * 0.4
    return {
      opacity: Math.min(1, opacity),
      filter: `brightness(${brightness})`,
      transition: isAnimating.value ? 'opacity 0.2s ease-out, filter 0.2s ease-out' : 'none',
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
