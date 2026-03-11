import { router } from '~/lib/trpc'
import { noteProcedures } from './note.procedures'

export const noteRouter = router(noteProcedures)
