import type { Ref } from 'vue'
import { nextTick, readonly, ref } from 'vue'

export const MAP_MIN_HEIGHT = 500
export const MAP_ASPECT_RATIO = 2.05 // подстройка под Natural Earth (~2:1)

export function useMapSize(
  wrapperRef: Ref<HTMLDivElement | null>,
  canvasRef: Ref<HTMLCanvasElement | null>,
  isFullscreen: Ref<boolean>,
  onResize: (w: number, h: number) => void,
) {
  const cssW = ref(0)
  const cssH = ref(0)
  let ro: ResizeObserver | null = null

  function apply(): void {
    const canvas = canvasRef.value
    const wrapper = wrapperRef.value
    if (!canvas || !wrapper)
      return

    const dpr = window.devicePixelRatio || 1
    const h = isFullscreen.value ? window.innerHeight : MAP_MIN_HEIGHT
    const w = isFullscreen.value ? window.innerWidth : Math.round(h * MAP_ASPECT_RATIO)

    if (w === cssW.value && h === cssH.value)
      return

    cssW.value = w
    cssH.value = h

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    onResize(w, h)
  }

  function centerScroll(): void {
    nextTick(() => {
      const wrapper = wrapperRef.value
      if (!wrapper)
        return
      const overflow = wrapper.scrollWidth - wrapper.clientWidth
      if (overflow > 0)
        wrapper.scrollLeft = overflow / 2
    })
  }

  function observe(): void {
    ro = new ResizeObserver(apply)
    if (wrapperRef.value)
      ro.observe(wrapperRef.value)
  }

  function disconnect(): void {
    ro?.disconnect()
    ro = null
  }

  return {
    cssW: readonly(cssW),
    cssH: readonly(cssH),
    apply,
    centerScroll,
    observe,
    disconnect,
  }
}
