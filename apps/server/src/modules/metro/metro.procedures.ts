import { publicProcedure } from '~/lib/trpc'
import { GetMetroSystemDetailsInputSchema } from './metro.schemas'
import { metroService } from './metro.service'

export const metroProcedures = {
  listSystems: publicProcedure
    .query(async () => {
      return metroService.listSystems()
    }),

  getDetails: publicProcedure
    .input(GetMetroSystemDetailsInputSchema)
    .query(async ({ input }) => {
      return metroService.getDetails(input.systemId)
    }),
}
