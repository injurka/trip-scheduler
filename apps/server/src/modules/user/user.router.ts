import { router } from '~/lib/trpc'
import { userProcedures } from './user.procedures'

export const userRouter = router(userProcedures)
