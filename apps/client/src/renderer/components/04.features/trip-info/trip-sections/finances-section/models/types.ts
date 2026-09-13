import type { FinancesSectionContent as ContractFinancesSectionContent, FinanceCategory, FinanceTransaction, TransactionSource, TransactionStatus } from '@injurka/finance-contract'

export type { TransactionSource, TransactionStatus }

/**
 * Транзакция.
 */
export type Transaction = FinanceTransaction

/**
 * Категория расходов/доходов.
 */
export type Category = FinanceCategory

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
export type FinancesSectionContent = ContractFinancesSectionContent
