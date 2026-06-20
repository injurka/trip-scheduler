import { z } from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import { ActivitySchema } from '../activity/activity.schemas'
import {
  CreateDayInputSchema,
  DaySchema,
  DeleteDayInputSchema,
  GenerateDayNoteInputSchema,
  GenerateTemplateInputSchema,
  GetDayByIdInputSchema,
  GetDayNoteInputSchema,
  UpdateDayInputSchema,
} from './day.schemas'
import { dayService } from './day.service'
import { canvasGenerationService } from '~/services/llm/canvas-generation.service'
import { templateGenerationService } from '~/services/llm/template-generation.service'

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

  generateNote: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/days/{dayId}/generate-note',
        tags: ['Days'],
        summary: 'Сгенерировать заметку дня через ИИ',
      },
    })
    .input(GenerateDayNoteInputSchema)
    .output(z.string())
    .mutation(async ({ input, ctx }) => {
      const day = await dayService.getByIdForGeneration(input.dayId, ctx.user.id, ctx.user.role)
      let contextStr = undefined

      if (input.useContext) {
        const allDays = await dayService.getByTripId(day.tripId)
        contextStr = allDays
          .map(d => `День ${new Date(d.date).toLocaleDateString('ru-RU')}: ${d.note || 'нет описания'}`)
          .join('\n')
      }

      return canvasGenerationService.generateDayNote(ctx.user.id, input.prompt, contextStr)
    }),

  generateTemplate: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/days/{dayId}/generate-template',
        tags: ['Days'],
        summary: 'Сгенерировать изменения для шаблонного вида',
      },
    })
    .input(GenerateTemplateInputSchema)
    .output(z.array(z.any()))
    .mutation(async ({ input, ctx }) => {
      await dayService.getByIdForGeneration(input.dayId, ctx.user.id, ctx.user.role)
      return templateGenerationService.generateTemplate(ctx.user.id, input.currentActivities, input.prompt, input.canvasNote, input.daysContext)
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
      return dayService.create(input, ctx.user.id, ctx.user.role)
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
      return dayService.update(input.id, input.details, ctx.user.id, ctx.user.role)
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
      return dayService.delete(input.id, ctx.user.id, ctx.user.role)
    }),
}
