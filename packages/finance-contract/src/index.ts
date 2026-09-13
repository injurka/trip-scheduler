import { z } from 'zod'

export const TransactionStatusSchema = z.enum(['paid', 'planned'])
export const TransactionSourceSchema = z.enum(['manual', 'imported'])

export const FinanceTransactionSchema = z.object({
  id: z.string().min(1).max(160),
  title: z.string().trim().min(1).max(500),
  amount: z.number().finite().nonnegative(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
  date: z.string().date().optional(),
  categoryId: z.string().min(1).max(160).nullable(),
  notes: z.string().max(4000).optional(),
  isSpontaneous: z.boolean().optional().default(false),
  status: TransactionStatusSchema.optional().default('paid'),
  source: TransactionSourceSchema.optional().default('manual'),
  sourceKey: z.string().min(1).max(240).optional(),
})

export const FinanceCategorySchema = z.object({
  id: z.string().min(1).max(160),
  name: z.string().trim().min(1).max(100),
  icon: z.string().trim().min(1).max(160),
  isDefault: z.boolean().optional(),
  budgetLimit: z.number().finite().nonnegative().optional(),
})

export const FinancesSectionContentSchema = z.object({
  schemaVersion: z.literal(1).optional().default(1),
  settings: z.object({
    mainCurrency: z.string().trim().regex(/^[A-Z]{3}$/),
    exchangeRates: z.record(z.string().regex(/^[A-Z]{3}$/), z.number().finite().positive()),
    totalBudget: z.number().finite().nonnegative().optional(),
  }),
  categories: z.array(FinanceCategorySchema),
  transactions: z.array(FinanceTransactionSchema),
})

export type TransactionStatus = z.infer<typeof TransactionStatusSchema>
export type TransactionSource = z.infer<typeof TransactionSourceSchema>
export type FinanceTransaction = z.infer<typeof FinanceTransactionSchema>
export type FinanceCategory = z.infer<typeof FinanceCategorySchema>
export type FinancesSectionContent = z.infer<typeof FinancesSectionContentSchema>
