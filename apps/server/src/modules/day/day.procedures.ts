import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import {
  CreateDayInputSchema,
  DeleteDayInputSchema,
  GetDayByIdInputSchema,
  UpdateDayInputSchema,
} from './day.schemas'
import { dayService } from './day.service'

export const dayProcedures = {
  getByTripId: publicProcedure
    .input(GetDayByIdInputSchema)
    .query(async ({ input }) => {
      return dayService.getByTripId(input.tripId)
    }),

  create: protectedProcedure
    .input(CreateDayInputSchema)
    .mutation(async ({ input, ctx }) => {
      return dayService.create(input, ctx.user.id)
    }),

  update: protectedProcedure
    .input(UpdateDayInputSchema)
    .mutation(async ({ input, ctx }) => {
      return dayService.update(input.id, input.details, ctx.user.id)
    }),

  delete: protectedProcedure
    .input(DeleteDayInputSchema)
    .mutation(async ({ input, ctx }) => {
      return dayService.delete(input.id, ctx.user.id)
    }),
}
