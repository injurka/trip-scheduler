import type { IPlacesRepository } from '../model/types'
import type { Place, PlaceTag } from '~/shared/types/models/place'

export class PlacesRepository implements IPlacesRepository {
  async getPlacesByCity(_city: string, _filters?: { tags?: string[] }): Promise<Place[]> {
    console.warn('TRPC places.list not implemented, returning empty array.')
    return []
  }

  async getAvailableTags(_city: string): Promise<PlaceTag[]> {
    console.warn('TRPC places.getTags not implemented, returning empty array.')
    return []
  }
}
