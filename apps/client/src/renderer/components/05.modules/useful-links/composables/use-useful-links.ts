import type { LinkCategory } from '../models/types'
import { computed, ref } from 'vue'
import { linkCategories as allCategories } from '../lib/data'

export function useUsefulLinks() {
  const searchQuery = ref('')
  const sortOrder = ref<'default' | 'alphabetical'>('default')
  const selectedTags = ref<string[]>([])

  // Получаем плоский список всех ссылок, чтобы извлечь уникальные теги
  const allLinks = computed(() => allCategories.flatMap(category => category.links))

  // Создаем набор всех уникальных тегов для фильтрации
  const allTags = computed(() => {
    const tags = new Set<string>()
    for (const link of allLinks.value) {
      if (link.tags) {
        link.tags.forEach(tag => tags.add(tag))
      }
    }
    return Array.from(tags).sort()
  })

  const filteredCategories = computed<LinkCategory[]>(() => {
    const query = searchQuery.value.trim().toLowerCase()
    const result: LinkCategory[] = []

    // 1. Фильтрация по поисковому запросу и тегам
    for (const category of allCategories) {
      // Фильтруем ссылки по поисковому запросу
      const linksBySearch = query
        ? category.links.filter(
            link =>
              link.name.toLowerCase().includes(query)
              || link.description.toLowerCase().includes(query),
          )
        : [...category.links]

      // Фильтруем ссылки по выбранным тегам
      const linksByTags = selectedTags.value.length > 0
        ? linksBySearch.filter(link =>
            selectedTags.value.every(tag => link.tags?.includes(tag)),
          )
        : linksBySearch

      if (linksByTags.length > 0) {
        result.push({ ...category, links: linksByTags })
      }
    }

    // 2. Сортировка ссылок внутри каждой категории
    if (sortOrder.value === 'alphabetical') {
      result.forEach((category) => {
        category.links.sort((a, b) => a.name.localeCompare(b.name))
      })
    }
    // Сортировка по умолчанию (сначала "рекомендованные") уже заложена в data.ts

    return result
  })

  function toggleTag(tag: string) {
    const index = selectedTags.value.indexOf(tag)
    if (index > -1) {
      selectedTags.value.splice(index, 1)
    }
    else {
      selectedTags.value.push(tag)
    }
  }

  return {
    searchQuery,
    sortOrder,
    selectedTags,
    allTags,
    filteredCategories,
    toggleTag,
    allCategories, // Экспортируем для быстрых фильтров
  }
}
