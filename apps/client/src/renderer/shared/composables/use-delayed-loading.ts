import type { Ref } from 'vue'
import { onUnmounted, ref, watch } from 'vue'

/**
 * Возвращает реактивный флаг загрузки, который становится true только если исходный isLoading
 * остается истинным дольше указанного времени (delayMs, по умолчанию 250мс).
 * Скрывается (становится false) мгновенно, предотвращая мерцание спиннеров/скелетонов на быстрых ответах.
 */
export function useDelayedLoading(isLoading: Ref<boolean> | (() => boolean), delayMs = 250) {
  const isDelayedLoading = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  const stopWatch = watch(
    isLoading,
    (loading) => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }

      if (loading) {
        timer = setTimeout(() => {
          isDelayedLoading.value = true
        }, delayMs)
      }
      else {
        isDelayedLoading.value = false
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    if (timer) {
      clearTimeout(timer)
    }

    stopWatch()
  })

  return isDelayedLoading
}
