import { trpc } from '~/shared/services/trpc/trpc.service'

export const metroService = {
  listSystems: () => trpc.metro.listSystems.query(),
  getDetails: (systemId: string) => trpc.metro.getDetails.query({ systemId }),
}
