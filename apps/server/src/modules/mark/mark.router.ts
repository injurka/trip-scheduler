import { router } from '~/lib/trpc'
import { markProcedures } from './mark.procedures'

export const markRouter = router(markProcedures)
