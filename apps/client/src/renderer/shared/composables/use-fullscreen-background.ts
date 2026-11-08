import type { Ref } from 'vue'
import { nextTick, onBeforeUnmount, watch } from 'vue'

/** Приостанавливает layout/paint основной страницы, пока содержимое телепортировано в body. */
export function useFullscreenBackground(isFullscreen: Ref<boolean>) {
  let restore: (() => void) | undefined

  watch(isFullscreen, (active) => {
    if (!active) {
      restore?.()
      restore = undefined

      return
    }

    const root = document.getElementById('app')

    if (!root || restore)
      return

    const { width, height } = root.getBoundingClientRect()
    const previousVisibility = root.style.contentVisibility
    const previousSize = root.style.containIntrinsicSize
    const previousOverflow = document.body.style.overflow
    const previousInert = root.inert
    const { scrollX, scrollY } = window

    // Сохраняем размер страницы, чтобы её прокрутка не схлопывалась за оверлеем.
    root.style.containIntrinsicSize = `${width}px ${height}px`
    root.style.contentVisibility = 'hidden'
    root.inert = true
    document.body.style.overflow = 'hidden'

    restore = () => {
      root.style.contentVisibility = previousVisibility
      root.style.containIntrinsicSize = previousSize
      root.inert = previousInert
      document.body.style.overflow = previousOverflow
      void nextTick(() => {
        if (!isFullscreen.value)
          window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' })
      })
    }
  })

  onBeforeUnmount(() => {
    restore?.()
    restore = undefined
  })
}
