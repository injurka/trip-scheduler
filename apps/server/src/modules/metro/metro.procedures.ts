import { z } from 'zod'
import { publicProcedure } from '~/lib/trpc'
import { GetMetroSystemDetailsInputSchema, MetroSystemDetailsSchema, MetroSystemSchema } from './metro.schemas'
import { metroService } from './metro.service'

export const metroProcedures = {
  listSystems: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/metro/systems',
        tags: ['Metro'],
        summary: 'Получить список систем метро',
      },
    })
    .output(z.array(MetroSystemSchema))
    .query(async () => {
      return metroService.listSystems()
    }),

  getDetails: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/metro/systems/{systemId}',
        tags: ['Metro'],
        summary: 'Получить детали системы метро (линии, станции)',
      },
    })
    .input(GetMetroSystemDetailsInputSchema)
    .output(MetroSystemDetailsSchema)
    .query(async ({ input }) => {
      return metroService.getDetails(input.systemId)
    }),
}
