import type { TileSourceId } from './map-styles-sources'
import type { TripWithDays } from '~/shared/types/models/trip'
import { calculateTripBoundingBox } from './tile-calc'

export interface OfflineMapOptions {
  areaIds?: string[]
  maxZoom?: 10 | 12 | 15
  style?: TileSourceId
  terrain?: boolean
  refresh?: boolean
}

export interface OfflineMapArea {
  id: string
  title: string
  trip: TripWithDays
}

export interface OfflineMapCoverage {
  areaId: string
  title: string
  maxZoom: number
  style: TileSourceId
  terrain: boolean
  savedAt: number
}

export function getOfflineMapAreas(trip: TripWithDays): OfflineMapArea[] {
  const areas: OfflineMapArea[] = []
  const common = { ...trip, days: [] }

  if (calculateTripBoundingBox(common))
    areas.push({ id: 'common', title: 'Общие точки поездки', trip: common })

  for (const [index, day] of (trip.days ?? []).entries()) {
    const part = { ...trip, sections: [], days: [day] }

    if (calculateTripBoundingBox(part))
      areas.push({ id: day.id, title: `День ${index + 1}: ${day.title || day.date || 'Маршрут'}`, trip: part })
  }

  return areas
}

export function getSelectedMapAreas(trip: TripWithDays, options: OfflineMapOptions): OfflineMapArea[] {
  const selected = options.areaIds ? new Set(options.areaIds) : null

  return getOfflineMapAreas(trip).filter(area => !selected || selected.has(area.id))
}

export function getOfflineMapStyle(): TileSourceId {
  try {
    const source: unknown = JSON.parse(localStorage.getItem('app-settings-active-tile-source') || '"maptilerStreets"')

    if (source === 'osm' || source === 'custom' || source === 'satellite' || source === 'maptilerOutdoor')
      return source
  }
  catch {
    // Use the default style when settings are absent or malformed.
  }

  return 'maptilerStreets'
}
