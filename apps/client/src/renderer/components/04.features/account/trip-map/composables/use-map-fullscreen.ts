import { reactive, ref } from 'vue'

export interface MapTransform {
  scale: number
  tx: number
  ty: number
}

const MIN_SCALE = 1
const MAX_SCALE = 10

export function clampMapTransform(scale: number, tx: number, ty: number, w: number, h: number) {
  const maxTx = Math.max(0, (scale - 1) * w / 2)
  const maxTy = Math.max(0, (scale - 1) * h / 2)
  return {
    tx: Math.max(-maxTx, Math.min(maxTx, tx)),
    ty: Math.max(-maxTy, Math.min(maxTy, ty)),
  }
}

/**
 * Управляет fullscreen-режимом и трансформацией карты (zoom / pan).
 * Не занимается отрисовкой — только изменяет состояние.
 * Поддерживает мышь (drag & scroll) и Touch (pan & pinch-zoom).
 */
export function useMapFullscreen() {
  const isFullscreen = ref(false)
  const mapT = reactive<MapTransform>({ scale: 1, tx: 0, ty: 0 })
  const isDragging = ref(false)

  let dragOrigin = { x: 0, y: 0, tx: 0, ty: 0 }

  // Touch pinch-zoom состояние
  let initialPinchDist = 0
  let initialPinchScale = 1
  let lastTouchCenter = { x: 0, y: 0 }

  function reset(): void {
    Object.assign(mapT, { scale: 1, tx: 0, ty: 0 })
  }

  async function toggle(el: HTMLElement): Promise<void> {
    try {
      document.fullscreenElement
        ? await document.exitFullscreen()
        : await el.requestFullscreen()
    }
    catch { }
  }

  function onFsChange(onResize: () => void): void {
    isFullscreen.value = !!document.fullscreenElement
    if (!isFullscreen.value)
      reset()
    onResize()
  }

  function applyWheel(e: WheelEvent, w: number, h: number): void {
    const f = e.deltaY < 0 ? 1.15 : 1 / 1.15
    const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, mapT.scale * f))
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mx = e.clientX - rect.left - w / 2
    const my = e.clientY - rect.top - h / 2
    const r = ns / mapT.scale

    const nextTx = mx - r * (mx - mapT.tx)
    const nextTy = my - r * (my - mapT.ty)

    const clamped = clampMapTransform(ns, nextTx, nextTy, w, h)
    mapT.scale = ns
    mapT.tx = clamped.tx
    mapT.ty = clamped.ty
  }

  function startDrag(e: MouseEvent, panel: Element | null): boolean {
    if (e.button !== 0)
      return false
    if (panel?.contains(e.target as Node))
      return false
    isDragging.value = true
    dragOrigin = { x: e.clientX, y: e.clientY, tx: mapT.tx, ty: mapT.ty }
    return true
  }

  function applyDrag(e: MouseEvent, w: number, h: number): boolean {
    if (!isDragging.value)
      return false
    const nextTx = dragOrigin.tx + e.clientX - dragOrigin.x
    const nextTy = dragOrigin.ty + e.clientY - dragOrigin.y
    const clamped = clampMapTransform(mapT.scale, nextTx, nextTy, w, h)
    mapT.tx = clamped.tx
    mapT.ty = clamped.ty
    return true
  }

  function endDrag(): void {
    isDragging.value = false
  }

  function getTouchDist(t1: Touch, t2: Touch) {
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  function getTouchCenter(t1: Touch, t2: Touch) {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    }
  }

  function startTouch(e: TouchEvent, panel: Element | null): boolean {
    if (panel?.contains(e.target as Node))
      return false

    if (e.touches.length >= 2) {
      isDragging.value = true
      initialPinchDist = getTouchDist(e.touches[0], e.touches[1])
      initialPinchScale = mapT.scale
      lastTouchCenter = getTouchCenter(e.touches[0], e.touches[1])
      return true
    }

    if (e.touches.length === 1) {
      if (isFullscreen.value || mapT.scale > 1) {
        isDragging.value = true
        dragOrigin = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: mapT.tx, ty: mapT.ty }
        return true
      }
    }

    return false
  }

  function applyTouch(e: TouchEvent, w: number, h: number): boolean {
    if (!isDragging.value)
      return false

    if (e.touches.length === 1) {
      const nextTx = dragOrigin.tx + e.touches[0].clientX - dragOrigin.x
      const nextTy = dragOrigin.ty + e.touches[0].clientY - dragOrigin.y
      const clamped = clampMapTransform(mapT.scale, nextTx, nextTy, w, h)
      mapT.tx = clamped.tx
      mapT.ty = clamped.ty
      return true
    }

    if (e.touches.length >= 2) {
      const dist = getTouchDist(e.touches[0], e.touches[1])
      const center = getTouchCenter(e.touches[0], e.touches[1])

      let ns = initialPinchScale * (dist / initialPinchDist)
      ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, ns))

      const r = ns / mapT.scale
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const mx = center.x - rect.left - w / 2
      const my = center.y - rect.top - h / 2

      let nextTx = mapT.tx + (center.x - lastTouchCenter.x)
      let nextTy = mapT.ty + (center.y - lastTouchCenter.y)

      nextTx = mx - r * (mx - nextTx)
      nextTy = my - r * (my - nextTy)

      const clamped = clampMapTransform(ns, nextTx, nextTy, w, h)
      mapT.scale = ns
      mapT.tx = clamped.tx
      mapT.ty = clamped.ty

      lastTouchCenter = center
      return true
    }

    return false
  }

  function endTouch(e: TouchEvent): void {
    if (e.touches.length === 0) {
      isDragging.value = false
    }
    else if (e.touches.length === 1) {
      dragOrigin = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: mapT.tx, ty: mapT.ty }
    }
  }

  return {
    isFullscreen,
    mapT,
    isDragging,
    reset,
    toggle,
    onFsChange,
    applyWheel,
    startDrag,
    applyDrag,
    endDrag,
    startTouch,
    applyTouch,
    endTouch,
  }
}
