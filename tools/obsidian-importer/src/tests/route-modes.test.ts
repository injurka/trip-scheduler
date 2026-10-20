import { describe, expect, it } from 'bun:test'
import { enrichActivityWithMediaAndLocation } from '../lib/enricher'
import { parseActivitiesFromMarkdown } from '../parsers/activity'
import { extractLabeledRouteMode, extractRouteTransportMode } from '../parsers/location'

describe('Google directions transport modes', () => {
  it.each([
    ['!3e0', 'car'],
    ['!3e1', 'bike'],
    ['!3e2', 'foot'],
    ['!3e3!5i2', 'transit'],
    ['?travelmode=driving', 'car'],
    ['?travelmode=walking', 'foot'],
    ['?travelmode=bicycling', 'bike'],
    ['?travelmode=transit', 'transit'],
  ])('imports %s as %s without leaving an empty path label', async (suffix, mode) => {
    const url = `https://www.google.com/maps/dir/25.151367,121.545997/25.0842798,121.5249762/data=${suffix}`
    const activity = parseActivitiesFromMarkdown(`* **14:25 - 15:15** — Возвращение автобусом:
    * Ожидание и поездка.
    * _Путь до Jiantan_: [Google Maps: Yangmingshan Bus Terminal → Jiantan Station](${url})`)[0]
    const result = await enrichActivityWithMediaAndLocation(activity, new Map(), null, null, new Map(), new Map(), { geocode: false, uploadImages: false })
    const geo = result.sections?.find(section => section.type === 'geolocation') as any
    expect(geo.routes).toHaveLength(1)
    expect(geo.routes[0].transportMode).toBe(mode)
    expect(geo.routes[0].points[0].externalUrl).toBe(url)
    const descriptions = result.sections?.filter(section => section.type === 'description') as any[]
    expect(descriptions.map(section => section.text).join('')).toBe('* Ожидание и поездка.')
  })

  it('gives the explicit query mode priority and ignores map-layer markers', () => {
    expect(extractRouteTransportMode('https://www.google.com/maps/dir/A/B/data=!3e2?travelmode=driving')).toBe('car')
    expect(extractRouteTransportMode('https://www.google.com/maps/dir/A/B/am=t/data=!1e3')).toBeUndefined()
  })
})

describe('train booking attachment', () => {
  it.each([
    ['09:59 - 11:22', 'Поезд №270 Taipei ➔ Jiaoxi', true],
    ['11:22 - 11:32', 'Пешком №270 до отеля', false],
    ['10:00 - 11:00', 'Прогулка [карта](https://maps.google.com/24.8270432)', false],
    ['10:00 - 11:00', 'Поезд №1270', false],
    ['09:59 - 11:22', 'Поезд TRA Taipei ➔ Jiaoxi', true],
  ])('%s %s attaches=%s', async (time, title, attached) => {
    const activity = parseActivitiesFromMarkdown(`* **${time}** — ${title}:\n    * Контекст поездки.`)[0]
    const result = await enrichActivityWithMediaAndLocation(activity, new Map(), null, null, new Map(), new Map(), {
      geocode: false,
      uploadImages: false,
      dayDate: '2026-11-10',
      bookings: [{ id: 'train', icon: 'mdi:train', title: 'Taipei → Jiaoxi', type: 'train', data: {
        trainNumber: '270',
        departureStation: 'Taipei',
        arrivalStation: 'Jiaoxi',
        departureDateTime: '2026-11-10T09:59',
        arrivalDateTime: '2026-11-10T11:22',
      } }],
    })
    expect(result.sections?.some(section => section.type === 'booking')).toBe(attached)
  })
})

it('prioritizes explicit route labels and scopes them to each link', () => {
  const text = '_Маршрут на карте (автобус)_: [BRT](https://example.com/bus)\n_Маршрут на карте (пешком)_: [Walk](https://example.com/walk)'
  expect(extractLabeledRouteMode(text, 'https://example.com/bus')).toBe('transit')
  expect(extractLabeledRouteMode(text, 'https://example.com/walk')).toBe('foot')
  expect(extractLabeledRouteMode(text, 'https://example.com/other')).toBeUndefined()
})
