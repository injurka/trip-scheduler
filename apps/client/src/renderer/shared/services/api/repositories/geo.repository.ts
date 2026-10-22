import type { IGeoRepository } from '../model/types'
import type { GeoPlaceKind, GeoPlaceRef, GeoPlaceSearchResult, GeoResolutionResult } from '~/shared/types/models/geo-place'
import { trpc } from '~/shared/services/trpc/trpc.service'

export class GeoRepository implements IGeoRepository {
  async getCatalogStatus() {
    return trpc.geo.catalogStatus.query()
  }

  async searchPlaces(params: {
    query: string
    countryId?: string
    countryCode?: string
    kinds?: GeoPlaceKind[]
    locale?: 'ru' | 'en'
    limit?: number
  }): Promise<GeoPlaceSearchResult[]> {
    return trpc.geo.searchPlaces.query(params)
  }

  async resolveCity(params: { label: string, countryId?: string, countryCode?: string, regionName?: string, kinds?: GeoPlaceKind[] }): Promise<GeoResolutionResult> {
    return trpc.geo.resolveCity.mutate(params)
  }

  async getPlacesByIds(ids: string[], locale: 'ru' | 'en' = 'ru'): Promise<GeoPlaceRef[]> {
    return trpc.geo.getPlacesByIds.mutate({ ids, locale })
  }
}
