import { router } from '~/lib/trpc'
import { postProcedures } from './post.procedures'

export const postRouter = router(postProcedures)
