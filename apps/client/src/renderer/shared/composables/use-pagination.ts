import type { MaybeRefOrGetter, Ref } from 'vue'

export interface UsePaginationReturn<T> {
  visibleItems: Readonly<Ref<T[]>>
  hasMore: Readonly<Ref<boolean>>
  loadMore: () => void
  reset: () => void
}

export function usePagination<T>(
  items: MaybeRefOrGetter<T[]>,
  batchSize: number = 20,
): UsePaginationReturn<T> {
  const visibleCount = ref(batchSize)

  const visibleItems = computed(() =>
    toValue(items).slice(0, visibleCount.value),
  )

  const hasMore = computed(() =>
    visibleCount.value < toValue(items).length,
  )

  function loadMore() {
    if (hasMore.value)
      visibleCount.value += batchSize
  }

  function reset() {
    visibleCount.value = batchSize
  }

  watch(
    () => toValue(items),
    () => {
      reset()
    },
  )

  return { visibleItems, hasMore, loadMore, reset }
}
