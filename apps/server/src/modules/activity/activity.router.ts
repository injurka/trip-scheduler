import { router } from '~/lib/trpc'
import { activityProcedures } from './activity.procedures'

export const activityRouter = router(activityProcedures)
