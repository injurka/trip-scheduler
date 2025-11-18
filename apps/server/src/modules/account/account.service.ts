import { db } from '~/../db'

export const accountService = {
  async listPlans() {
    return await db.query.plans.findMany()
  },
}
