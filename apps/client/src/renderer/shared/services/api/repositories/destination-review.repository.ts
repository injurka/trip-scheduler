import type { DestinationMapPoint, GetUserReviewsParams, IDestinationReviewRepository } from '../model/types'
import type { Country, CreateDestinationReviewInput, DestinationReview } from '~/shared/types/models/destination-review'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { throttle } from '../lib/decorators'

export class DestinationReviewRepository implements IDestinationReviewRepository {
  @throttle(500)
  async getCountries(): Promise<Country[]> {
    return await trpc.destinationReview.getCountries.query()
  }

  @throttle(500)
  async getReviewCities(userId: string): Promise<string[]> {
    return await trpc.destinationReview.getReviewCities.query({ userId })
  }

  @throttle(500)
  async getMapPoints(userId: string): Promise<DestinationMapPoint[]> {
    return await trpc.destinationReview.getMapPoints.query({ userId }) as DestinationMapPoint[]
  }

  @throttle(500)
  async getUserReviews(params: GetUserReviewsParams): Promise<{ items: DestinationReview[], total: number }> {
    const result = await trpc.destinationReview.getUserReviews.query(params)
    return result as { items: DestinationReview[], total: number }
  }

  @throttle(500)
  async create(data: CreateDestinationReviewInput): Promise<DestinationReview> {
    return await trpc.destinationReview.create.mutate(data)
  }

  @throttle(500)
  async update(params: { id: string } & Partial<CreateDestinationReviewInput>): Promise<DestinationReview> {
    return await trpc.destinationReview.update.mutate(params)
  }

  @throttle(500)
  async delete(params: { id: string }): Promise<void> {
    await trpc.destinationReview.delete.mutate(params)
  }
}
