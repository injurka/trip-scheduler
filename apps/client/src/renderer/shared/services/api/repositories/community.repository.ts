import type { ICommunityRepository } from '../model/types'
import type { Community, CreateCommunityInput, ListCommunitiesInput } from '~/shared/types/models/community'
import { trpc } from '~/shared/services/trpc/trpc.service'

export class CommunityRepository implements ICommunityRepository {
  async create(data: CreateCommunityInput): Promise<Community> {
    const result = await trpc.community.create.mutate(data)
    return result as Community
  }

  async list(filters: ListCommunitiesInput): Promise<Community[]> {
    const result = await trpc.community.list.query(filters)
    return result as Community[]
  }

  async getById(id: string): Promise<Community | null> {
    const result = await trpc.community.getById.query({ id })
    return result as Community | null
  }
}
