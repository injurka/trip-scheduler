import type { z } from 'zod'
import type { CreateCommunityInputSchema, ListCommunitiesInputSchema } from './community.schemas'
import { communityRepository } from '~/repositories/community.repository'

export const communityService = {
  async create(data: z.infer<typeof CreateCommunityInputSchema>, ownerId: string) {
    return await communityRepository.create(data, ownerId)
  },

  async listPublic(filters?: z.infer<typeof ListCommunitiesInputSchema>) {
    return await communityRepository.findManyPublic(filters)
  },

  async listByUserId(userId: string, filters?: z.infer<typeof ListCommunitiesInputSchema>) {
    return await communityRepository.findManyByUserId(userId, filters)
  },

  async getById(id: string) {
    return await communityRepository.findById(id)
  },
}
