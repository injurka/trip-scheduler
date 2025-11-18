import { computed, ref } from 'vue'

/**
 * Composable для управления логикой выбора иконки с поиском.
 */
export function useChecklistIconPicker() {
  const iconSearchQuery = ref('')

  const filteredIcons = computed(() => {
    if (!iconSearchQuery.value.trim())
      return sharedIconList

    const searchQuery = iconSearchQuery.value.toLowerCase()
    return sharedIconList.filter(icon => icon.toLowerCase().includes(searchQuery))
  })

  return {
    iconSearchQuery,
    filteredIcons,
  }
}
