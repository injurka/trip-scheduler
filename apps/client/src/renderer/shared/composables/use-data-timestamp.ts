import { useStorage } from '@vueuse/core'

const timestampsMap = useStorage<Record<string, number>>('api-request-timestamps', {})
const lastDataTimestamp = ref<number | null>(null)

export function useDataTimestamp() {
  /**
   * Сохраняет текущее время для указанного ключа запроса (вызывать при успешном ответе сети).
   */
  function touch(key: string) {
    const now = Date.now()
    timestampsMap.value = {
      ...timestampsMap.value,
      [key]: now,
    }
    lastDataTimestamp.value = now
  }

  /**
   * Обновляет глобальное время на основе сохраненного значения ключа (вызывать при ответе из кеша).
   */
  function peek(key: string) {
    const time = timestampsMap.value[key]
    if (time) {
      lastDataTimestamp.value = time
    }
  }

  return {
    touch,
    peek,
    lastDataTimestamp,
  }
}
