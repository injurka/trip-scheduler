import type { MaybeRef } from 'vue'
import type { RequestStatus } from '../store/request.store'
import { useRequestStore } from '../store/request.store'

/**
 * Возвращает реактивное computed-свойство, показывающее,
 * находится ли хотя бы одна из операций, ключ которой начинается с заданного префикса,
 * в указанном статусе.
 *
 * @param prefix - Префикс ключа для поиска.
 * @param status - Статус для проверки ('idle', 'pending', 'success', 'error').
 * @returns ComputedRef<boolean>
 */
export function useRequestStatusByPrefix(
  prefix: MaybeRef<string>,
  status: RequestStatus = 'pending',
) {
  const store = useRequestStore()
  const unwrappedPrefix = computed(() => unref(prefix))

  return computed(() => {
    for (const [key, value] of store.statuses.entries()) {
      if (key.startsWith(unwrappedPrefix.value) && value === status) {
        return true
      }
    }
    return false
  })
}
