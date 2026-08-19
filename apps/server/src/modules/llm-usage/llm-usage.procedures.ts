import { z } from 'zod'
import { adminProcedure, protectedProcedure } from '~/lib/trpc'
import {
  DeleteLlmModelInputSchema,
  LlmModelSchema,
  LlmUsageSchema,
  LlmUsageSummarySchema,
  UpsertLlmModelInputSchema,
} from './llm-usage.schemas'
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

  listModels: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/llm/models',
        tags: ['LLM Models'],
        summary: 'Получить список всех зарегистрированных моделей и их тарифов',
      },
    })
    .output(z.array(LlmModelSchema))
    .query(async () => {
      return llmUsageService.listModels()
    }),

  upsertModel: adminProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/llm/models',
        tags: ['LLM Models'],
        summary: 'Добавить или обновить модель (только для admin)',
        protect: true,
      },
    })
    .input(UpsertLlmModelInputSchema)
    .output(LlmModelSchema)
    .mutation(async ({ input }) => {
      return llmUsageService.upsertModel(input)
    }),

  deleteModel: adminProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/llm/models/{id}',
        tags: ['LLM Models'],
        summary: 'Удалить модель (только для admin)',
        protect: true,
      },
    })
    .input(DeleteLlmModelInputSchema)
    .output(LlmModelSchema.nullable())
    .mutation(async ({ input }) => {
      return llmUsageService.deleteModel(input.id)
    }),
}
