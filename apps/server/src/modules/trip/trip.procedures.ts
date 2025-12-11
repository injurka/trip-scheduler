import z from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import {
  CreateTripInputSchema,
  GetTripByIdInputSchema,
  ListTripsByUserInputSchema,
  ListTripsInputSchema,
  RateTripInputSchema,
  TripSchema,
  TripWithDaysSchema,
  UpdateTripInputSchema,
} from './trip.schemas'
import { tripService } from './trip.service'

export const tripProcedures = {
  list: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trips',
        tags: ['Trips'],
        summary: 'Получить список путешествий (фильтрация, поиск)',
      },
    })
    .input(ListTripsInputSchema)
    .output(z.array(TripSchema))
    .query(async ({ input, ctx }) => {
      return tripService.getAll(input, ctx.user?.id)
    }),

  listByUser: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trips/user',
        tags: ['Trips'],
        summary: 'Получить список путешествий конкретного пользователя',
      },
    })
    .input(ListTripsByUserInputSchema)
    .output(z.array(TripSchema))
    .query(async ({ input }) => {
      return tripService.listByUser(input.userId, input.limit)
    }),

  getUniqueCities: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trips/cities',
        tags: ['Trips'],
        summary: 'Получить список всех уникальных городов',
      },
    })
    .output(z.array(z.string()))
    .query(async () => {
      return tripService.getUniqueCities()
    }),

  getUniqueTags: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trips/tags',
        tags: ['Trips'],
        summary: 'Получить список всех уникальных тегов',
      },
    })
    .input(z.object({ query: z.string().optional() }))
    .output(z.array(z.string()))
    .query(async ({ input }) => {
      return tripService.getUniqueTags(input.query)
    }),

  getById: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trips/{tripId}',
        tags: ['Trips'],
        summary: 'Получить путешествие по ID',
      },
    })
    .input(GetTripByIdInputSchema)
    .output(TripSchema)
    .query(async ({ input, ctx }) => {
      return tripService.getById(input.tripId, ctx.user?.id)
    }),

  getByIdWithDays: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/trips/{tripId}/details',
        tags: ['Trips'],
        summary: 'Получить полное путешествие с днями и активностями',
      },
    })
    .input(GetTripByIdInputSchema)
    .output(TripWithDaysSchema)
    .query(async ({ input, ctx }) => {
      return tripService.getByIdWithDays(input.tripId, ctx.user?.id)
    }),

  create: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trips',
        tags: ['Trips'],
        summary: 'Создать новое путешествие',
        protect: true,
      },
    })
    .input(CreateTripInputSchema)
    .output(TripSchema)
    .mutation(async ({ input, ctx }) => {
      return tripService.create(input, ctx.user.id)
    }),

  update: protectedProcedure
    .meta({
      openapi: {
        method: 'PATCH',
        path: '/trips/{id}',
        tags: ['Trips'],
        summary: 'Обновить данные путешествия',
        protect: true,
      },
    })
    .input(UpdateTripInputSchema)
    .output(TripSchema)
    .mutation(async ({ input, ctx }) => {
      return tripService.update(input.id, input.details, ctx.user.id, ctx.user.role)
    }),

  delete: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/trips/{tripId}',
        tags: ['Trips'],
        summary: 'Удалить путешествие',
        protect: true,
      },
    })
    .input(GetTripByIdInputSchema)
    .output(TripSchema.omit({ participants: true }))
    .mutation(async ({ input, ctx }) => {
      return tripService.delete(input.tripId, ctx.user.id, ctx.user.role)
    }),

  rate: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/trips/rate',
        tags: ['Trips'],
        summary: 'Оценить путешествие',
        protect: true,
      },
    })
    .input(RateTripInputSchema)
    .output(z.object({ success: z.boolean(), userRating: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await tripService.rateTrip(input.tripId, ctx.user.id, input.rating)
      return { success: true, userRating: input.rating }
    }),
}
