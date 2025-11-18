import { publicProcedure } from '~/lib/trpc'
import { accountService } from './account.service'

export const accountProcedures = {
  listPlans: publicProcedure
    .query(async () => {
      return accountService.listPlans()
    }),
}
