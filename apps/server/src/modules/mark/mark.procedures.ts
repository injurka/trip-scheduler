import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import { CreateMarkInputSchema, GetMarksInputSchema } from './mark.schemas'
import { markService } from './mark.service'

export const markProcedures = {
  list: publicProcedure
    .meta({ openapi: { method: 'POST', path: '/marks/list', tags: ['Marks'], summary: 'Получить метки' } })
    .input(GetMarksInputSchema)
    .query(async ({ input }) => {
      return markService.getMarks(input)
    }),

  create: protectedProcedure
    .meta({ openapi: { method: 'POST', path: '/marks', tags: ['Marks'], summary: 'Создать метку' } })
    .input(CreateMarkInputSchema)
    .mutation(async ({ input, ctx }) => {
      return markService.create(input, ctx.user.id)
    }),
}
