import { router } from '~/lib/trpc'
import { tripProcedures } from './trip.procedures'

export const tripRouter = router(tripProcedures)
