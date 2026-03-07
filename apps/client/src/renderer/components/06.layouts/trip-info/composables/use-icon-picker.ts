import { useIconPicker as useSharedIconPicker } from '~/components/02.shared/icon-picker'

export function useIconPicker() {
  const { searchQuery, filteredIcons, activeCategoryId, iconCategories, reset } = useSharedIconPicker()

  const iconSearchQuery = searchQuery

  return {
    iconSearchQuery,
    searchQuery,
    filteredIcons,
    activeCategoryId,
    iconCategories,
    reset,
  }
}
