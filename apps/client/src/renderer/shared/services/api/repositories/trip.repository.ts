import type { ITripRepository, TripListFilters } from '../model/types'
import type { CreateTripInput, Trip, TripWeatherData, TripWithDays, UpdateTripInput } from '~/shared/types/models/trip'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { throttle } from '../lib/decorators'
import { normalizeTrip, normalizeTripWithDays } from '../lib/normalize-models'

const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

class TripRepository implements ITripRepository {
  @throttle(500)
  async getAll(filters?: TripListFilters): Promise<Trip[]> {
    return (await trpc.trip.list.query(filters)).map(normalizeTrip)
  }

  @throttle(500)
  async getById(id: string): Promise<Trip | null> {
    return normalizeTrip(await trpc.trip.getById.query({ tripId: id }))
  }

  @throttle(500)
  async getByIdWithDays(tripId: string): Promise<TripWithDays | null> {
    if (!UUID_PATTERN.test(tripId)) {
      return normalizeTripWithDays(await trpc.trip.getByShareSlug.query({ slug: tripId }))
    }

    return normalizeTripWithDays(await trpc.trip.getByIdWithDays.query({ tripId }))
  }

  @throttle(500)
  async getOrCreateShareSlug(tripId: string): Promise<string> {
    return await trpc.trip.getOrCreateShareSlug.mutate({ tripId })
  }

  async isShareSlugAvailable(tripId: string, slug: string): Promise<boolean> {
    return await trpc.trip.checkShareSlugAvailability.query({ tripId, slug })
  }

  @throttle(500)
  async create(data: CreateTripInput): Promise<Trip> {
    return normalizeTrip(await trpc.trip.create.mutate(data))
  }

  @throttle(500)
  async update(id: string, details: UpdateTripInput): Promise<Trip> {
    return normalizeTrip(await trpc.trip.update.mutate({ id, details }))
  }

  @throttle(500)
  async delete(tripId: string): Promise<Trip> {
    return normalizeTrip(await trpc.trip.delete.mutate({ tripId }))
  }

  @throttle(400)
  async getUniqueTags(params: { query?: string }): Promise<string[]> {
    return await trpc.trip.getUniqueTags.query(params)
  }

  @throttle(500)
  async listByUser(params: { userId: string, limit: number }): Promise<Trip[]> {
    return (await trpc.trip.listByUser.query(params)).map(normalizeTrip)
  }

  @throttle(500)
  async addParticipant(tripId: string, userId: string): Promise<void> {
    await trpc.trip.addParticipant.mutate({ tripId, userId })
  }

  async generateWeather(params: { tripId: string, placeId?: string, placeIds?: string[], forceRefresh?: boolean }): Promise<{ weatherByPlaceId: TripWeatherData, fromCache: boolean }> {
    return await trpc.trip.generateWeather.mutate(params)
  }
}

export { TripRepository }
