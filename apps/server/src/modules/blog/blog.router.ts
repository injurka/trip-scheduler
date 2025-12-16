import { router } from '~/lib/trpc'
import { blogProcedures } from './blog.procedures'

export const blogRouter = router(blogProcedures)
