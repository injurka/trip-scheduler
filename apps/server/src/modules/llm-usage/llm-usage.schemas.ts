import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { llmTokenUsage } from '~/../db/schema'

// Schema for a single history item returned by the API
export const LlmUsageSchema = createSelectSchema(llmTokenUsage)

// Schema for the summary of token usage
export const LlmUsageSummarySchema = z.object({
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  limit: z.number(),
  used: z.number(),
})
