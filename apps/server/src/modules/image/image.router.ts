import { router } from '~/lib/trpc'
import { imageProcedures } from './image.procedures'

export const imageRouter = router(imageProcedures)
