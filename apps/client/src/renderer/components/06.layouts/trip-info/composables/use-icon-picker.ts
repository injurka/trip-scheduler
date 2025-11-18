import { computed, ref } from 'vue'

// Централизованный список иконок. Редактировать только здесь.
const iconList = [
  'mdi:walk',
  'mdi:car',
  'mdi:train',
  'mdi:airplane',
  'mdi:bus',
  'mdi:taxi',
  'mdi:ferry',
  'mdi:bike',
  'mdi:bed',
  'mdi:food-fork-drink',
  'mdi:coffee-outline',
  'mdi:store-outline',
  'mdi:tent',
  'mdi:camera-outline',
  'mdi:map-marker-outline',
  'mdi:hiking',
  'mdi:swim',
  'mdi:beach',
  'mdi:shopping-outline',
  'mdi:music-note-outline',
  'mdi:party-popper',
  'mdi:currency-usd',
  'mdi:ticket-confirmation-outline',
  'mdi:weather-sunny',
  'mdi:weather-night',
  'mdi:flag-variant-outline',
  'mdi:information-outline',
  'mdi:run-fast',
  'mdi:bank-outline',
  'mdi:gas-station-outline',
  'mdi:fire',
  'mdi:heart-outline',
  'mdi:star-outline',
  'mdi:check-circle-outline',
  'mdi:alert-circle-outline',
  'mdi:help-circle-outline',
  'mdi:account-group-outline',
  'mdi:phone-outline',
  'mdi:link-variant',
  'mdi:calendar-blank-outline',
  'mdi:file-document-outline',
]

/**
 * Composable для управления логикой выбора иконки с поиском.
 */
export function useIconPicker() {
  const iconSearchQuery = ref('')

  const filteredIcons = computed(() => {
    if (!iconSearchQuery.value.trim())
      return iconList

    const searchQuery = iconSearchQuery.value.toLowerCase()
    return iconList.filter(icon => icon.toLowerCase().includes(searchQuery))
  })

  return {
    iconSearchQuery,
    filteredIcons,
  }
}
