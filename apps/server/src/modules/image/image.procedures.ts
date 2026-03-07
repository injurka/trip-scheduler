import { z } from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import {
  DeleteImageInputSchema,
  GetImageMetadataInputSchema,
  GetImagesByEntityInputSchema,
  GetImagesByTripIdInputSchema,
  TripImageSchema,
} from './image.schemas'
import { imageService } from './image.service'

export const imageProcedures = {
  listByTrip: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/images/by-trip/{tripId}',
        tags: ['Images'],
        summary: 'Получить изображения путешествия',
      },
    })
    .input(GetImagesByTripIdInputSchema)
    .output(z.array(TripImageSchema))
    .query(async ({ input }) => {
      return imageService.getByTripId(input.tripId, input.placement)
    }),

  listByEntity: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/images/list',
        tags: ['Images'],
        summary: 'Получить изображения по сущности',
      },
    })
    .input(GetImagesByEntityInputSchema)
    .output(z.array(TripImageSchema))
    .query(async ({ input }) => {
      return imageService.getByEntity(input.entityId, input.entityType, input.placement)
    }),

  getAll: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/images',
        tags: ['Images'],
        summary: 'Получить все изображения пользователя',
      },
    })
    .output(z.array(TripImageSchema))
    .query(async ({ ctx }) => {
      return imageService.getAll(ctx.user.id)
    }),

  getMetadata: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/images/{id}/metadata',
        tags: ['Images'],
        summary: 'Получить метаданные изображения',
      },
    })
    .input(GetImageMetadataInputSchema)
    .output(z.any().nullable())
    .query(async ({ input }) => {
      return imageService.getMetadata(input.id)
    }),

  delete: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/images/{id}',
        tags: ['Images'],
        summary: 'Удалить изображение',
      },
    })
    .input(DeleteImageInputSchema)
    .output(z.object({ success: z.boolean(), id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return imageService.delete(input.id, ctx.user.id)
    }),
}
