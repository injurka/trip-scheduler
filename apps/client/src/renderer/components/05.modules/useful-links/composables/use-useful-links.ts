import type { LinkCategory } from '../models/types'
import { linkCategories as allCategories } from '../lib/data'

export function useUsefulLinks() {
  const searchQuery = ref('')
  const sortOrder = ref<'default' | 'alphabetical'>('default')
  const selectedTags = ref<string[]>([])

  const allLinks = computed(() => allCategories.flatMap(category => category.links))

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

    for (const category of allCategories) {
      const linksBySearch = query
        ? category.links.filter(
            link =>
              link.name.toLowerCase().includes(query)
              || link.description.toLowerCase().includes(query),
          )
        : [...category.links]

      const linksByTags = selectedTags.value.length > 0
        ? linksBySearch.filter(link =>
            selectedTags.value.every(tag => link.tags?.includes(tag)),
          )
        : linksBySearch

      if (linksByTags.length > 0) {
        result.push({ ...category, links: linksByTags })
      }
    }

    if (sortOrder.value === 'alphabetical') {
      result.forEach((category) => {
        category.links.sort((a, b) => a.name.localeCompare(b.name))
      })
    }

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
    allCategories,
  }
}
