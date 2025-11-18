import { router } from '~/lib/trpc'
import { communityProcedures } from './community.procedures'

export const communityRouter = router(communityProcedures)
