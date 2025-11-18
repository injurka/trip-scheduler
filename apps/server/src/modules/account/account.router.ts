import { router } from '~/lib/trpc'
import { accountProcedures } from './account.procedures'

export const accountRouter = router(accountProcedures)
