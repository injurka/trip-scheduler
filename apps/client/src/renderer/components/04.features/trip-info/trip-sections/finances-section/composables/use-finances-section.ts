import type { Category, FinancesSectionContent, FinancesSettings, Transaction } from '../models/types'
import { useDebounceFn } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { MAX_TRANSACTION_PHOTOS } from '../models/types'

export function normalizeTransactionPhotos(photos?: string[] | null): string[] | undefined {
  if (!Array.isArray(photos))
    return undefined

  const cleaned = Array.from(new Set(photos
    .filter((url): url is string => typeof url === 'string')
    .map(url => url.trim())
    .filter(Boolean))).slice(0, MAX_TRANSACTION_PHOTOS)

  return cleaned.length > 0 ? cleaned : undefined
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Еда и напитки', icon: 'mdi:food-fork-drink', isDefault: true },
  { id: 'cat-transport', name: 'Транспорт', icon: 'mdi:train-car', isDefault: true },
  { id: 'cat-flights', name: 'Авиабилеты', icon: 'mdi:airplane', isDefault: true },
  { id: 'cat-housing', name: 'Жильё', icon: 'mdi:bed', isDefault: true },
  { id: 'cat-entertainment', name: 'Развлечения', icon: 'mdi:party-popper', isDefault: true },
  { id: 'cat-shopping', name: 'Покупки', icon: 'mdi:shopping-outline', isDefault: true },
  { id: 'cat-telecom', name: 'Связь и страховка', icon: 'mdi:cellphone-wireless', isDefault: true },
  { id: 'cat-other', name: 'Прочее', icon: 'mdi:dots-horizontal-circle-outline', isDefault: true },
]

const DEFAULT_SETTINGS: FinancesSettings = {
  mainCurrency: 'RUB',
  exchangeRates: { USD: 90, EUR: 100 },
}

interface UseFinancesSectionProps {
  section: {
    id: string
    tripId?: string
    type: 'finances'
    content: FinancesSectionContent
  }
  readonly: boolean
}

export function useFinancesSection(props: UseFinancesSectionProps, emit: (event: 'updateSection', payload: unknown) => void) {
  const confirm = useConfirm()
  const content = computed(() => props.section.content)

  function mapIncomingTransactions(rawTransactions?: Transaction[]): Transaction[] {
    return JSON.parse(JSON.stringify(rawTransactions || [])).map((tx: Transaction) => {
      const normalizedPhotos = normalizeTransactionPhotos(tx.photos)
      const mapped: Transaction = {
        ...tx,
        status: tx.status || 'paid',
        source: tx.source || 'manual',
        ...(normalizedPhotos ? { photos: normalizedPhotos } : {}),
      }

      if (!normalizedPhotos)
        delete mapped.photos

      return mapped
    })
  }

  const transactions = ref<Transaction[]>(mapIncomingTransactions(content.value?.transactions))
  const categories = ref<Category[]>(JSON.parse(JSON.stringify(content.value?.categories || DEFAULT_CATEGORIES)))
  const settings = ref<FinancesSettings>(JSON.parse(JSON.stringify(content.value?.settings || DEFAULT_SETTINGS)))
  const selectedCategoryFilters = ref<string[]>([])
  const excludedCategoryFilters = ref<string[]>([])
  const dateFilter = ref<{ start: string | null, end: string | null }>({ start: null, end: null })
  const typeFilter = ref<'all' | 'planned' | 'spontaneous'>('all')
  const statusFilter = ref<'all' | 'paid' | 'planned'>('all')

  const isTransactionFormOpen = ref(false)
  const isCategoryManagerOpen = ref(false)
  const isSettingsOpen = ref(false)
  const isAiCreatorOpen = ref(false)
  const transactionToEdit = ref<Transaction | null>(null)
  let isSyncingFromProps = false

  const debouncedUpdate = useDebounceFn(() => {
    if (props.readonly || isSyncingFromProps)
      return

    const currentPayload = {
      schemaVersion: 1 as const,
      transactions: transactions.value,
      categories: categories.value,
      settings: settings.value,
    }
    const incomingPayload = {
      schemaVersion: 1 as const,
      transactions: mapIncomingTransactions(props.section.content?.transactions),
      categories: props.section.content?.categories || DEFAULT_CATEGORIES,
      settings: props.section.content?.settings || DEFAULT_SETTINGS,
    }

    if (JSON.stringify(currentPayload) === JSON.stringify(incomingPayload))
      return

    emit('updateSection', {
      ...props.section,
      content: JSON.parse(JSON.stringify(currentPayload)),
    })
  }, 700)

  function openTransactionForm(tx: Transaction | null = null) {
    if (props.readonly)
      return

    transactionToEdit.value = tx
      ? {
          ...tx,
          photos: tx.photos ? [...tx.photos] : undefined,
        }
      : null
    isTransactionFormOpen.value = true
  }

  function saveTransaction(tx: Partial<Transaction>) {
    const normalizedPhotos = normalizeTransactionPhotos(tx.photos)

    if (transactionToEdit.value) {
      const index = transactions.value.findIndex(t => t.id === tx.id)

      if (index !== -1) {
        const updatedTx: Transaction = {
          ...(tx as Transaction),
          photos: normalizedPhotos,
        }

        if (!normalizedPhotos)
          delete updatedTx.photos

        transactions.value.splice(index, 1, updatedTx)
      }
    }
    else {
      const newTx: Transaction = {
        ...tx,
        id: uuidv4(),
        categoryId: tx.categoryId || null,
        status: tx.status || 'paid',
        source: tx.source || 'manual',
        photos: normalizedPhotos,
      } as Transaction

      if (!normalizedPhotos)
        delete newTx.photos

      transactions.value.unshift(newTx)
    }

    isTransactionFormOpen.value = false
  }

  function toggleTransactionStatus(id: string) {
    if (props.readonly)
      return

    const tx = transactions.value.find(t => t.id === id)

    if (tx) {
      tx.status = tx.status === 'planned' ? 'paid' : 'planned'

      if (tx.status === 'paid' && !tx.date) {
        tx.date = new Date().toISOString().split('T')[0]
      }

      useToast().success(tx.status === 'paid' ? 'Трата отмечена как оплаченная.' : 'Трата перенесена в планы.')
    }
  }

  function addMultipleTransactions(newTransactions: Partial<Transaction>[]) {
    const transactionsToAdd = newTransactions.map((tx) => {
      const normalizedPhotos = normalizeTransactionPhotos(tx.photos)
      const created: Transaction = {
        ...tx,
        id: uuidv4(),
        categoryId: tx.categoryId || null,
        currency: tx.currency || settings.value.mainCurrency,
        status: tx.status || 'paid',
        source: tx.source || 'manual',
        photos: normalizedPhotos,
      } as Transaction

      if (!normalizedPhotos)
        delete created.photos

      return created
    })

    transactions.value.unshift(...transactionsToAdd)
    isAiCreatorOpen.value = false
  }

  async function deleteTransaction(id: string) {
    const isConfirmed = await confirm({ title: 'Удалить транзакцию?', description: 'Это действие нельзя отменить.' })

    if (isConfirmed)
      transactions.value = transactions.value.filter(t => t.id !== id)
  }

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
      confirm({ title: 'Категория используется', description: 'Нельзя удалить категорию, которая присвоена одной или нескольким транзакциям.' })

      return
    }

    categories.value = categories.value.filter(c => c.id !== id)
  }

  function saveSettings(newSettings: FinancesSettings) {
    settings.value = newSettings
    isSettingsOpen.value = false
  }

  const convertToMainCurrency = (amount: number, currency: string): number | null => {
    if (currency === settings.value.mainCurrency)
      return amount

    const rate = settings.value.exchangeRates[currency]

    return rate && rate > 0 ? amount * rate : null
  }

  const missingCurrencyCodes = computed(() => [...new Set(transactions.value
    .filter(tx => tx.currency !== settings.value.mainCurrency && !(settings.value.exchangeRates[tx.currency] > 0))
    .map(tx => tx.currency))])

  const sumInMainCurrency = (items: Transaction[]) => items.reduce((sum, tx) => sum + (convertToMainCurrency(tx.amount, tx.currency) || 0), 0)

  const sortedTransactions = computed(() => {
    return [...transactions.value].sort((a, b) => {
      if (!a.date && b.date)
        return -1

      if (a.date && !b.date)
        return 1

      if (!a.date && !b.date)
        return 0

      return new Date(b.date!).getTime() - new Date(a.date!).getTime()
    })
  })

  function matchesCategoryFilter(categoryId: string) {
    return (selectedCategoryFilters.value.length === 0 || selectedCategoryFilters.value.includes(categoryId))
      && !excludedCategoryFilters.value.includes(categoryId)
  }

  // Фильтруем транзакции по всем фильтрам кроме type/status (для подсчета общих сумм)
  const baseFilteredTransactions = computed(() => {
    let result = sortedTransactions.value

    const { start, end } = dateFilter.value

    if (start || end) {
      result = result.filter((tx) => {
        if (!tx.date)
          return false

        const txDate = tx.date.split('T')[0]
        const isAfterStart = start ? txDate >= start : true
        const isBeforeEnd = end ? txDate <= end : true

        return isAfterStart && isBeforeEnd
      })
    }

    result = result.filter(tx => matchesCategoryFilter(tx.categoryId || 'cat-other'))

    return result
  })

  // Итоговый фильтр с учетом statusFilter и typeFilter
  const filteredTransactions = computed(() => {
    let result = baseFilteredTransactions.value

    if (statusFilter.value === 'paid') {
      result = result.filter(tx => tx.status !== 'planned')
    }
    else if (statusFilter.value === 'planned') {
      result = result.filter(tx => tx.status === 'planned')
    }

    if (typeFilter.value === 'planned') {
      result = result.filter(tx => !tx.isSpontaneous)
    }
    else if (typeFilter.value === 'spontaneous') {
      result = result.filter(tx => tx.isSpontaneous)
    }

    return result
  })

  const tripPaidTotal = computed(() => {
    return transactions.value
      .filter(tx => tx.status !== 'planned')
      .reduce((sum, tx) => sum + (convertToMainCurrency(tx.amount, tx.currency) || 0), 0)
  })

  const tripPlannedTotal = computed(() => {
    return transactions.value
      .filter(tx => tx.status === 'planned')
      .reduce((sum, tx) => sum + (convertToMainCurrency(tx.amount, tx.currency) || 0), 0)
  })

  const tripSpontaneousTotal = computed(() => {
    return transactions.value
      .filter(tx => tx.isSpontaneous && tx.status !== 'planned')
      .reduce((sum, tx) => sum + (convertToMainCurrency(tx.amount, tx.currency) || 0), 0)
  })

  const paidTotal = tripPaidTotal
  const plannedTotal = tripPlannedTotal
  const spontaneousTotal = tripSpontaneousTotal

  const totalSpending = computed(() => {
    return sumInMainCurrency(transactions.value)
  })

  const categoryBudgetsTotal = computed(() => {
    return categories.value.reduce((sum, c) => sum + (c.budgetLimit || 0), 0)
  })

  const overallBudget = computed(() => {
    if (settings.value.totalBudget && settings.value.totalBudget > 0)
      return settings.value.totalBudget

    if (categoryBudgetsTotal.value > 0)
      return categoryBudgetsTotal.value

    return tripPaidTotal.value + tripPlannedTotal.value
  })

  const remainingBudget = computed(() => {
    return Math.max(0, overallBudget.value - tripPaidTotal.value)
  })

  const spendingByCategory = computed(() => {
    const spendingMap = new Map<string, {
      id: string
      name: string
      icon: string
      amount: number
      paidAmount: number
      plannedAmount: number
      budgetLimit?: number
      colorIndex: number
    }>()

    categories.value.forEach((cat, index) => {
      spendingMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        amount: 0,
        paidAmount: 0,
        plannedAmount: 0,
        budgetLimit: cat.budgetLimit,
        colorIndex: index,
      })
    })

    filteredTransactions.value.forEach((tx) => {
      const categoryId = tx.categoryId || 'cat-other'
      const amountInMain = convertToMainCurrency(tx.amount, tx.currency)

      if (amountInMain === null)
        return

      if (!spendingMap.has(categoryId)) {
        const cat = categories.value.find(c => c.id === categoryId) || DEFAULT_CATEGORIES.find(c => c.id === 'cat-other')!
        const catIndex = categories.value.findIndex(c => c.id === categoryId)
        spendingMap.set(categoryId, {
          id: categoryId,
          name: cat.name,
          icon: cat.icon,
          amount: 0,
          paidAmount: 0,
          plannedAmount: 0,
          budgetLimit: cat.budgetLimit,
          colorIndex: catIndex >= 0 ? catIndex : categories.value.length,
        })
      }

      const item = spendingMap.get(categoryId)!
      item.amount += amountInMain

      if (tx.status === 'planned') {
        item.plannedAmount += amountInMain
      }
      else {
        item.paidAmount += amountInMain
      }
    })

    return Array.from(spendingMap.values())
      .filter((cat) => {
        if (!matchesCategoryFilter(cat.id))
          return false

        if (selectedCategoryFilters.value.includes(cat.id))
          return true

        if (statusFilter.value !== 'all' || typeFilter.value !== 'all') {
          return cat.amount > 0
        }

        return cat.amount > 0 || (cat.budgetLimit && cat.budgetLimit > 0)
      })
      .sort((a, b) => {
        const aVal = Math.max(a.paidAmount, a.amount, a.budgetLimit || 0)
        const bVal = Math.max(b.paidAmount, b.amount, b.budgetLimit || 0)

        return bVal - aVal
      })
  })

  const spendingByDay = computed(() => {
    const spendingMap = new Map<string, number>()

    filteredTransactions.value
      .filter(tx => !!tx.date && (statusFilter.value === 'planned' ? tx.status === 'planned' : tx.status !== 'planned'))
      .forEach((tx) => {
        const date = tx.date!.split('T')[0]
        const amountInMain = convertToMainCurrency(tx.amount, tx.currency)

        if (amountInMain === null)
          return

        if (spendingMap.has(date))
          spendingMap.set(date, spendingMap.get(date)! + amountInMain)

        else
          spendingMap.set(date, amountInMain)
      })

    return Array.from(spendingMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  })

  const filteredTotal = computed(() => {
    return filteredTransactions.value
      .reduce((sum, tx) => sum + (convertToMainCurrency(tx.amount, tx.currency) || 0), 0)
  })

  function toggleCategoryFilter(categoryId: string | null) {
    if (categoryId === null) {
      selectedCategoryFilters.value = []
      excludedCategoryFilters.value = []

      return
    }

    const index = selectedCategoryFilters.value.indexOf(categoryId)

    if (index > -1) {
      selectedCategoryFilters.value.splice(index, 1)
      excludedCategoryFilters.value.push(categoryId)
    }
    else if (excludedCategoryFilters.value.includes(categoryId)) {
      excludedCategoryFilters.value = excludedCategoryFilters.value.filter(id => id !== categoryId)
    }
    else {
      selectedCategoryFilters.value.push(categoryId)
    }
  }

  watch(() => props.section.content, (newContent) => {
    const nextTransactions = mapIncomingTransactions(newContent?.transactions)
    const nextCategories = JSON.parse(JSON.stringify(newContent?.categories || DEFAULT_CATEGORIES))
    const nextSettings = JSON.parse(JSON.stringify(newContent?.settings || DEFAULT_SETTINGS))

    isSyncingFromProps = true

    if (JSON.stringify(transactions.value) !== JSON.stringify(nextTransactions))
      transactions.value = nextTransactions

    if (JSON.stringify(categories.value) !== JSON.stringify(nextCategories))
      categories.value = nextCategories

    if (JSON.stringify(settings.value) !== JSON.stringify(nextSettings))
      settings.value = nextSettings

    isSyncingFromProps = false
  }, { deep: true })

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
    excludedCategoryFilters,
    dateFilter,
    typeFilter,
    statusFilter,

    // Computed
    totalSpending,
    overallBudget,
    remainingBudget,
    paidTotal,
    plannedTotal,
    spontaneousTotal,
    spendingByCategory,
    spendingByDay,
    filteredTransactions,
    filteredTotal,
    missingCurrencyCodes,

    // Methods
    openTransactionForm,
    saveTransaction,
    toggleTransactionStatus,
    addMultipleTransactions,
    deleteTransaction,
    saveCategory,
    deleteCategory,
    saveSettings,
    toggleCategoryFilter,
  }
}
