import { useStorage } from '@vueuse/core'

// Ключ, под которым объект с каунтерами будет храниться в localStorage
const LAST_COUNTS_KEY = 'last-counts'

// Типизация для объекта, который мы храним.
// Это объект, где ключ - строка (например, 'files', 'folders'), а значение - число.
type LastCountsState = Record<string, number>

/**
 * Глобальное состояние, обернутое в useStorage.
 * Оно будет автоматически синхронизироваться с localStorage.
 * Начальное значение - пустой объект.
 */
const lastCounts = useStorage<LastCountsState>(LAST_COUNTS_KEY, {})

/**
 * Composable для управления последними известными количествами элементов.
 * Позволяет сохранять и извлекать количество элементов для разных сущностей (файлы, папки и т.д.).
 * Данные сохраняются в localStorage между сессиями.
 */
export function useLastCounts() {
  /**
   * Устанавливает (сохраняет) последнее известное количество для указанного ключа.
   * @param key - Идентификатор сущности (например, 'files', 'trips').
   * @param count - Новое количество.
   */
  function setCount(key: string, count: number) {
    if (typeof count !== 'number' || Number.isNaN(count)) {
      console.warn(`[useLastCounts] Неверное значение для ключа "${key}". Ожидалось число.`)
      return
    }
    // Обновляем объект, сохраняя предыдущие значения для других ключей
    lastCounts.value = {
      ...lastCounts.value,
      [key]: count,
    }
  }

  /**
   * Возвращает *реактивное* (computed) количество для указанного ключа.
   * @param key - Идентификатор сущности.
   * @param defaultValue - Значение по умолчанию, если для ключа ничего не сохранено.
   * @returns ComputedRef<number>
   */
  function getComputedCount(key: string, defaultValue: number = 0) {
    return computed(() => {
      const storedValue = lastCounts.value[key]
      // Проверяем, что значение является числом
      if (typeof storedValue === 'number' && !Number.isNaN(storedValue)) {
        return storedValue
      }
      return defaultValue
    })
  }

  /**
   * Возвращает *нереактивное* (обычное число) количество для указанного ключа.
   * Полезно, когда не требуется отслеживание изменений.
   * @param key - Идентификатор сущности.
   * @param defaultValue - Значение по умолчанию.
   * @returns number
   */
  function getCount(key: string, defaultValue: number = 0): number {
    const storedValue = lastCounts.value[key]

    if (typeof storedValue === 'number' && !Number.isNaN(storedValue) && storedValue > 0) {
      return storedValue
    }

    return defaultValue
  }

  return {
    /**
     * Реактивный ref на весь объект с каунтерами.
     * Может быть полезен для отладки или сложных сценариев.
     */
    counts: lastCounts,
    setCount,
    getComputedCount,
    getCount,
  }
}
