import type { MapRoute } from '~/components/03.domain/trip-info/geolocation-section/models/types'

/**
 * Экспорт маршрута путешествия в стандартный файл формата GPX
 * для навигаторов (Garmin, OsmAnd, Komoot, Maps.me)
 */
export function exportRouteToGpx(route: MapRoute): void {
  if (!route.geometry || route.geometry.length === 0)
    return

  const escapeXml = (str: string) =>
    str.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;'
        case '>': return '&gt;'
        case '&': return '&amp;'
        case '\'': return '&apos;'
        case '"': return '&quot;'
        default: return c
      }
    })

  const title = escapeXml(route.title || 'Маршрут')
  const trkpts = route.geometry
    .map(([lon, lat]) => `      <trkpt lat="${lat}" lon="${lon}"></trkpt>`)
    .join('\n')

  const gpxData = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Trip Scheduler" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${title}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`

  const blob = new Blob([gpxData], { type: 'application/gpx+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${(route.title || 'route').trim().replace(/[\s/]/g, '_')}.gpx`
  link.click()
  URL.revokeObjectURL(url)
}
