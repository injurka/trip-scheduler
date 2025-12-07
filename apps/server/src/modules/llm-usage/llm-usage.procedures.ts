import { z } from 'zod'
import { protectedProcedure } from '~/lib/trpc'
import { LlmUsageSchema, LlmUsageSummarySchema } from './llm-usage.schemas'
import { llmUsageService } from './llm-usage.service'

export const llmUsageProcedures = {
  getHistory: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/llm/history',
        tags: ['LLM Usage'],
        summary: 'Получить историю использования токенов',
      },
    })
    .output(z.array(LlmUsageSchema))
    .query(async ({ ctx }) => {
      return llmUsageService.getHistory(ctx.user.id)
    }),

  getSummary: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/llm/summary',
        tags: ['LLM Usage'],
        summary: 'Получить сводку использования токенов',
      },
    })
    .output(LlmUsageSummarySchema)
    .query(async ({ ctx }) => {
      return llmUsageService.getSummary(ctx.user)
    }),
}
