import { metroRepository } from '~/repositories/metro.repository'

export const metroService = {
  async listSystems() {
    return metroRepository.findSystems()
  },

  async getDetails(systemId: string) {
    return metroRepository.findSystemWithDetails(systemId)
  },
}
