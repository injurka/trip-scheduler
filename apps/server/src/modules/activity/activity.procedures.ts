import { protectedProcedure } from '~/lib/trpc'
import {
  CreateActivityInputSchema,
  DeleteActivityInputSchema,
  UpdateActivityInputSchema,
} from './activity.schemas'
import { activityService } from './activity.service'

export const activityProcedures = {
  create: protectedProcedure
    .input(CreateActivityInputSchema)
    .mutation(async ({ input, ctx }) => {
      return activityService.create(input, ctx.user.id)
    }),

  update: protectedProcedure
    .input(UpdateActivityInputSchema)
    .mutation(async ({ input, ctx }) => {
      return activityService.update(input, ctx.user.id)
    }),

  delete: protectedProcedure
    .input(DeleteActivityInputSchema)
    .mutation(async ({ input, ctx }) => {
      return activityService.delete(input.id, ctx.user.id)
    }),
}
