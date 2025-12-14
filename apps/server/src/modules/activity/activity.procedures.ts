import { protectedProcedure } from '~/lib/trpc'
import {
  ActivitySchema,
  CreateActivityInputSchema,
  DeleteActivityInputSchema,
  UpdateActivityInputSchema,
} from './activity.schemas'
import { activityService } from './activity.service'

export const activityProcedures = {
  create: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/activities',
        tags: ['Activities'],
        summary: 'Создать активность',
      },
    })
    .input(CreateActivityInputSchema)
    .output(ActivitySchema)
    .mutation(async ({ input, ctx }) => {
      return activityService.create(input, ctx.user.id.toString())
    }),

  update: protectedProcedure
    .meta({
      openapi: {
        method: 'PATCH',
        path: '/activities/{id}',
        tags: ['Activities'],
        summary: 'Обновить активность',
      },
    })
    .input(UpdateActivityInputSchema)
    .output(ActivitySchema)
    .mutation(async ({ input, ctx }) => {
      return activityService.update(input, ctx.user.id.toString())
    }),

  delete: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/activities/{id}',
        tags: ['Activities'],
        summary: 'Удалить активность',
      },
    })
    .input(DeleteActivityInputSchema)
    .output(ActivitySchema)
    .mutation(async ({ input, ctx }) => {
      return activityService.delete(input.id, ctx.user.id.toString())
    }),
}
