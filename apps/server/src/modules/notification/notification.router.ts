import { router } from '~/lib/trpc'
import { notificationProcedures } from './notification.procedures'

export const notificationRouter = router(notificationProcedures)
