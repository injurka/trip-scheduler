import type { MaybeRef } from 'vue'
import { computed, unref } from 'vue'
import { useRequestStore } from '../store/request.store'

/**
 * Возвращает первую найденную ошибку для указанных ключей.
 *
 * @param keys - Один ключ или массив ключей.
 * @returns Computed-свойство с ошибкой или null.
 */
export function useRequestError(keys: MaybeRef<string | string[]>) {
  const store = useRequestStore()

  const keysAsArray = computed<string[]>(() => {
    const unwrappedKeys = unref(keys)
    return Array.isArray(unwrappedKeys) ? unwrappedKeys : [unwrappedKeys]
  })

  return computed(() => {
    for (const key of keysAsArray.value) {
      const error = store.errors.get(key)
      if (error) {
        return error
      }
    }
    return null
  })
}
