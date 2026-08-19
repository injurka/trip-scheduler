import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { llmModels, llmTokenUsage } from '~/../db/schema'

// Schema for a single history item returned by the API
export const LlmUsageSchema = createSelectSchema(llmTokenUsage)

// Schema for the summary of token usage
export const LlmUsageSummarySchema = z.object({
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  limit: z.number(),
  used: z.number(),
})

// Schema for an LLM Model record
export const LlmModelSchema = createSelectSchema(llmModels)

export const UpsertLlmModelInputSchema = z.object({
  id: z.string().min(1, 'Идентификатор модели обязателен'),
  costPerMillionInputTokens: z.number().min(0, 'Стоимость за входные токены должна быть >= 0'),
  costPerMillionOutputTokens: z.number().min(0, 'Стоимость за выходные токены должна быть >= 0'),
})

export const DeleteLlmModelInputSchema = z.object({
  id: z.string().min(1, 'Идентификатор модели обязателен'),
})

export const SyncLlmModelsOutputSchema = z.object({
  success: z.boolean(),
  models: z.array(LlmModelSchema),
  message: z.string().optional(),
})
