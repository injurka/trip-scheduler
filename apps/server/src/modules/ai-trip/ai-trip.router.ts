import { z } from 'zod'
import { protectedProcedure, router } from '~/lib/trpc'
import {
  AiTripConceptProposalSchema,
  aiTripService,
  GenerateAiTripInputSchema,
  ProposeAiTripConceptInputSchema,
} from './ai-trip.service'

export const aiTripProcedures = {
  proposeConcept: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/ai-trip/propose-concept',
        tags: ['AI Trip'],
        summary: 'Спроектировать интерактивную концепцию путешествия (маршрут, места, отели, дни)',
      },
    })
    .input(ProposeAiTripConceptInputSchema)
    .output(AiTripConceptProposalSchema)
    .mutation(async ({ input, ctx }) => {
      return aiTripService.proposeConcept(ctx.user.id, input)
    }),

  generate: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/ai-trip/generate',
        tags: ['AI Trip'],
        summary: 'Запустить генерацию полного путешествия через ИИ (с опциональной утверждённой концепцией)',
      },
    })
    .input(GenerateAiTripInputSchema)
    .output(z.object({ jobId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return aiTripService.startGeneration(ctx.user.id, input)
    }),

  getStatus: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .output(z.object({
      status: z.enum(['pending', 'generating', 'importing', 'done', 'needs_input', 'error']),
      stage: z.string(),
      logs: z.array(z.string()),
      tripId: z.string().nullable(),
      error: z.string().nullable(),
      progress: z.number().nullable(),
      attempt: z.number(),
      attemptsTotal: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      return aiTripService.getStatus(input.jobId, ctx.user.id)
    }),
}

export const aiTripRouter = router(aiTripProcedures)
