import type { ITripSectionRepository } from '~/shared/services/api/model/types'
import type { TripSection, TripSectionType } from '~/shared/types/models/trip'
import { trpc } from '~/shared/services/trpc/trpc.service'

export class TripSectionRepository implements ITripSectionRepository {
  async create(data: { tripId: string, type: TripSectionType, title: string, icon: string | null, content: any }): Promise<TripSection> {
    return await trpc.tripSection.create.mutate(data) as TripSection
  }

  async update(data: { id: string, title?: string | undefined, icon?: string | null | undefined, content?: any }): Promise<TripSection> {
    return await trpc.tripSection.update.mutate(data) as TripSection
  }

  async delete(id: string): Promise<TripSection> {
    return await trpc.tripSection.delete.mutate({ id }) as TripSection
  }
}
