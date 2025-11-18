import type { Category, FinancesSectionContent, FinancesSettings, Transaction } from '../models/types'
import { useDebounceFn } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Еда и напитки', icon: 'mdi:food-fork-drink', isDefault: true },
  { id: 'cat-transport', name: 'Транспорт', icon: 'mdi:train-car', isDefault: true },
  { id: 'cat-flights', name: 'Авиабилеты', icon: 'mdi:airplane', isDefault: true },
  { id: 'cat-housing', name: 'Жильё', icon: 'mdi:bed', isDefault: true },
  { id: 'cat-entertainment', name: 'Развлечения', icon: 'mdi:party-popper', isDefault: true },
  { id: 'cat-shopping', name: 'Покупки', icon: 'mdi:shopping-outline', isDefault: true },
  { id: 'cat-other', name: 'Прочее', icon: 'mdi:dots-horizontal-circle-outline', isDefault: true },
]

const DEFAULT_SETTINGS: FinancesSettings = {
  mainCurrency: 'RUB',
  exchangeRates: { USD: 90, EUR: 100 },
}

interface UseFinancesSectionProps {
  section: {
    id: string
    type: 'finances'
    content: FinancesSectionContent
  }
  readonly: boolean
}

/**
 * Хук для управления логикой секции финансов.
 */
export function useFinancesSection(
  props: UseFinancesSectionProps,
  emit: (event: 'updateSection', payload: any) => void,
) {
  const confirm = useConfirm()
  const content = computed(() => props.section.content)

  // --- Состояние ---
  const transactions = ref<Transaction[]>(JSON.parse(JSON.stringify(content.value?.transactions || [])))
  const categories = ref<Category[]>(JSON.parse(JSON.stringify(content.value?.categories || DEFAULT_CATEGORIES)))
  const settings = ref<FinancesSettings>(JSON.parse(JSON.stringify(content.value?.settings || DEFAULT_SETTINGS)))
  const selectedCategoryFilters = ref<string[]>([]) // Пустой массив означает 'все'
  const dateFilter = ref<{ start: string | null, end: string | null }>({ start: null, end: null })

  // --- Состояние UI ---
  const isTransactionFormOpen = ref(false)
  const isCategoryManagerOpen = ref(false)
  const isSettingsOpen = ref(false)
  const isAiCreatorOpen = ref(false)
  const transactionToEdit = ref<Transaction | null>(null)

  const debouncedUpdate = useDebounceFn(() => {
    emit('updateSection', {
      ...props.section,
      content: {
        transactions: transactions.value,
        categories: categories.value,
        settings: settings.value,
      },
    })
  }, 700)

  // --- Методы для работы с транзакциями ---
  function openTransactionForm(tx: Transaction | null = null) {
    if (props.readonly)
      return
    transactionToEdit.value = tx ? { ...tx } : null
    isTransactionFormOpen.value = true
  }

  function saveTransaction(tx: Partial<Transaction>) {
    if (transactionToEdit.value) {
      // Обновление
      const index = transactions.value.findIndex(t => t.id === tx.id)
      if (index !== -1)
        transactions.value.splice(index, 1, tx as Transaction)
    }
    else {
      // Создание
      transactions.value.unshift({ ...tx, id: uuidv4(), categoryId: tx.categoryId || null } as Transaction)
    }
    isTransactionFormOpen.value = false
  }

  /**
   * Новый метод для добавления нескольких транзакций от AI
   */
  function addMultipleTransactions(newTransactions: Partial<Transaction>[]) {
    const transactionsToAdd = newTransactions.map(tx => ({
      ...tx,
      id: uuidv4(),
      categoryId: tx.categoryId || null,
      currency: tx.currency || settings.value.mainCurrency,
    } as Transaction))

    transactions.value.unshift(...transactionsToAdd)
    isAiCreatorOpen.value = false
  }

  async function deleteTransaction(id: string) {
    const isConfirmed = await confirm({ title: 'Удалить транзакцию?', description: 'Это действие нельзя отменить.' })
    if (isConfirmed)
      transactions.value = transactions.value.filter(t => t.id !== id)
  }

  // --- Методы для работы с категориями ---
  function saveCategory(cat: Partial<Category>) {
    const index = categories.value.findIndex(c => c.id === cat.id)
    if (index !== -1) {
      categories.value[index] = { ...categories.value[index], ...cat } as Category
    }
    else {
      categories.value.push({ ...cat, id: uuidv4() } as Category)
    }
  }

  function deleteCategory(id: string) {
    const isUsed = transactions.value.some(t => t.categoryId === id)
    if (isUsed) {
      // Вместо удаления, можно предложить переназначить транзакции, но для простоты просто запретим
      confirm({ title: 'Категория используется', description: 'Нельзя удалить категорию, которая присвоена одной или нескольким транзакциям.' })
      return
    }
    categories.value = categories.value.filter(c => c.id !== id)
  }

  // --- Методы для настроек ---
  function saveSettings(newSettings: FinancesSettings) {
    settings.value = newSettings
    isSettingsOpen.value = false
  }

  // --- Вычисляемые свойства для дэшборда ---
  const convertToMainCurrency = (amount: number, currency: string): number => {
    if (currency === settings.value.mainCurrency)
      return amount
    const rate = settings.value.exchangeRates[currency] || 1
    return amount * rate
  }

  const totalSpending = computed(() => {
    return transactions.value
      .reduce((sum, tx) => sum + convertToMainCurrency(tx.amount, tx.currency), 0)
  })

  const spendingByCategory = computed(() => {
    const spendingMap = new Map<string, { name: string, icon: string, amount: number }>()

    transactions.value
      .forEach((tx) => {
        const categoryId = tx.categoryId || 'cat-other'
        const category = categories.value.find(c => c.id === categoryId) || DEFAULT_CATEGORIES.find(c => c.id === 'cat-other')!
        const amountInMain = convertToMainCurrency(tx.amount, tx.currency)

        if (spendingMap.has(categoryId)) {
          spendingMap.get(categoryId)!.amount += amountInMain
        }
        else {
          spendingMap.set(categoryId, { name: category.name, icon: category.icon, amount: amountInMain })
        }
      })

    return Array.from(spendingMap.values()).sort((a, b) => b.amount - a.amount)
  })

  const spendingByDay = computed(() => {
    const spendingMap = new Map<string, number>()

    transactions.value
      .filter(tx => tx.date) // Исключаем транзакции без даты
      .forEach((tx) => {
        const date = tx.date!.split('T')[0] // Группируем по дню, отбрасывая время
        const amountInMain = convertToMainCurrency(tx.amount, tx.currency)

        if (spendingMap.has(date))
          spendingMap.set(date, spendingMap.get(date)! + amountInMain)

        else
          spendingMap.set(date, amountInMain)
      })

    return Array.from(spendingMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  })

  const sortedTransactions = computed(() => {
    return [...transactions.value].sort((a, b) => {
      // Траты без даты всегда наверху
      if (!a.date && b.date)
        return -1
      if (a.date && !b.date)
        return 1

      // Если у обеих нет даты, порядок не важен
      if (!a.date && !b.date)
        return 0

      // Если у обеих есть дата, сортируем по убыванию
      return new Date(b.date!).getTime() - new Date(a.date!).getTime()
    })
  })

  const filteredTransactions = computed(() => {
    let result = sortedTransactions.value

    // 1. Фильтр по дате
    const { start, end } = dateFilter.value
    if (start || end) {
      result = result.filter((tx) => {
        if (!tx.date)
          return false // Исключаем траты без даты при активном фильтре по дате
        const txDate = tx.date.split('T')[0]
        const isAfterStart = start ? txDate >= start : true
        const isBeforeEnd = end ? txDate <= end : true
        return isAfterStart && isBeforeEnd
      })
    }

    // 2. Фильтр по категориям
    if (selectedCategoryFilters.value.length > 0) {
      result = result.filter(tx =>
        tx.categoryId && selectedCategoryFilters.value.includes(tx.categoryId),
      )
    }

    return result
  })

  const filteredTotal = computed(() => {
    return filteredTransactions.value
      .reduce((sum, tx) => sum + convertToMainCurrency(tx.amount, tx.currency), 0)
  })

  function toggleCategoryFilter(categoryId: string | null) {
    // Клик по "Все категории"
    if (categoryId === null) {
      selectedCategoryFilters.value = []
      return
    }

    const index = selectedCategoryFilters.value.indexOf(categoryId)
    if (index > -1) {
      // Категория уже выбрана, убираем ее
      selectedCategoryFilters.value.splice(index, 1)
    }
    else {
      // Категория не выбрана, добавляем ее
      selectedCategoryFilters.value.push(categoryId)
    }
  }

  watch([transactions, categories, settings], debouncedUpdate, { deep: true })

  return {
    // State
    transactions,
    categories,
    settings,
    isTransactionFormOpen,
    isCategoryManagerOpen,
    isSettingsOpen,
    isAiCreatorOpen,
    transactionToEdit,
    selectedCategoryFilters,
    dateFilter,

    // Computed
    totalSpending,
    spendingByCategory,
    spendingByDay,
    filteredTransactions,
    filteredTotal,

    // Methods
    openTransactionForm,
    saveTransaction,
    addMultipleTransactions,
    deleteTransaction,
    saveCategory,
    deleteCategory,
    saveSettings,
    toggleCategoryFilter,
  }
}
