import { ref } from 'vue'

const STORAGE_KEY = 'api-request-timestamps'
const MAX_TIMESTAMPS = 200

function trimTimestamps(map: Record<string, number>, maxEntries = MAX_TIMESTAMPS): Record<string, number> {
  const entries = Object.entries(map)

  if (entries.length <= maxEntries)
    return map

  entries.sort((a, b) => b[1] - a[1])

  return Object.fromEntries(entries.slice(0, maxEntries))
}

function loadTimestamps(): Record<string, number> {
  if (typeof localStorage === 'undefined')
    return {}

  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw)
      return {}

    const parsed = JSON.parse(raw)

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      return trimTimestamps(parsed as Record<string, number>)
  }
  catch {
    // Игнорируем некорректные или недоступные данные localStorage
  }

  return {}
}

function persistTimestamps(map: Record<string, number>) {
  if (typeof localStorage === 'undefined')
    return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  }
  catch (e) {
    console.warn('[useDataTimestamp] Ошибка сохранения меток времени в localStorage:', e)
  }
}

const timestampsMap = ref<Record<string, number>>(loadTimestamps())
const lastDataTimestamp = ref<number | null>(null)

export function useDataTimestamp() {
  /**
   * Сохраняет текущее время для указанного ключа запроса (вызывать при успешном ответе сети).
   */
  function touch(key: string) {
    const now = Date.now()
    const next = trimTimestamps({
      ...loadTimestamps(),
      ...timestampsMap.value,
      [key]: now,
    })
    timestampsMap.value = next
    lastDataTimestamp.value = now
    persistTimestamps(next)
  }

  /**
   * Обновляет глобальное время на основе сохраненного значения ключа (вызывать при ответе из кеша).
   */
  function peek(key: string) {
    const current = {
      ...loadTimestamps(),
      ...timestampsMap.value,
    }
    timestampsMap.value = current
    const time = current[key]

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
