import { reactive, ref } from 'vue'

export interface MapTransform {
  scale: number
  tx: number
  ty: number
}

const MIN_SCALE = 1
const MAX_SCALE = 10

/**
 * Управляет fullscreen-режимом и трансформацией карты (zoom / pan).
 * Не занимается отрисовкой — только изменяет состояние.
 * Caller вызывает redraw() самостоятельно после вызовов applyWheel / applyDrag.
 */
export function useMapFullscreen() {
  const isFullscreen = ref(false)
  const mapT = reactive<MapTransform>({ scale: 1, tx: 0, ty: 0 })
  const isDragging = ref(false)

  let dragOrigin = { x: 0, y: 0, tx: 0, ty: 0 }

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

  /**
   * Обновляет scale / tx / ty при событии колеса.
   * Зум происходит к позиции курсора.
   * Caller должен вызвать это до e.preventDefault().
   */
  function applyWheel(e: WheelEvent, w: number, h: number): void {
    const f = e.deltaY < 0 ? 1.15 : 1 / 1.15
    const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, mapT.scale * f))
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mx = e.clientX - rect.left - w / 2
    const my = e.clientY - rect.top - h / 2
    const r = ns / mapT.scale
    mapT.tx = mx - r * (mx - mapT.tx)
    mapT.ty = my - r * (my - mapT.ty)
    mapT.scale = ns
  }

  /** Начинает перетаскивание. Возвращает false, если drag не должен стартовать. */
  function startDrag(e: MouseEvent, panel: Element | null): boolean {
    if (!isFullscreen.value || e.button !== 0)
      return false
    if (panel?.contains(e.target as Node))
      return false
    isDragging.value = true
    dragOrigin = { x: e.clientX, y: e.clientY, tx: mapT.tx, ty: mapT.ty }
    return true
  }

  /** Применяет смещение при перетаскивании. Возвращает true если состояние изменилось. */
  function applyDrag(e: MouseEvent): boolean {
    if (!isDragging.value)
      return false
    mapT.tx = dragOrigin.tx + e.clientX - dragOrigin.x
    mapT.ty = dragOrigin.ty + e.clientY - dragOrigin.y
    return true
  }

  function endDrag(): void {
    isDragging.value = false
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
  }
}
