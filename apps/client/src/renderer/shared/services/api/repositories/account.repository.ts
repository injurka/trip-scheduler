import type { IAccountRepository } from '../model/types'
import type { Plan } from '~/shared/types/models/trip'
import { trpc } from '~/shared/services/trpc/trpc.service'

export class AccountRepository implements IAccountRepository {
  async listPlans(): Promise<Plan[]> {
    const result = await trpc.account.listPlans.query()
    return result as Plan[]
  }
}
