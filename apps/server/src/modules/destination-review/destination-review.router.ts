import { router } from '~/lib/trpc'
import { destinationReviewProcedures } from './destination-review.procedures'

export const destinationReviewRouter = router(destinationReviewProcedures)
