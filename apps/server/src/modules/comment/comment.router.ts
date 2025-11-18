import { router } from '~/lib/trpc'
import { commentProcedures } from './comment.procedures'

export const commentRouter = router(commentProcedures)
