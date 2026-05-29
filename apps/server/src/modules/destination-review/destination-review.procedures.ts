import { z } from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import {
  CountrySchema,
  CreateReviewInputSchema,
  DeleteReviewInputSchema,
  DestinationReviewSchema,
  GetUserReviewsInputSchema,
  UpdateReviewInputSchema,
} from './destination-review.schemas'
import { destinationReviewService } from './destination-review.service'

export const destinationReviewProcedures = {
  getCountries: publicProcedure
    .meta({
      openapi: { method: 'GET', path: '/destination-reviews/countries', tags: ['Destination Reviews'], summary: 'Получить справочник стран' },
    })
    .output(z.array(CountrySchema))
    .query(async () => {
      return destinationReviewService.getCountries()
    }),

  getReviewCities: publicProcedure
    .meta({
      openapi: { method: 'GET', path: '/destination-reviews/user/{userId}/cities', tags: ['Destination Reviews'], summary: 'Получить список городов из отзывов' },
    })
    .input(z.object({ userId: z.string().uuid() }))
    .output(z.array(z.string()))
    .query(async ({ input }) => {
      return destinationReviewService.getReviewCities(input.userId)
    }),

  getUserReviews: publicProcedure
    .meta({
      openapi: { method: 'GET', path: '/destination-reviews/user', tags: ['Destination Reviews'], summary: 'Получить впечатления пользователя (пагинировано)' },
    })
    .input(GetUserReviewsInputSchema)
    .output(z.object({ items: z.array(DestinationReviewSchema), total: z.number() }))
    .query(async ({ input }) => {
      return destinationReviewService.getUserReviews(input)
    }),

  create: protectedProcedure
    .meta({
      openapi: { method: 'POST', path: '/destination-reviews', tags: ['Destination Reviews'], summary: 'Создать впечатление' },
    })
    .input(CreateReviewInputSchema)
    .output(DestinationReviewSchema)
    .mutation(async ({ input, ctx }) => {
      return destinationReviewService.create(input, ctx.user.id)
    }),

  update: protectedProcedure
    .meta({
      openapi: { method: 'PATCH', path: '/destination-reviews/{id}', tags: ['Destination Reviews'], summary: 'Обновить впечатление' },
    })
    .input(UpdateReviewInputSchema)
    .output(DestinationReviewSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input
      return destinationReviewService.update(id, data, ctx.user.id)
    }),

  delete: protectedProcedure
    .meta({
      openapi: { method: 'DELETE', path: '/destination-reviews/{id}', tags: ['Destination Reviews'], summary: 'Удалить впечатление' },
    })
    .input(DeleteReviewInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      return destinationReviewService.delete(input.id, ctx.user.id)
    }),
}
