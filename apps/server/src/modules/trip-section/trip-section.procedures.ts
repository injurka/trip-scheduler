import { protectedProcedure } from '~/lib/trpc'
import {
  CreateTripSectionInputSchema,
  DeleteTripSectionInputSchema,
  ReorderTripSectionsInputSchema,
  UpdateTripSectionInputSchema,
} from './trip-section.schemas'
import { tripSectionService } from './trip-section.service'

export const tripSectionProcedures = {
  create: protectedProcedure
    .input(CreateTripSectionInputSchema)
    .mutation(({ input, ctx }) => tripSectionService.create(input, ctx.user.id)),

  update: protectedProcedure
    .input(UpdateTripSectionInputSchema)
    .mutation(({ input, ctx }) => tripSectionService.update(input, ctx.user.id)),

  delete: protectedProcedure
    .input(DeleteTripSectionInputSchema)
    .mutation(({ input, ctx }) => tripSectionService.delete(input.id, ctx.user.id)),

  reorder: protectedProcedure
    .input(ReorderTripSectionsInputSchema)
    .mutation(({ input, ctx }) => tripSectionService.reorder(input, ctx.user.id)),
}
