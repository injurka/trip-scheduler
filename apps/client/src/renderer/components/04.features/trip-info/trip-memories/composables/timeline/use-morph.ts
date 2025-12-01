import type { CSSProperties, Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { nextTick, ref } from 'vue'

interface UseMorphReturn {
  isMorphed: Ref<boolean>
  isMorphing: Ref<boolean>
  morphStyle: Ref<CSSProperties>
  placeholderStyle: Ref<CSSProperties>
  enterMorph: () => Promise<void>
  leaveMorph: () => void
}

export function useMorph(targetRef: Ref<HTMLElement | null>): UseMorphReturn {
  const isMorphed = ref(false)
  const isMorphing = ref(false)
  const morphStyle = ref<CSSProperties>({})
  const placeholderStyle = ref<CSSProperties>({})

  let initialRect: DOMRect | null = null

  const reset = () => {
    isMorphed.value = false
    isMorphing.value = false
    morphStyle.value = {}
    placeholderStyle.value = {}
    initialRect = null
    document.body.style.overflow = ''
  }

  const enterMorph = async () => {
    const el = targetRef.value
    if (!el || isMorphed.value || isMorphing.value)
      return

    isMorphing.value = true

    // 1. Запоминаем начальную позицию элемента в потоке
    initialRect = el.getBoundingClientRect()

    // 2. Создаем плейсхолдер, чтобы верстка не "схлопнулась"
    placeholderStyle.value = {
      width: `${initialRect.width}px`,
      height: `${initialRect.height}px`,
    }

    // 3. Сразу ставим элемент в position: fixed, но РОВНО на то же место, где он был.
    // Важно: transition: none, чтобы он мгновенно встал на место.
    morphStyle.value = {
      position: 'fixed',
      top: `${initialRect.top}px`,
      left: `${initialRect.left}px`,
      width: `${initialRect.width}px`,
      height: `${initialRect.height}px`,
      transform: 'translate(0, 0)',
      zIndex: '1000',
      transition: 'none',
      borderRadius: getComputedStyle(el).borderRadius,
    }

    isMorphed.value = true
    document.body.style.overflow = 'hidden'

    // 4. Ждем, пока Vue применит стили в DOM (Critical Step!)
    await nextTick()

    // 5. Форсируем перерисовку браузера (Force Reflow), чтобы он "осознал" начальное положение

    // eslint-disable-next-line ts/no-unused-expressions
    el.offsetHeight

    // 6. Запускаем анимацию в следующем кадре
    requestAnimationFrame(() => {
      if (!initialRect)
        return

      const aspectRatio = initialRect.height / initialRect.width
      const maxWidth = Math.min(window.innerWidth * 0.9, 1000)
      const maxHeight = window.innerHeight * 0.9

      let targetWidth = maxWidth
      let targetHeight = targetWidth * aspectRatio

      // Если высота не влезает, считаем по высоте
      if (targetHeight > maxHeight) {
        targetHeight = maxHeight
        targetWidth = targetHeight / aspectRatio
      }

      morphStyle.value = {
        ...morphStyle.value,
        top: '50%',
        left: '50%',
        width: `${targetWidth}px`,
        height: `${targetHeight}px`,
        transform: 'translate(-50%, -50%)',
        transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        zIndex: '1000',
      }

      setTimeout(() => {
        isMorphing.value = false
      }, 400)
    })
  }

  const leaveMorph = () => {
    if (!initialRect) {
      reset()
      return
    }

    isMorphing.value = true

    // Анимируем обратно к начальным координатам
    morphStyle.value = {
      ...morphStyle.value,
      top: `${initialRect.top}px`,
      left: `${initialRect.left}px`,
      width: `${initialRect.width}px`,
      height: `${initialRect.height}px`,
      transform: 'translate(0, 0)',
      boxShadow: 'none',
    }

    // Слушаем окончание анимации
    const onTransitionEnd = () => {
      targetRef.value?.removeEventListener('transitionend', onTransitionEnd)
      reset()
    }

    const fallback = setTimeout(onTransitionEnd, 400)

    targetRef.value?.addEventListener('transitionend', () => {
      clearTimeout(fallback)
      onTransitionEnd()
    }, { once: true })
  }

  // Закрытие по ESC
  useEventListener(document, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isMorphed.value)
      leaveMorph()
  })

  return {
    isMorphed,
    isMorphing,
    morphStyle,
    placeholderStyle,
    enterMorph,
    leaveMorph,
  }
}
