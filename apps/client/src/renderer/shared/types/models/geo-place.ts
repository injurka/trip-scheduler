export type GeoPlaceKind = 'settlement' | 'island' | 'area'
export type GeoResolutionStatus = 'resolved' | 'unresolved' | 'needs_review'

export interface GeoPlaceRef {
  id: string
  name: string
  countryId: string | null
  countryCode: string
  countryName: string
  regionName: string | null
  kind: GeoPlaceKind
  latitude: number
  longitude: number
  timezone: string | null
  retired: boolean
}

export interface GeoPlaceSearchResult extends GeoPlaceRef {
  matchedName: string
}

export interface GeoCatalogStatus {
  ready: boolean
  version: string | null
  publishedAt: string | null
  placeCount: number
}

export interface GeoResolutionCandidate {
  place: GeoPlaceRef
  score: number
  matchedName: string
}

export interface GeoResolutionResult {
  status: GeoResolutionStatus
  reason: string
  place: GeoPlaceRef | null
  candidates: GeoResolutionCandidate[]
  provenance: Record<string, unknown>
}

export interface TripCityRef extends GeoPlaceRef {
  position: number
}

export interface UnresolvedTripCity {
  position: number
  label: string
  status: Exclude<GeoResolutionStatus, 'resolved'>
}
