import type { Context } from 'hono'
import z from 'zod'
import { createTRPCError, protectedProcedure, publicProcedure } from '~/lib/trpc'
import { tripService } from '~/modules/trip/trip.service'
import { tripRepository } from '~/repositories/trip.repository'
import { memoryDraftService } from './memory-generation.service'
import {
  ApplyMemoriesInputSchema,
  CreateMemoryInputSchema,
  DeleteMemoryInputSchema,
  GenerateMemoriesInputSchema,
  GetMemoriesInputSchema,
  MemoryProposalSchema,
  MemorySchema,
  UpdateMemoryInputSchema,
} from './memory.schemas'
import { memoryService } from './memory.service'

function extractShareSlug(inputShareSlug?: string, c?: Context): string | undefined {
  if (inputShareSlug)
    return inputShareSlug

  const headerSlug = c?.req?.header('x-share-slug') || c?.req?.query('shareSlug')
  if (headerSlug)
    return headerSlug

  const referer = c?.req?.header('referer')
  if (referer) {
    const match = referer.match(/\/trip\/([^/?#]+)/)
    if (match?.[1])
      return decodeURIComponent(match[1])
  }

  return undefined
}

export const memoryProcedures = {
  generate: protectedProcedure
    .input(GenerateMemoriesInputSchema)
    .output(MemoryProposalSchema)
    .mutation(({ input, ctx }) => memoryDraftService.generate(input.dayId, input.text, ctx.user.id, ctx.user.role)),
  applyGenerated: protectedProcedure
    .input(ApplyMemoriesInputSchema)
    .output(z.array(MemorySchema))
    .mutation(({ input, ctx }) => memoryDraftService.apply(input, ctx.user.id, ctx.user.role)),

  getByTripId: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/memories/by-trip/{tripId}',
        tags: ['Memories'],
        summary: 'Получить воспоминания путешествия (с фильтрацией)',
      },
    })
    .input(GetMemoriesInputSchema.extend({ shareSlug: z.string().optional() }))
    .output(z.array(MemorySchema))
    .query(async ({ input, ctx }) => {
      const trip = await tripRepository.getById(input.tripId)
      if (!trip)
        throw createTRPCError('NOT_FOUND', `Путешествие с ID ${input.tripId} не найдено.`)

      const shareSlug = extractShareSlug(input.shareSlug, ctx.c)
      await tripService.verifyTripReadAccess(trip, ctx.user, shareSlug)

      return memoryService.getByTripId(input)
    }),

  create: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/memories',
        tags: ['Memories'],
        summary: 'Создать воспоминание',
      },
    })
    .input(CreateMemoryInputSchema)
    .output(MemorySchema.nullable())
    .mutation(async ({ input, ctx }) => {
      return memoryService.create(input, ctx.user.id, ctx.user.role)
    }),

  update: protectedProcedure
    .meta({
      openapi: {
        method: 'PATCH',
        path: '/memories/{id}',
        tags: ['Memories'],
        summary: 'Обновить воспоминание',
      },
    })
    .input(UpdateMemoryInputSchema)
    .output(MemorySchema.nullable())
    .mutation(async ({ input, ctx }) => {
      return memoryService.update(input, ctx.user.id, ctx.user.role)
    }),

  delete: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/memories/{id}',
        tags: ['Memories'],
        summary: 'Удалить воспоминание',
      },
    })
    .input(DeleteMemoryInputSchema)
    .output(MemorySchema.nullable())
    .mutation(async ({ input, ctx }) => {
      return memoryService.delete(input.id, ctx.user.id, ctx.user.role)
    }),

  applyTakenAt: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/memories/{id}/apply-date',
        tags: ['Memories'],
        summary: 'Применить дату съемки фото к воспоминанию',
      },
    })
    .input(z.object({ id: z.string().uuid() }))
    .output(MemorySchema.nullable())
    .mutation(async ({ input }) => {
      return memoryService.applyTakenAt(input.id)
    }),

  unassignDate: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/memories/{id}/unassign-date',
        tags: ['Memories'],
        summary: 'Убрать дату у воспоминания',
      },
    })
    .input(z.object({ id: z.string().uuid() }))
    .output(MemorySchema.nullable())
    .mutation(async ({ input }) => {
      return memoryService.unassignDate(input.id)
    }),
}
