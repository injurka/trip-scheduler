export type TransactionStatus = 'paid' | 'planned'

/**
 * Транзакция.
 */
export interface Transaction {
  id: string
  title: string
  amount: number
  currency: string // e.g., 'RUB', 'USD', 'EUR'
  date?: string // ISO 8601 format
  categoryId: string | null
  notes?: string
  isSpontaneous?: boolean
  status?: TransactionStatus
}

/**
 * Категория расходов/доходов.
 */
export interface Category {
  id: string
  name: string
  icon: string
  isDefault?: boolean // Для неотключаемых категорий
  budgetLimit?: number // Плановый лимит / бюджет на категорию
}

/**
 * Настройки финансового раздела.
 */
export interface FinancesSettings {
  mainCurrency: string
  // Ключ - код валюты (USD), значение - курс к основной валюте (90)
  exchangeRates: Record<string, number>
  totalBudget?: number // Общий предполагаемый бюджет поездки
}

/**
 * Структура контента для секции финансов.
 */
export interface FinancesSectionContent {
  transactions: Transaction[]
  categories: Category[]
  settings: FinancesSettings
}
