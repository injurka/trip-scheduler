import type { GeoPlaceGetByIdsInput, GeoPlaceSearchInput, ResolveCityInput } from './geo.schemas'
import { geoRepository } from '~/repositories/geo.repository'

export const geoService = {
  getCatalogStatus() {
    return geoRepository.getCatalogStatus()
  },

  search(input: GeoPlaceSearchInput) {
    return geoRepository.search(input)
  },

  resolveExact(input: ResolveCityInput) {
    return geoRepository.resolveExact(input)
  },

  getByIds(input: GeoPlaceGetByIdsInput) {
    return geoRepository.getByIds(input)
  },
}
