import { router } from '~/lib/trpc'
import { memoryProcedures } from './memory.procedures'

export const memoryRouter = router(memoryProcedures)
