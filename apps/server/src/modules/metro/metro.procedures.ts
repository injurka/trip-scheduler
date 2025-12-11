import { z } from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import {
  GetMetroSystemDetailsInputSchema,
  ImportMetroSystemInputSchema,
  MetroSystemDetailsSchema,
  MetroSystemSchema,
} from './metro.schemas'
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

  import: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/metro/import',
        tags: ['Metro'],
        summary: 'Импортировать полную схему метро города',
        protect: true,
      },
    })
    .input(ImportMetroSystemInputSchema)
    .output(MetroSystemSchema)
    .mutation(async ({ input }) => {
      return metroService.importSystem(input)
    }),
}
