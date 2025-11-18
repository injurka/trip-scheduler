import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import { DeleteImageInputSchema, GetImagesByTripIdInputSchema } from './image.schemas'
import { imageService } from './image.service'

export const imageProcedures = {
  listByTrip: publicProcedure
    .input(GetImagesByTripIdInputSchema)
    .query(async ({ input }) => {
      return imageService.getByTripId(input.tripId, input.placement)
    }),

  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      return imageService.getAll(ctx.user.id)
    }),

  delete: protectedProcedure
    .input(DeleteImageInputSchema)
    .mutation(async ({ input, ctx }) => {
      return imageService.delete(input.id, ctx.user.id)
    }),
}
