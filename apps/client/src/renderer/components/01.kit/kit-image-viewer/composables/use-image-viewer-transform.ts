// composables/use-image-viewer-transform.ts

import type { MaybeRefOrGetter, Ref } from 'vue'
import type { TouchPoint, ViewerBounds, ViewerTransform } from '../models/types'

interface UseImageViewerTransformOptions {
  imageRef: Ref<HTMLImageElement | null>
  containerRef: Ref<HTMLElement | null>
  naturalSize: { width: number, height: number }
  minZoom: MaybeRefOrGetter<number>
  maxZoom: MaybeRefOrGetter<number>
  zoomStep: MaybeRefOrGetter<number>
  enableTouch: MaybeRefOrGetter<boolean>
  animationDuration: MaybeRefOrGetter<number>
}

export function useImageViewerTransform(options: UseImageViewerTransformOptions) {
  const {
    imageRef,
    containerRef,
    minZoom,
    maxZoom,
    zoomStep,
    enableTouch,
    animationDuration,
  } = options

  // --- Состояние трансформации ---
  const transform = reactive<ViewerTransform>({ scale: 1, x: 0, y: 0 })
  const isDragging = ref(false)
  const isAnimating = ref(false)
  const isGesturing = ref(false) // Объединяет wheel и pinch
  let gestureTimeoutId: number | undefined

  const dragStart = reactive<TouchPoint>({ x: 0, y: 0 })
  const transformStart = reactive<ViewerTransform>({ scale: 1, x: 0, y: 0 })

  // Состояние для жеста pinch-to-zoom
  const touches = ref<TouchPoint[]>([])
  const initialDistance = ref(0)
  const initialScale = ref(1)
  const pinchStartCenter = reactive<TouchPoint>({ x: 0, y: 0 })

  // --- Вычисляемые свойства ---
  const imageStyle = computed(() => ({
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
    transition: (isAnimating.value && !isDragging.value && !isGesturing.value)
      ? `transform ${toValue(animationDuration)}ms cubic-bezier(0.4, 0.0, 0.2, 1)`
      : 'none',
    cursor: getCursor(),
  }))

  const canZoomIn = computed(() => transform.scale < toValue(maxZoom))
  const canZoomOut = computed(() => transform.scale > toValue(minZoom))

  function getCursor(): string {
    if (isDragging.value)
      return 'grabbing'
    if (transform.scale > toValue(minZoom))
      return 'grab'
    return 'zoom-in'
  }

  // --- Функции трансформации ---
  function resetTransform() {
    isAnimating.value = true
    transform.scale = toValue(minZoom)
    transform.x = 0
    transform.y = 0
    setTimeout(() => {
      isAnimating.value = false
    }, toValue(animationDuration))
  }

  function calculateBounds(): ViewerBounds {
    if (!imageRef.value || !containerRef.value)
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 }

    const containerRect = containerRef.value.getBoundingClientRect()
    // Важно использовать размеры реального отображаемого изображения, а не naturalSize
    const imageRect = imageRef.value.getBoundingClientRect()
    const scaledWidth = imageRect.width
    const scaledHeight = imageRect.height

    const maxX = Math.max(0, (scaledWidth - containerRect.width) / 2)
    const maxY = Math.max(0, (scaledHeight - containerRect.height) / 2)

    return { minX: -maxX, maxX, minY: -maxY, maxY }
  }

  function constrainTransform() {
    const bounds = calculateBounds()
    transform.x = Math.max(bounds.minX, Math.min(bounds.maxX, transform.x))
    transform.y = Math.max(bounds.minY, Math.min(bounds.maxY, transform.y))
  }

  /**
   * Основа новой логики: анимированное масштабирование к определенной точке на экране.
   * @param newScale - Новый масштаб.
   * @param origin - Точка на экране (viewport coordinates), к которой происходит масштабирование. По умолчанию - центр контейнера.
   */
  function zoomTo(newScale: number, origin: { x: number, y: number } | null = null) {
    if (!containerRef.value)
      return

    const clampedScale = Math.max(toValue(minZoom), Math.min(toValue(maxZoom), newScale))

    if (clampedScale <= toValue(minZoom)) {
      resetTransform()
      return
    }

    // Если масштаб не изменился, ничего не делаем
    if (clampedScale === transform.scale)
      return

    const containerRect = containerRef.value.getBoundingClientRect()
    const S_old = transform.scale
    const T_old = { x: transform.x, y: transform.y }

    const zoomOrigin = origin || {
      x: containerRect.left + containerRect.width / 2,
      y: containerRect.top + containerRect.height / 2,
    }

    // 1. Находим позицию точки зума относительно центра контейнера
    const mouseRelContainerCenter = {
      x: zoomOrigin.x - (containerRect.left + containerRect.width / 2),
      y: zoomOrigin.y - (containerRect.top + containerRect.height / 2),
    }

    const scaleRatio = clampedScale / S_old

    // 2. Вычисляем новый сдвиг, чтобы точка под курсором осталась на месте
    const T_new_x = mouseRelContainerCenter.x - (mouseRelContainerCenter.x - T_old.x) * scaleRatio
    const T_new_y = mouseRelContainerCenter.y - (mouseRelContainerCenter.y - T_old.y) * scaleRatio

    isAnimating.value = true
    transform.scale = clampedScale
    transform.x = T_new_x
    transform.y = T_new_y

    nextTick(() => {
      constrainTransform()
      setTimeout(() => {
        isAnimating.value = false
      }, toValue(animationDuration))
    })
  }

  function zoomIn() {
    const newScale = transform.scale + toValue(zoomStep)
    zoomTo(newScale) // Масштабируем к центру
  }

  function zoomOut() {
    const newScale = transform.scale - toValue(zoomStep)
    zoomTo(newScale) // Масштабируем к центру
  }

  // --- Обработчики событий ---
  function handleDoubleClick(event: MouseEvent) {
    event.preventDefault()
    if (transform.scale > toValue(minZoom))
      resetTransform()
    else
      zoomTo(2, { x: event.clientX, y: event.clientY })
  }

  function handleWheel(event: WheelEvent) {
    event.preventDefault()
    if (!containerRef.value)
      return

    if (gestureTimeoutId)
      clearTimeout(gestureTimeoutId)

    isGesturing.value = true
    isAnimating.value = false

    const S_old = transform.scale
    const zoomFactor = 1.15
    const newScale = event.deltaY < 0 ? S_old * zoomFactor : S_old / zoomFactor
    const clampedScale = Math.max(toValue(minZoom), Math.min(toValue(maxZoom), newScale))

    if (clampedScale === S_old) {
      isGesturing.value = false
      return
    }
    if (clampedScale <= toValue(minZoom)) {
      resetTransform()
      isGesturing.value = false
      return
    }

    const containerRect = containerRef.value.getBoundingClientRect()
    const T_old = { x: transform.x, y: transform.y }
    const zoomOrigin = { x: event.clientX, y: event.clientY }
    const mouseRelContainerCenter = {
      x: zoomOrigin.x - (containerRect.left + containerRect.width / 2),
      y: zoomOrigin.y - (containerRect.top + containerRect.height / 2),
    }
    const scaleRatio = clampedScale / S_old

    transform.x = mouseRelContainerCenter.x - (mouseRelContainerCenter.x - T_old.x) * scaleRatio
    transform.y = mouseRelContainerCenter.y - (mouseRelContainerCenter.y - T_old.y) * scaleRatio
    transform.scale = clampedScale

    constrainTransform()

    gestureTimeoutId = window.setTimeout(() => {
      isGesturing.value = false
      isAnimating.value = true
      constrainTransform()
    }, 150)
  }

  function handleMouseDown(event: MouseEvent) {
    if (transform.scale <= toValue(minZoom))
      return

    event.preventDefault()
    isDragging.value = true
    isAnimating.value = false
    dragStart.x = event.clientX
    dragStart.y = event.clientY
    transformStart.x = transform.x
    transformStart.y = transform.y
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp, { once: true })
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isDragging.value)
      return

    const deltaX = event.clientX - dragStart.x
    const deltaY = event.clientY - dragStart.y
    transform.x = transformStart.x + deltaX
    transform.y = transformStart.y + deltaY
  }

  function handleMouseUp() {
    isDragging.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    if (!isGesturing.value)
      isAnimating.value = true

    constrainTransform()
  }

  function getTouchPoints(event: TouchEvent): TouchPoint[] {
    return Array.from(event.touches).map(touch => ({ x: touch.clientX, y: touch.clientY }))
  }

  function getDistance(point1: TouchPoint, point2: TouchPoint): number {
    const dx = point1.x - point2.x
    const dy = point1.y - point2.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  function getCenter(point1: TouchPoint, point2: TouchPoint): TouchPoint {
    return { x: (point1.x + point2.x) / 2, y: (point1.y + point2.y) / 2 }
  }

  function handleTouchStart(event: TouchEvent) {
    if (!toValue(enableTouch))
      return
    const target = event.target as HTMLElement
    if (target.closest('button'))
      return

    isAnimating.value = false
    touches.value = getTouchPoints(event)

    if (touches.value.length === 1) {
      if (transform.scale > toValue(minZoom)) {
        isDragging.value = true
        dragStart.x = touches.value[0].x
        dragStart.y = touches.value[0].y
        transformStart.x = transform.x
        transformStart.y = transform.y
      }
    }
    else if (touches.value.length === 2) {
      isDragging.value = false
      isGesturing.value = true
      initialDistance.value = getDistance(touches.value[0], touches.value[1])
      initialScale.value = transform.scale
      transformStart.x = transform.x
      transformStart.y = transform.y
      const center = getCenter(touches.value[0], touches.value[1])
      pinchStartCenter.x = center.x
      pinchStartCenter.y = center.y
    }
  }

  function handleTouchMove(event: TouchEvent) {
    if (!toValue(enableTouch))
      return
    if (!isDragging.value && touches.value.length < 2)
      return

    const currentTouches = getTouchPoints(event)

    if (isDragging.value && currentTouches.length === 1 && touches.value.length === 1) {
      if (transform.scale > toValue(minZoom)) {
        const deltaX = currentTouches[0].x - dragStart.x
        const deltaY = currentTouches[0].y - dragStart.y
        transform.x = transformStart.x + deltaX
        transform.y = transformStart.y + deltaY
      }
    }
    else if (currentTouches.length >= 2) {
      if (!containerRef.value)
        return

      // --- Новая логика Pinch-to-Zoom ---
      // 1. Вычисляем новый масштаб
      const currentDistance = getDistance(currentTouches[0], currentTouches[1])
      const scaleRatioFromStart = currentDistance / initialDistance.value
      const newScale = initialScale.value * scaleRatioFromStart
      const clampedScale = Math.max(toValue(minZoom), Math.min(toValue(maxZoom), newScale))

      // 2. Вычисляем новый сдвиг, учитывая смещение центра жеста
      const S_start = initialScale.value
      const T_start = { x: transformStart.x, y: transformStart.y }
      const containerRect = containerRef.value.getBoundingClientRect()

      // 2.1 Находим точку на изображении под начальным центром жеста
      const startCenterRelContainer = {
        x: pinchStartCenter.x - (containerRect.left + containerRect.width / 2),
        y: pinchStartCenter.y - (containerRect.top + containerRect.height / 2),
      }
      const imgPoint = {
        x: (startCenterRelContainer.x - T_start.x) / S_start,
        y: (startCenterRelContainer.y - T_start.y) / S_start,
      }

      // 2.2 Позиционируем эту точку под текущим центром жеста
      const currentCenter = getCenter(currentTouches[0], currentTouches[1])
      const currentCenterRelContainer = {
        x: currentCenter.x - (containerRect.left + containerRect.width / 2),
        y: currentCenter.y - (containerRect.top + containerRect.height / 2),
      }

      transform.scale = clampedScale
      transform.x = currentCenterRelContainer.x - imgPoint.x * clampedScale
      transform.y = currentCenterRelContainer.y - imgPoint.y * clampedScale

      constrainTransform()
    }
  }

  function handleTouchEnd(event: TouchEvent) {
    if (!toValue(enableTouch))
      return

    isAnimating.value = true
    isGesturing.value = false
    constrainTransform()
    const remainingTouches = event.touches.length

    if (remainingTouches === 0) {
      isDragging.value = false
      touches.value = []
    }
    else if (remainingTouches === 1 && touches.value.length > 1) {
      // Переключаемся с pinch на drag
      isDragging.value = true
      dragStart.x = event.touches[0].clientX
      dragStart.y = event.touches[0].clientY
      transformStart.x = transform.x
      transformStart.y = transform.y
      touches.value = getTouchPoints(event)
    }
    else {
      touches.value = getTouchPoints(event)
    }
  }

  tryOnUnmounted(() => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  })

  return {
    transform,
    isDragging,
    imageStyle,
    canZoomIn,
    canZoomOut,
    handleDoubleClick,
    handleWheel,
    handleMouseDown,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    zoomIn,
    zoomOut,
    resetTransform,
  }
}
