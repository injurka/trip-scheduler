/**
 * Wire types for the finances section.
 *
 * The importer is published as a standalone CLI, so these types must stay
 * local: @injurka/finance-contract is a private workspace package and cannot
 * be resolved from an end user's project.
 */
export type TransactionStatus = 'paid' | 'planned'
export type TransactionSource = 'manual' | 'imported'

export interface FinanceTransaction {
  id: string
  title: string
  amount: number
  currency: string
  date?: string
  categoryId: string | null
  notes?: string
  isSpontaneous: boolean
  status: TransactionStatus
  source: TransactionSource
  sourceKey?: string
}

export interface FinanceCategory {
  id: string
  name: string
  icon: string
  isDefault?: boolean
  budgetLimit?: number
}

export interface FinancesSectionContent {
  schemaVersion: 1
  settings: {
    mainCurrency: string
    exchangeRates: Record<string, number>
    totalBudget?: number
  }
  categories: FinanceCategory[]
  transactions: FinanceTransaction[]
}
