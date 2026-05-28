import type { IUserRepository } from '../model/types'
import type { User } from '~/shared/types/models/auth'
import type { Plan } from '~/shared/types/models/trip'
import type { CreateHighlightInput, Highlight } from '~/shared/types/models/user'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { throttle } from '../lib/decorators'

export class UserRepository implements IUserRepository {
  @throttle(300)
  async getById(id: string): Promise<User> {
    const result = await trpc.user.getById.query({ id })
    return result as User
  }

  @throttle(300)
  async listPlans(): Promise<Plan[]> {
    const result = await trpc.user.listPlans.query()
    return result as Plan[]
  }

  @throttle(300)
  async search(query: string): Promise<{ id: string, name: string, email: string | null, avatarUrl: string | null }[]> {
    const result = await trpc.user.search.query({ query })
    return result as { id: string, name: string, email: string | null, avatarUrl: string | null }[]
  }

  @throttle(500)
  async getHighlights(userId: string, limit: number, page: number, filters?: { cities?: string[], startDate?: string, endDate?: string }): Promise<{ items: Highlight[], total: number }> {
    const result = await trpc.user.getHighlights.query({ userId, limit, page, ...filters })
    return result as { items: Highlight[], total: number }
  }

  @throttle(500)
  async getHighlightCities(userId: string): Promise<string[]> {
    const result = await trpc.user.getHighlightCities.query({ userId })
    return result as string[]
  }

  @throttle(500)
  async createHighlight(data: CreateHighlightInput): Promise<Highlight> {
    const result = await trpc.user.createHighlight.mutate(data)
    return result as Highlight
  }

  @throttle(500)
  async deleteHighlight(id: string): Promise<void> {
    await trpc.user.deleteHighlight.mutate({ id })
  }
}
