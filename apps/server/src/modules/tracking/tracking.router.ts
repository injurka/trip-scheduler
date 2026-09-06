import { router } from '~/lib/trpc'
import { trackingProcedures } from './tracking.procedures'

export const trackingRouter = router(trackingProcedures)
