import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useImageViewerSwipe } from '../src/composables/use-image-viewer-swipe'

function createTouchEvent(type: string, touches: Array<{ clientX: number, clientY?: number }>): TouchEvent {
  const touchList = touches.map((t, index) => ({
    identifier: index,
    target: document.body,
    clientX: t.clientX,
    clientY: t.clientY ?? 0,
    pageX: t.clientX,
    pageY: t.clientY ?? 0,
    screenX: t.clientX,
    screenY: t.clientY ?? 0,
    radiusX: 1,
    radiusY: 1,
    rotationAngle: 0,
    force: 1,
  }))
  const event = new Event(type, { bubbles: true, cancelable: true }) as any
  event.touches = touchList
  event.targetTouches = touchList
  event.changedTouches = touchList
  return event as TouchEvent
}

describe('useImageViewerSwipe - multi-touch vs single-touch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const images = ref([
    { url: 'https://example.com/1.jpg' },
    { url: 'https://example.com/2.jpg' },
    { url: 'https://example.com/3.jpg' },
  ])

  it('allows single-finger swipe to next image', () => {
    const onNext = vi.fn()
    const onPrev = vi.fn()
    const currentIndex = ref(0)
    const isZoomed = ref(false)

    const swipe = useImageViewerSwipe({
      onNext,
      onPrev,
      threshold: 50,
      velocity: 0.3,
      images,
      currentIndex,
      isZoomed,
      preferredQuality: ref('large'),
      baseTransform: ref(''),
    })

    // Start with 1 finger at x = 200
    swipe.handleTouchStart(createTouchEvent('touchstart', [{ clientX: 200 }]))

    // Move 1 finger to x = 100 (swipe left by 100px > threshold 50)
    const moveEvent = createTouchEvent('touchmove', [{ clientX: 100 }])
    const preventDefaultSpy = vi.spyOn(moveEvent, 'preventDefault')
    swipe.handleTouchMove(moveEvent)
    expect(preventDefaultSpy).toHaveBeenCalled()

    // End touch (0 fingers remain)
    swipe.handleTouchEnd(createTouchEvent('touchend', []))

    // Animation timeout is 200ms or immediate when flushed
    vi.advanceTimersByTime?.(250)
    expect(onNext).toHaveBeenCalled()
    expect(onPrev).not.toHaveBeenCalled()
  })

  it('does NOT start swipe when two fingers touch the screen simultaneously', () => {
    const onNext = vi.fn()
    const onPrev = vi.fn()
    const currentIndex = ref(0)
    const isZoomed = ref(false)

    const swipe = useImageViewerSwipe({
      onNext,
      onPrev,
      threshold: 50,
      velocity: 0.3,
      images,
      currentIndex,
      isZoomed,
      preferredQuality: ref('large'),
      baseTransform: ref(''),
    })

    // Touch down with two fingers
    const startEvent = createTouchEvent('touchstart', [{ clientX: 200 }, { clientX: 250 }])
    swipe.handleTouchStart(startEvent)

    // Move with two fingers (e.g. pinch or two finger pan)
    const moveEvent = createTouchEvent('touchmove', [{ clientX: 100 }, { clientX: 150 }])
    const preventDefaultSpy = vi.spyOn(moveEvent, 'preventDefault')
    swipe.handleTouchMove(moveEvent)

    // Should NOT prevent default (letting pinch/gestures handle it)
    expect(preventDefaultSpy).not.toHaveBeenCalled()

    // End touch
    swipe.handleTouchEnd(createTouchEvent('touchend', []))

    vi.advanceTimersByTime?.(250)
    expect(onNext).not.toHaveBeenCalled()
    expect(onPrev).not.toHaveBeenCalled()
    expect(swipe.containerStyle.value.transform).toContain('0px')
  })

  it('cancels ongoing swipe when a second finger touches down', () => {
    const onNext = vi.fn()
    const onPrev = vi.fn()
    const currentIndex = ref(0)
    const isZoomed = ref(false)

    const swipe = useImageViewerSwipe({
      onNext,
      onPrev,
      threshold: 50,
      velocity: 0.3,
      images,
      currentIndex,
      isZoomed,
      preferredQuality: ref('large'),
      baseTransform: ref(''),
    })

    // Touch down with 1 finger
    swipe.handleTouchStart(createTouchEvent('touchstart', [{ clientX: 200 }]))

    // Move with 1 finger
    swipe.handleTouchMove(createTouchEvent('touchmove', [{ clientX: 120 }]))

    // Second finger touches down
    swipe.handleTouchStart(createTouchEvent('touchstart', [{ clientX: 120 }, { clientX: 220 }]))

    // Subsequent move with two fingers
    const moveEvent = createTouchEvent('touchmove', [{ clientX: 50 }, { clientX: 150 }])
    const preventDefaultSpy = vi.spyOn(moveEvent, 'preventDefault')
    swipe.handleTouchMove(moveEvent)
    expect(preventDefaultSpy).not.toHaveBeenCalled()

    // End touch
    swipe.handleTouchEnd(createTouchEvent('touchend', []))

    vi.advanceTimersByTime?.(250)
    expect(onNext).not.toHaveBeenCalled()
    expect(onPrev).not.toHaveBeenCalled()
  })

  it('cancels swipe if touchmove detects multiple fingers', () => {
    const onNext = vi.fn()
    const onPrev = vi.fn()
    const currentIndex = ref(0)
    const isZoomed = ref(false)

    const swipe = useImageViewerSwipe({
      onNext,
      onPrev,
      threshold: 50,
      velocity: 0.3,
      images,
      currentIndex,
      isZoomed,
      preferredQuality: ref('large'),
      baseTransform: ref(''),
    })

    // 1 finger touchstart
    swipe.handleTouchStart(createTouchEvent('touchstart', [{ clientX: 200 }]))

    // touchmove with 2 fingers
    const moveEvent = createTouchEvent('touchmove', [{ clientX: 100 }, { clientX: 250 }])
    const preventDefaultSpy = vi.spyOn(moveEvent, 'preventDefault')
    swipe.handleTouchMove(moveEvent)
    expect(preventDefaultSpy).not.toHaveBeenCalled()

    // touchend
    swipe.handleTouchEnd(createTouchEvent('touchend', []))

    vi.advanceTimersByTime?.(250)
    expect(onNext).not.toHaveBeenCalled()
    expect(onPrev).not.toHaveBeenCalled()
  })

  it('does NOT trigger navigation if fingers still remain on the screen at touchend', () => {
    const onNext = vi.fn()
    const onPrev = vi.fn()
    const currentIndex = ref(0)
    const isZoomed = ref(false)

    const swipe = useImageViewerSwipe({
      onNext,
      onPrev,
      threshold: 50,
      velocity: 0.3,
      images,
      currentIndex,
      isZoomed,
      preferredQuality: ref('large'),
      baseTransform: ref(''),
    })

    // 1 finger touchstart & move
    swipe.handleTouchStart(createTouchEvent('touchstart', [{ clientX: 200 }]))
    swipe.handleTouchMove(createTouchEvent('touchmove', [{ clientX: 100 }]))

    // Touchend with 1 finger still on screen
    swipe.handleTouchEnd(createTouchEvent('touchend', [{ clientX: 100 }]))

    vi.advanceTimersByTime?.(250)
    expect(onNext).not.toHaveBeenCalled()
  })

  it('cancels swipe on touchcancel event', () => {
    const onNext = vi.fn()
    const onPrev = vi.fn()
    const currentIndex = ref(0)
    const isZoomed = ref(false)

    const swipe = useImageViewerSwipe({
      onNext,
      onPrev,
      threshold: 50,
      velocity: 0.3,
      images,
      currentIndex,
      isZoomed,
      preferredQuality: ref('large'),
      baseTransform: ref(''),
    })

    // 1 finger touchstart & move
    swipe.handleTouchStart(createTouchEvent('touchstart', [{ clientX: 200 }]))
    swipe.handleTouchMove(createTouchEvent('touchmove', [{ clientX: 100 }]))

    // Cancelled touch
    swipe.handleTouchEnd(createTouchEvent('touchcancel', []))

    vi.advanceTimersByTime?.(250)
    expect(onNext).not.toHaveBeenCalled()
  })
})
