import type { z } from 'zod'
import type { ImportMetroSystemInputSchema } from './metro.schemas'
import { createTRPCError } from '~/lib/trpc'
import { metroRepository } from './metro.repository'

export const metroService = {
  async listSystems() {
    return metroRepository.findSystems()
  },

  async getDetails(systemId: string) {
    const details = await metroRepository.findSystemWithDetails(systemId)
    if (!details)
      throw createTRPCError('NOT_FOUND', `Система метро с ID ${systemId} не найдена.`)

    return details
  },

  async importSystem(data: z.infer<typeof ImportMetroSystemInputSchema>) {
    return metroRepository.importSystem(data)
  },
}
