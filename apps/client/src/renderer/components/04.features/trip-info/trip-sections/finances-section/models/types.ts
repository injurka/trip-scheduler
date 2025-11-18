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
}

/**
 * Категория расходов/доходов.
 */
export interface Category {
  id: string
  name: string
  icon: string
  isDefault?: boolean // Для неотключаемых категорий
}

/**
 * Настройки финансового раздела.
 */
export interface FinancesSettings {
  mainCurrency: string
  // Ключ - код валюты (USD), значение - курс к основной валюте (90)
  exchangeRates: Record<string, number>
}

/**
 * Структура контента для секции финансов.
 */
export interface FinancesSectionContent {
  transactions: Transaction[]
  categories: Category[]
  settings: FinancesSettings
}
