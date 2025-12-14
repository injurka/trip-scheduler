import { z } from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import { ActivitySchema } from '../activity/activity.schemas'
import {
  CreateDayInputSchema,
  DaySchema,
  DeleteDayInputSchema,
  GetDayByIdInputSchema,
  GetDayNoteInputSchema,
  UpdateDayInputSchema,
} from './day.schemas'
import { dayService } from './day.service'

const DayWithActivitiesSchema = DaySchema.extend({
  activities: z.array(ActivitySchema),
})

export const dayProcedures = {
  getByTripId: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/days/by-trip/{tripId}',
        tags: ['Days'],
        summary: 'Получить дни путешествия',
      },
    })
    .input(GetDayByIdInputSchema)
    .output(z.array(DayWithActivitiesSchema))
    .query(async ({ input }) => {
      return dayService.getByTripId(input.tripId)
    }),

  getNote: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/days/{dayId}/note',
        tags: ['Days'],
        summary: 'Получить заметку дня',
      },
    })
    .input(GetDayNoteInputSchema)
    .output(z.string().nullable())
    .query(async ({ input }) => {
      return dayService.getNote(input.dayId)
    }),

  create: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/days',
        tags: ['Days'],
        summary: 'Создать день',
      },
    })
    .input(CreateDayInputSchema)
    .output(DayWithActivitiesSchema)
    .mutation(async ({ input, ctx }) => {
      return dayService.create(input, ctx.user.id)
    }),

  update: protectedProcedure
    .meta({
      openapi: {
        method: 'PATCH',
        path: '/days/{id}',
        tags: ['Days'],
        summary: 'Обновить день',
      },
    })
    .input(UpdateDayInputSchema)
    .output(DaySchema)
    .mutation(async ({ input, ctx }) => {
      return dayService.update(input.id, input.details, ctx.user.id)
    }),

  delete: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/days/{id}',
        tags: ['Days'],
        summary: 'Удалить день',
      },
    })
    .input(DeleteDayInputSchema)
    .output(DaySchema)
    .mutation(async ({ input, ctx }) => {
      return dayService.delete(input.id, ctx.user.id)
    }),
}
