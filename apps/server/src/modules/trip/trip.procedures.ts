import z from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import {
  CreateTripInputSchema,
  GetTripByIdInputSchema,
  ListTripsByUserInputSchema,
  ListTripsInputSchema,
  UpdateTripInputSchema,
} from './trip.schemas'
import { tripService } from './trip.service'

export const tripProcedures = {
  list: publicProcedure
    .input(ListTripsInputSchema)
    .query(async ({ input, ctx }) => {
      return tripService.getAll(input, ctx.user?.id)
    }),

  listByUser: publicProcedure
    .input(ListTripsByUserInputSchema)
    .query(async ({ input }) => {
      return tripService.listByUser(input.userId, input.limit)
    }),

  getById: publicProcedure
    .input(GetTripByIdInputSchema)
    .query(async ({ input }) => {
      return tripService.getById(input.tripId)
    }),

  getByIdWithDays: publicProcedure
    .input(GetTripByIdInputSchema)
    .query(async ({ input }) => {
      return tripService.getByIdWithDays(input.tripId)
    }),

  create: protectedProcedure
    .input(CreateTripInputSchema)
    .mutation(async ({ input, ctx }) => {
      return tripService.create(input, ctx.user.id)
    }),

  update: protectedProcedure
    .input(UpdateTripInputSchema)
    .mutation(async ({ input, ctx }) => {
      return tripService.update(input.id, input.details, ctx.user.id)
    }),

  delete: protectedProcedure
    .input(GetTripByIdInputSchema)
    .mutation(async ({ input, ctx }) => {
      return tripService.delete(input.tripId, ctx.user.id)
    }),

  getUniqueCities: publicProcedure
    .query(async () => {
      return tripService.getUniqueCities()
    }),

  getUniqueTags: publicProcedure
    .input(z.object({ query: z.string().optional() }))
    .query(async ({ input }) => {
      return tripService.getUniqueTags(input.query)
    }),
}
