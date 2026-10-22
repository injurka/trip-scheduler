import { router } from '~/lib/trpc'
import { geoProcedures } from './geo.procedures'

export const geoRouter = router(geoProcedures)
