import { router } from '~/lib/trpc'
import { dayProcedures } from './day.procedures'

export const dayRouter = router(dayProcedures)
