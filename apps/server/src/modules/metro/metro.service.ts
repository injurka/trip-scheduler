import type { z } from 'zod'
import type { ImportMetroSystemInputSchema } from './metro.schemas'
import { metroRepository } from '~/repositories/metro.repository'

export const metroService = {
  async listSystems() {
    return metroRepository.findSystems()
  },

  async getDetails(systemId: string) {
    return metroRepository.findSystemWithDetails(systemId)
  },

  async importSystem(data: z.infer<typeof ImportMetroSystemInputSchema>) {
    return metroRepository.importSystem(data)
  },
}
