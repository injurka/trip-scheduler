import z from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import {
  CreateMemoryInputSchema,
  DeleteMemoryInputSchema,
  GetMemoriesInputSchema,
  MemorySchema,
  UpdateMemoryInputSchema,
} from './memory.schemas'
import { memoryService } from './memory.service'

export const memoryProcedures = {
  getByTripId: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/memories/by-trip/{tripId}',
        tags: ['Memories'],
        summary: 'Получить воспоминания путешествия (с фильтрацией)',
      },
    })
    .input(GetMemoriesInputSchema)
    .output(z.array(MemorySchema))
    .query(async ({ input }) => {
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
      return memoryService.create(input, ctx.user.id)
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
      return memoryService.update(input, ctx.user.id)
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
      return memoryService.delete(input.id, ctx.user.id)
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
