import { iconCategories } from '~/shared/constants/icon-list'

const ALL_CATEGORY_ID = 'all'

export function useIconPicker() {
  const searchQuery = ref('')
  const activeCategoryId = ref(ALL_CATEGORY_ID)

  const currentCategoryIcons = computed(() => {
    if (activeCategoryId.value === ALL_CATEGORY_ID) {
      return iconCategories.flatMap(c => c.icons)
    }
    return iconCategories.find(c => c.id === activeCategoryId.value)?.icons ?? []
  })

  const filteredIcons = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q)
      return currentCategoryIcons.value
    return currentCategoryIcons.value.filter(icon =>
      icon.toLowerCase().includes(q),
    )
  })

  function reset() {
    searchQuery.value = ''
    activeCategoryId.value = ALL_CATEGORY_ID
  }

  return {
    searchQuery,
    activeCategoryId,
    filteredIcons,
    iconCategories,
    reset,
  }
}
