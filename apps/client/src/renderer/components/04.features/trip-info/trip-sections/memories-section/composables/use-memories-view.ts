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

export function useMemoriesView(memories: Ref<Memory[]>) {
  const sortOrder = ref<'asc' | 'desc'>('desc')
  const filterDay = ref<string>('all')
  const renderLimit = ref(50)
  const BATCH_SIZE = 50

  // Опции для фильтров
  const sortOptions = [
    { value: 'desc', label: 'Сначала новые', icon: 'mdi:sort-calendar-descending' },
    { value: 'asc', label: 'Сначала старые', icon: 'mdi:sort-calendar-ascending' },
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

  // Полный отфильтрованный и отсортированный список (для Viewer'а и подсчетов)
  const allFilteredMemories = computed(() => {
    let result = [...memories.value].filter(m => !!m.imageId)

    if (filterDay.value !== 'all') {
      result = result.filter(m => m.timestamp && m.timestamp.startsWith(filterDay.value))
    }

    result.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime()
      const timeB = new Date(b.timestamp || 0).getTime()
      return sortOrder.value === 'asc' ? timeA - timeB : timeB - timeA
    })

    return result
  })

  // Урезанный список для рендера в DOM (Infinite Scroll)
  const visibleMemories = computed(() => {
    return allFilteredMemories.value.slice(0, renderLimit.value)
  })

  // Группировка видимых элементов
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
      return sortOrder.value === 'asc'
        ? new Date(a).getTime() - new Date(b).getTime()
        : new Date(b).getTime() - new Date(a).getTime()
    })

    return sortedKeys.map(date => ({
      date,
      title: date === 'no-date' ? 'Без даты' : formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' }),
      items: groups[date],
    }))
  })

  // Список картинок для вьювера (всегда полный список!)
  const viewerImages = computed<ImageViewerImage[]>(() => {
    return allFilteredMemories.value
      .map(memoryToViewerImage)
      .filter((img): img is ImageViewerImage => !!img)
  })

  function loadMore() {
    if (renderLimit.value < allFilteredMemories.value.length) {
      renderLimit.value += BATCH_SIZE
    }
  }

  // Сброс лимита при смене фильтров
  watch([filterDay, sortOrder], () => {
    renderLimit.value = BATCH_SIZE
    document.querySelector('.memories-section')?.scrollIntoView({ behavior: 'smooth' })
  })

  return {
    sortOrder,
    filterDay,
    availableDays,
    sortOptions,
    groupedMemories, // Для рендера групп
    viewerImages, // Для Image Viewer
    allFilteredMemories, // Для поиска индекса
    renderLimit,
    loadMore,
  }
}
