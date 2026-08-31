export interface FinanceTransaction {
  id: string
  title: string
  amount: number
  currency: string
  categoryId: string
  notes?: string
  date?: string
}

export interface FinanceCategory {
  id: string
  name: string
  icon: string
  isDefault: boolean
}

export interface FinancesSectionContent {
  settings: {
    mainCurrency: string
    exchangeRates: Record<string, number>
  }
  categories: FinanceCategory[]
  transactions: FinanceTransaction[]
}
