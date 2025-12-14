import { z } from 'zod'
import { protectedProcedure } from '~/lib/trpc'
import {
  CreateTripSectionInputSchema,
  DeleteTripSectionInputSchema,
  ReorderTripSectionsInputSchema,
  TripSectionSchema,
  UpdateTripSectionInputSchema,
} from './trip-section.schemas'
import { tripSectionService } from './trip-section.service'

export const tripSectionProcedures = {
  create: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trip-sections',
        tags: ['Trip Sections'],
        summary: 'Создать раздел путешествия',
      },
    })
    .input(CreateTripSectionInputSchema)
    .output(TripSectionSchema)
    .mutation(({ input, ctx }) => tripSectionService.create(input, ctx.user.id.toString())),

  update: protectedProcedure
    .meta({
      openapi: {
        method: 'PATCH',
        path: '/trip-sections/{id}',
        tags: ['Trip Sections'],
        summary: 'Обновить раздел путешествия',
      },
    })
    .input(UpdateTripSectionInputSchema)
    .output(TripSectionSchema)
    .mutation(({ input, ctx }) => tripSectionService.update(input, ctx.user.id.toString())),

  delete: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/trip-sections/{id}',
        tags: ['Trip Sections'],
        summary: 'Удалить раздел путешествия',
      },
    })
    .input(DeleteTripSectionInputSchema)
    .output(TripSectionSchema)
    .mutation(({ input, ctx }) => tripSectionService.delete(input.id, ctx.user.id.toString())),

  reorder: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trip-sections/reorder',
        tags: ['Trip Sections'],
        summary: 'Изменить порядок разделов',
      },
    })
    .input(ReorderTripSectionsInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(({ input, ctx }) => tripSectionService.reorder(input, ctx.user.id.toString())),
}
