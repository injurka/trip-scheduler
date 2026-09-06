import type { MapRoute } from '~/components/03.domain/trip-info/geolocation-section/models/types'
import Feature from 'ol/Feature'
import GPX from 'ol/format/GPX'
import LineString from 'ol/geom/LineString'

/**
 * Экспорт маршрута путешествия в стандартный файл формата GPX
 * для навигаторов (Garmin, OsmAnd, Komoot, Maps.me)
 */
export function exportRouteToGpx(route: MapRoute): void {
  if (!route.geometry || route.geometry.length === 0)
    return

  const gpxFormat = new GPX()
  // Геометрия маршрута уже хранится в WGS84 [lon, lat]
  const lineString = new LineString(route.geometry)
  const feature = new Feature({
    geometry: lineString,
    name: route.title || 'Маршрут',
  })
  feature.set('name', route.title || 'Маршрут')

  const gpxData = gpxFormat.writeFeatures([feature], {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:4326',
  })

  const blob = new Blob([gpxData], { type: 'application/gpx+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${(route.title || 'route').trim().replace(/[\s/]/g, '_')}.gpx`
  link.click()
  URL.revokeObjectURL(url)
}
