import { describe, expect, it } from 'bun:test'
import { enrichActivityWithMediaAndLocation } from '../lib/enricher'
import { parseActivitiesFromMarkdown } from '../parsers/activity'
import { extractLocationsFromText, extractMarkdownLinks } from '../parsers/location'

// Реальные ссылки из вольта (05 Taiwan, день 15, Тайнань): Google Maps генерирует
// /dir/Confucius+Temple(Museum+of+Taiwan+Literature) с неэкранированными скобками.
const TAINAN_BUS_URL = 'https://www.google.com/maps/dir/Tianfei+Village,+Anping+District,+Tainan+City,+%D0%A2%D0%B0%D0%B9%D0%B2%D0%B0%D0%BD%D1%8C+708/Confucius+Temple(Museum+of+Taiwan+Literature),+West+Central+District,+Tainan+City,+%D0%A2%D0%B0%D0%B9%D0%B2%D0%B0%D0%BD%D1%8C+700/@22.9907857,120.1603678,12625m/am=t/data=!3m2!1e3!4b1!4m19!4m18!1m5!1m1!1s0x346e761cd832d87b:0xb29aeb5f236e8803!2m2!1d120.161994!2d23.000066!1m5!1m1!1s0x346e7662a0b0dd21:0x9d14a4f930059260!2m2!1d120.20502!2d22.99149!2m3!6e0!7e2!8j1790085600!3e3!5i1'
const TAINAN_WALK_URL = 'https://www.google.com/maps/dir/Confucius+Temple(Museum+of+Taiwan+Literature),+West+Central+District,+Tainan+City,+%D0%A2%D0%B0%D0%B9%D0%B2%D0%B0%D0%BD%D1%8C+700/%D0%A5%D1%80%D0%B0%D0%BC+%D0%9A%D0%BE%D0%BD%D1%84%D1%83%D1%86%D0%B8%D1%8F+%D0%BD%D0%B0+%D0%A2%D0%B0%D0%B9%D0%B2%D0%B0%D0%BD%D0%B5,+No.+2%E8%99%9F,+Nanmen+Rd,+Yonghua+Village,+West+Central+District,+Tainan+City,+%D0%A2%D0%B0%D0%B9%D0%B2%D0%B0%D0%BD%D1%8C+700/@22.9904363,120.2029495,17z/am=t/data=!4m22!4m21!1m5!1m1!1s0x346e7662a0b0dd21:0x9d14a4f930059260!2m2!1d120.20502!2d22.99149!1m5!1m1!1s0x346e7662acd5bc15:0xb225ac98ebd9091!2m2!1d120.2040401!2d22.9905296!2m3!6e0!7e2!8j1790085600!3e2!6m3!1i0!2i0!3i1'

describe('markdown links with unbalanced look but balanced parentheses in URL', () => {
  it('extractMarkdownLinks keeps the full URL with parentheses inside', () => {
    const links = extractMarkdownLinks(`* _Маршрут на карте (авто)_: [Google Maps: Tianfei Village ➔ Confucius Temple](${TAINAN_BUS_URL})`)
    expect(links).toHaveLength(1)
    expect(links[0].url).toBe(TAINAN_BUS_URL)
  })

  it('parens in the first dir segment do not swallow the rest of the URL', () => {
    const links = extractMarkdownLinks(`* _Маршрут на карте (пешком)_: [Google Maps: Остановка автобуса ➔ Храм Конфуция](${TAINAN_WALK_URL})`)
    expect(links).toHaveLength(1)
    expect(links[0].url).toBe(TAINAN_WALK_URL)
  })

  it('extracts several links from the same line independently', () => {
    const links = extractMarkdownLinks(`_Маршрут на карте (авто)_: [A ➔ B](${TAINAN_BUS_URL}) и ещё [C](https://example.com/x)`)
    expect(links.map(l => l.url)).toEqual([TAINAN_BUS_URL, 'https://example.com/x'])
  })

  it('extractLocationsFromText builds a route with both coordinates and full names', () => {
    const locs = extractLocationsFromText(`* _Маршрут на карте (авто)_: [Google Maps: Tianfei Village ➔ Confucius Temple](${TAINAN_BUS_URL})`)
    expect(locs).toHaveLength(2)
    expect(locs[0]).toMatchObject({
      routeName: 'Tianfei Village ➔ Confucius Temple',
      pointType: 'start',
      name: 'Tianfei Village, Anping District, Tainan City, Тайвань 708',
      coordinates: [120.161994, 23.000066],
    })
    expect(locs[1]).toMatchObject({
      routeName: 'Tianfei Village ➔ Confucius Temple',
      pointType: 'end',
      name: 'Confucius Temple(Museum of Taiwan Literature), West Central District, Tainan City, Тайвань 700',
      coordinates: [120.20502, 22.99149],
    })
  })

  it('enrichment keeps the imported route with mode from the (авто) label', async () => {
    const activity = parseActivitiesFromMarkdown(`* **14:15 - 14:55** — Автобус № 102 из Анпина в центр Тайнаня:\n    * *Поездка на автобусе:* Посадка на городской автобус № 102.\n    * _Маршрут на карте (авто)_: [Google Maps: Tianfei Village ➔ Confucius Temple](${TAINAN_BUS_URL})`)[0]
    const result = await enrichActivityWithMediaAndLocation(activity, new Map(), null, null, new Map(), new Map(), { geocode: false, uploadImages: false })
    const geo = result.sections?.find(section => section.type === 'geolocation') as any
    expect(geo.routes).toHaveLength(1)
    expect(geo.routes[0].transportMode).toBe('car')
    expect(geo.routes[0].points).toHaveLength(2)
    expect(geo.routes[0].points[0].coordinates).toEqual([120.161994, 23.000066])
    expect(geo.routes[0].points[1].coordinates).toEqual([120.20502, 22.99149])
  })

  it('does not regress plain URLs without parentheses', () => {
    const locs = extractLocationsFromText('* _Ссылка на локацию_: [Google Maps: Chifeng Street Zhongshan](https://maps.google.com/?q=Chifeng+Street+Taipei)')
    expect(locs).toHaveLength(1)
    expect(locs[0].externalUrl).toBe('https://maps.google.com/?q=Chifeng+Street+Taipei')
  })
})
