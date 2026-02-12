import type { Ref } from 'vue'
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { Memory } from '~/shared/types/models/memory'
import { computed, ref, watch } from 'vue'
import { memoryToViewerImage } from '~/components/05.modules/trip-info/lib/helpers'
import { formatDate } from '~/shared/lib/date-time'

export interface GroupedMemory {
  date: string
  title: string
  items: Memory[]
}

export type SortType = 'date-desc' | 'date-asc' | 'rating-desc' | 'rating-asc'

export function useMemoriesView(memories: Ref<Memory[]>) {
  const sortType = ref<SortType>('date-asc')
  const filterDay = ref<string>('all')
  const filterRating = ref<number>(0)
  const renderLimit = ref(50)
  const BATCH_SIZE = 50

  const sortOptions = [
    { value: 'date-asc', label: 'Сначала старые', icon: 'mdi:sort-calendar-ascending' },
    { value: 'date-desc', label: 'Сначала новые', icon: 'mdi:sort-calendar-descending' },
    { value: 'rating-desc', label: 'Сначала высокий рейтинг', icon: 'mdi:star' },
    { value: 'rating-asc', label: 'Сначала низкий рейтинг', icon: 'mdi:star-outline' },
  ]

  const availableDays = computed(() => {
    const days = new Set<string>()
    memories.value.forEach((m) => {
      if (m.timestamp)
        days.add(m.timestamp.split('T')[0])
    })
    const sortedDays = Array.from(days).sort()
    const options = sortedDays.map(date => ({
      value: date,
      label: formatDate(date, { day: 'numeric', month: 'long' }),
    }))
    return [{ value: 'all', label: 'Все дни' }, ...options]
  })

  const allFilteredMemories = computed(() => {
    let result = [...memories.value].filter(m => !!m.imageId)

    if (filterDay.value !== 'all') {
      result = result.filter(m => m.timestamp && m.timestamp.startsWith(filterDay.value))
    }

    if (filterRating.value > 0) {
      result = result.filter(m => (m.rating || 0) >= filterRating.value)
    }

    result.sort((a, b) => {
      if (sortType.value.startsWith('date')) {
        const timeA = new Date(a.timestamp || 0).getTime()
        const timeB = new Date(b.timestamp || 0).getTime()
        return sortType.value === 'date-asc' ? timeA - timeB : timeB - timeA
      }

      if (sortType.value.startsWith('rating')) {
        const ratingA = a.rating || 0
        const ratingB = b.rating || 0

        if (ratingA === ratingB) {
          const timeA = new Date(a.timestamp || 0).getTime()
          const timeB = new Date(b.timestamp || 0).getTime()
          return timeB - timeA
        }

        return sortType.value === 'rating-desc' ? ratingB - ratingA : ratingA - ratingB
      }

      return 0
    })

    return result
  })

  const visibleMemories = computed(() => {
    return allFilteredMemories.value.slice(0, renderLimit.value)
  })

  const hasMore = computed(() => {
    return renderLimit.value < allFilteredMemories.value.length
  })

  const groupedMemories = computed<GroupedMemory[]>(() => {
    const groups: Record<string, Memory[]> = {}

    visibleMemories.value.forEach((memory) => {
      const dateKey = memory.timestamp ? memory.timestamp.split('T')[0] : 'no-date'
      if (!groups[dateKey])
        groups[dateKey] = []
      groups[dateKey].push(memory)
    })

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'no-date')
        return 1
      if (b === 'no-date')
        return -1

      const timeA = new Date(a).getTime()
      const timeB = new Date(b).getTime()

      return sortType.value === 'date-asc'
        ? timeA - timeB
        : timeB - timeA
    })

    return sortedKeys.map(date => ({
      date,
      title: date === 'no-date' ? 'Без даты' : formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' }),
      items: groups[date],
    }))
  })

  const viewerImages = computed<ImageViewerImage[]>(() => {
    return allFilteredMemories.value
      .map(memoryToViewerImage)
      .filter((img): img is ImageViewerImage => !!img)
  })

  function loadMore() {
    if (hasMore.value) {
      renderLimit.value += BATCH_SIZE
    }
  }

  watch([filterDay, sortType, filterRating], () => {
    renderLimit.value = BATCH_SIZE
    setTimeout(() => {
      document.querySelector('.memories-section')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  })

  return {
    sortType,
    filterDay,
    filterRating,
    availableDays,
    sortOptions,
    groupedMemories,
    viewerImages,
    allFilteredMemories,
    renderLimit,
    hasMore,
    loadMore,
  }
}
