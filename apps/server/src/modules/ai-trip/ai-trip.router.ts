import { z } from 'zod'
import { protectedProcedure, router } from '~/lib/trpc'
import { aiTripService, GenerateAiTripInputSchema } from './ai-trip.service'

export const aiTripProcedures = {
  generate: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/ai-trip/generate',
        tags: ['AI Trip'],
        summary: 'Запустить генерацию путешествия через ИИ (страна, дата, дни, пожелания)',
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
      status: z.enum(['pending', 'generating', 'importing', 'done', 'error']),
      stage: z.string(),
      logs: z.array(z.string()),
      tripId: z.string().nullable(),
      error: z.string().nullable(),
    }))
    .query(async ({ input, ctx }) => {
      return aiTripService.getStatus(input.jobId, ctx.user.id)
    }),
}

export const aiTripRouter = router(aiTripProcedures)
