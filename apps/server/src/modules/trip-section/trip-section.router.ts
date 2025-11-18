import { router } from '~/lib/trpc'
import { tripSectionProcedures } from './trip-section.procedures'

export const tripSectionRouter = router(tripSectionProcedures)
