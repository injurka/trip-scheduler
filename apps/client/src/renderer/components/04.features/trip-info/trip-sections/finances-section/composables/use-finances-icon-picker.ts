import { computed, ref } from 'vue'

const iconList = [
  'mdi:food-fork-drink',
  'mdi:train-car',
  'mdi:bed',
  'mdi:party-popper',
  'mdi:shopping-outline',
  'mdi:dots-horizontal-circle-outline',
  'mdi:airplane',
  'mdi:bus',
  'mdi:taxi',
  'mdi:gas-station',
  'mdi:medical-bag',
  'mdi:ticket',
  'mdi:gift-outline',
  'mdi:bank-transfer',
  'mdi:cash-plus',
  'mdi:wallet-giftcard',
  'mdi:credit-card-outline',
  'mdi:receipt-text-outline',
]

/**
 * Composable для управления логикой выбора иконки для финансов.
 */
export function useFinancesIconPicker() {
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
