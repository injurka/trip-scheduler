import type { ITripRepository, TripListFilters } from '../model/types'
import type { CreateTripInput, Trip, TripWithDays, UpdateTripInput } from '~/shared/types/models/trip'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { throttle } from '../lib/decorators'

class TripRepository implements ITripRepository {
  @throttle(500)
  async getAll(filters?: TripListFilters): Promise<Trip[]> {
    return await trpc.trip.list.query(filters) as Trip[]
  }

  @throttle(500)
  async getById(id: string): Promise<Trip | null> {
    return await trpc.trip.getById.query({ tripId: id }) as Trip | null
  }

  @throttle(500)
  async getByIdWithDays(tripId: string): Promise<TripWithDays | null> {
    return await trpc.trip.getByIdWithDays.query({ tripId }) as TripWithDays | null
  }

  @throttle(500)
  async create(data: CreateTripInput): Promise<Trip> {
    return await trpc.trip.create.mutate(data) as Trip
  }

  @throttle(500)
  async update(id: string, details: UpdateTripInput): Promise<Trip> {
    return await trpc.trip.update.mutate({ id, details }) as Trip
  }

  @throttle(500)
  async delete(tripId: string): Promise<Trip> {
    return await trpc.trip.delete.mutate({ tripId }) as unknown as Trip
  }

  @throttle(400)
  async getUniqueCities(): Promise<string[]> {
    return await trpc.trip.getUniqueCities.query()
  }

  @throttle(400)
  async getUniqueTags(params: { query?: string }): Promise<string[]> {
    return await trpc.trip.getUniqueTags.query(params)
  }

  @throttle(500)
  async listByUser(params: { userId: string, limit: number }): Promise<Trip[]> {
    return await trpc.trip.listByUser.query(params) as Trip[]
  }
}

export { TripRepository }
