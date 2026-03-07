import type { IUserRepository } from '../model/types'
import type { User } from '~/shared/types/models/auth'
import type { Plan } from '~/shared/types/models/trip'
import { trpc } from '~/shared/services/trpc/trpc.service'

export class UserRepository implements IUserRepository {
  async getById(id: string): Promise<User> {
    const result = await trpc.user.getById.query({ id })
    return result as User
  }

  async listPlans(): Promise<Plan[]> {
    const result = await trpc.user.listPlans.query()
    return result as Plan[]
  }
}
