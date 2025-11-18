import type { MaybeRef } from 'vue'
import type { RequestStatus } from '../store/request.store'
import { computed, unref } from 'vue'
import { useRequestStore } from '../store/request.store'

/**
 * Возвращает реактивное computed-свойство, показывающее,
 * находится ли хотя бы одна из операций в указанном статусе.
 *
 * @param keys - Один ключ или массив ключей для проверки.
 * @param status - Статус для проверки ('idle', 'pending', 'success', 'error').
 * @default
 * @returns ComputedRef<boolean>
 */
export function useRequestStatus(
  keys: MaybeRef<string | string[]>,
  status: RequestStatus = 'pending',
) {
  const store = useRequestStore()

  const keysAsArray = computed<string[]>(() => {
    const unwrappedKeys = unref(keys)
    return Array.isArray(unwrappedKeys) ? unwrappedKeys : [unwrappedKeys]
  })

  return computed(() =>
    keysAsArray.value.some(key => store.statuses.get(key) === status),
  )
}
