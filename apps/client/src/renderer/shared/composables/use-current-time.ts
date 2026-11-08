import { onMounted, onUnmounted, ref } from 'vue'

/** Обновляет часы также после возврата из фонового режима телефона. */
export function useCurrentTime() {
  const now = ref(new Date())
  let timer: ReturnType<typeof setInterval> | undefined
  const refresh = () => {
    now.value = new Date()
  }

  onMounted(() => {
    refresh()
    timer = setInterval(refresh, 15_000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
  })
  onUnmounted(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', refresh)
    window.removeEventListener('focus', refresh)
  })

  return now
}
