import type { Trip } from '~/shared/types/models/trip'
import { strToU8, zipSync } from 'fflate'

const MAPSME_COLORS = [
  'red',
  'blue',
  'purple',
  'yellow',
  'pink',
  'brown',
  'green',
  'orange',
  'deeppurple',
  'lightblue',
] as const

type MapsMeColor = typeof MAPSME_COLORS[number]

/**
 * Очищает строку от вложенных закрывающих тегов CDATA
 */
function sanitizeCdata(text: string): string {
  if (!text)
    return ''
  return text.replace(/\]\]>/g, ']]&gt;')
}

/**
 * Конвертирует стандартный HEX цвет в формат KML (AABBGGRR).
 */
function hexToKmlColor(hex?: string): string {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#'))
    return 'ff0000ff'

  let c = hex.replace('#', '')
  if (c.length === 3)
    c = c.split('').map(x => x + x).join('')
  if (c.length !== 6)
    return 'ff0000ff'

  const r = c.substring(0, 2)
  const g = c.substring(2, 4)
  const b = c.substring(4, 6)

  return `ff${b}${g}${r}`.toLowerCase()
}

/**
 * Определяет цвет булавки в зависимости от типа точки и категории активности
 */
function getPlacemarkColor(point: any): MapsMeColor {
  // 1. Сначала проверяем системные точки маршрута
  if (point.type === 'start')
    return 'green'
  if (point.type === 'end')
    return 'red'

  // 2. Затем смотрим на тег активности
  if (point.activityTag) {
    switch (point.activityTag) {
      case 'food': return 'orange'
      case 'attraction': return 'purple'
      case 'transport': return 'blue'
      case 'walk': return 'brown'
      case 'relax': return 'lightblue'
      case 'activity': return 'deeppurple'
    }
  }

  // Цвет по умолчанию
  return 'red'
}

/**
 * Генерирует содержимое файла .kml
 */
function generateKml(trip: Trip, points: any[], routes: any[], drawnRoutes: any[]): string {
  const routeColors = new Set<string>()
  routes.forEach(r => routeColors.add(hexToKmlColor(r.color)))
  drawnRoutes.forEach(dr => routeColors.add(hexToKmlColor(dr.color)))

  // Генерируем стили для всех цветов булавок
  let styles = MAPSME_COLORS.map(color => `
    <Style id="placemark-${color}">
      <IconStyle>
        <Icon><href>http://maps.me/placemarks/placemark-${color}.png</href></Icon>
      </IconStyle>
    </Style>
  `).join('\n')

  // Генерируем стили для линий маршрутов
  routeColors.forEach((color) => {
    styles += `
    <Style id="route-style-${color}">
      <LineStyle>
        <color>${color}</color>
        <width>6</width>
      </LineStyle>
    </Style>`
  })

  let placemarks = ''

  // 1. Точки интереса
  points.forEach((p) => {
    if (!p.coordinates || p.coordinates.length < 2)
      return
    const lon = Number(p.coordinates[0])
    const lat = Number(p.coordinates[1])
    if (isNaN(lon) || isNaN(lat))
      return

    const name = p.comment || p.address || p.title || 'Точка'
    const desc = p.comment && p.address ? p.address : ''
    const color = getPlacemarkColor(p)

    placemarks += `
    <Placemark>
      <name><![CDATA[${sanitizeCdata(name)}]]></name>
      ${desc ? `<description><![CDATA[${sanitizeCdata(desc)}]]></description>` : ''}
      <styleUrl>#placemark-${color}</styleUrl>
      <Point><coordinates>${lon},${lat}</coordinates></Point>
      <ExtendedData xmlns:mwm="https://maps.me">
        <mwm:customName><![CDATA[${sanitizeCdata(name)}]]></mwm:customName>
        <mwm:scale>15</mwm:scale>
      </ExtendedData>
    </Placemark>`
  })

  // 2. Построенные маршруты
  routes.forEach((r) => {
    if (!r.geometry || r.geometry.length < 2)
      return

    const color = hexToKmlColor(r.color)
    const name = r.title || 'Маршрут'

    const validCoords = r.geometry.filter((pt: any) => pt && pt.length >= 2 && !isNaN(Number(pt[0])) && !isNaN(Number(pt[1])))
    if (validCoords.length < 2)
      return

    const coordsString = validCoords.map((pt: any) => `${Number(pt[0])},${Number(pt[1])}`).join(' ')

    placemarks += `
    <Placemark>
      <name><![CDATA[${sanitizeCdata(name)}]]></name>
      <styleUrl>#route-style-${color}</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${coordsString}</coordinates>
      </LineString>
      <ExtendedData xmlns:mwm="https://maps.me">
        <mwm:visibility>1</mwm:visibility>
      </ExtendedData>
    </Placemark>`
  })

  // 3. Нарисованные вручную маршруты
  drawnRoutes.forEach((dr) => {
    if (!dr.segments || !Array.isArray(dr.segments) || dr.segments.length === 0)
      return

    const color = hexToKmlColor(dr.color)
    const name = dr.title || 'Нарисованный маршрут'

    dr.segments.forEach((segment: any[], index: number) => {
      if (!segment || segment.length < 2)
        return

      const validCoords = segment.filter(pt => pt && pt.length >= 2 && !isNaN(Number(pt[0])) && !isNaN(Number(pt[1])))
      if (validCoords.length < 2)
        return

      const coordsString = validCoords.map(pt => `${Number(pt[0])},${Number(pt[1])}`).join(' ')
      const partSuffix = dr.segments.length > 1 ? ` (часть ${index + 1})` : ''

      placemarks += `
      <Placemark>
        <name><![CDATA[${sanitizeCdata(name)}${partSuffix}]]></name>
        <styleUrl>#route-style-${color}</styleUrl>
        <LineString>
          <tessellate>1</tessellate>
          <coordinates>${coordsString}</coordinates>
        </LineString>
        <ExtendedData xmlns:mwm="https://maps.me">
          <mwm:visibility>1</mwm:visibility>
        </ExtendedData>
      </Placemark>`
    })
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.2">
<Document>
  <name><![CDATA[${sanitizeCdata(trip.title)}]]></name>
  <visibility>1</visibility>
  ${styles}
  ${placemarks}
</Document>
</kml>`.trim()
}

/**
 * Основная функция: генерирует KML, пакует в KMZ и скачивает.
 */
export function exportToMapsMe(trip: Trip | null, points: any[], routes: any[], drawnRoutes: any[]) {
  if (!trip)
    return

  try {
    const kmlString = generateKml(trip, points, routes, drawnRoutes)
    const safeId = trip.id

    const zippedData = zipSync({
      [`${safeId}.kml`]: [strToU8(kmlString), { level: 0 }],
    })

    const blob = new Blob([zippedData], { type: 'application/vnd.google-earth.kmz' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `${safeId}.kmz`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
  catch (error) {
    console.error('Ошибка экспорта в Maps.me:', error)
    throw error
  }
}
