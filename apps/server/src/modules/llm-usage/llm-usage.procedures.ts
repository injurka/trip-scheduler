import { z } from 'zod'
import { protectedProcedure } from '~/lib/trpc'
import { LlmUsageSchema, LlmUsageSummarySchema } from './llm-usage.schemas'
import { llmUsageService } from './llm-usage.service'

export const llmUsageProcedures = {
  /**
   * Procedure to get the token usage history for the current user.
   */
  getHistory: protectedProcedure
    .output(z.array(LlmUsageSchema))
    .query(async ({ ctx }) => {
      return llmUsageService.getHistory(ctx.user.id)
    }),

  /**
   * Procedure to get the token usage summary for the current user.
   */
  getSummary: protectedProcedure
    .output(LlmUsageSummarySchema)
    .query(async ({ ctx }) => {
      return llmUsageService.getSummary(ctx.user)
    }),
}
