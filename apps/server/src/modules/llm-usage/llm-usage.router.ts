import { router } from '~/lib/trpc'
import { llmUsageProcedures } from './llm-usage.procedures'

export const llmUsageRouter = router(llmUsageProcedures)
