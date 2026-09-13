export type TransactionStatus = 'paid' | 'planned'

export interface FinanceTransaction {
  id: string
  title: string
  amount: number
  currency: string
  categoryId: string
  notes?: string
  date?: string
  isSpontaneous?: boolean
  status?: TransactionStatus
}

export interface FinanceCategory {
  id: string
  name: string
  icon: string
  isDefault: boolean
  budgetLimit?: number
}

export interface FinancesSectionContent {
  settings: {
    mainCurrency: string
    exchangeRates: Record<string, number>
    totalBudget?: number
  }
  categories: FinanceCategory[]
  transactions: FinanceTransaction[]
}
