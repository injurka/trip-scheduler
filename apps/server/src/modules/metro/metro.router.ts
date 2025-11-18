import { router } from '~/lib/trpc'
import { metroProcedures } from './metro.procedures'

export const metroRouter = router(metroProcedures)
