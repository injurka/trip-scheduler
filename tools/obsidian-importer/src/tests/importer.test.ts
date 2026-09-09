import { describe, expect, it } from 'bun:test'
import { normalizeFsPath } from '../lib/vault-locator'
import { parseActivitiesFromMarkdown } from '../parsers/activity'
import { parseHotelsMarkdown } from '../parsers/booking'
import { extractLocationFromText } from '../parsers/checklist'
import { extractCoordinatesFromUrl, extractLocationsFromText } from '../parsers/location'
import { extractDayTitle } from '../parsers/vault'

describe('Path Resolver & Normalizer', () => {
  it('strips leading @ prefix and quotes', () => {
    const p1 = normalizeFsPath('@/home/user/travel')
    expect(p1).toBe('/home/user/travel')

    const p2 = normalizeFsPath('@"/home/user/travel"')
    expect(p2).toBe('/home/user/travel')

    const p3 = normalizeFsPath('\'/home/user/travel\'')
    expect(p3).toBe('/home/user/travel')
  })

  it('converts Windows backslashes and drive letter', () => {
    const p = normalizeFsPath('C:\\Users\\user\\travel')
    expect(p).toContain('/mnt/c/Users/user/travel')
  })
})

describe('Hotel Booking Parser', () => {
  it('formats hotel title preserving both hotelName and cleanLocation', () => {
    const markdown = `
| Ночи | Локация | Отель №1 (Основной выбор) | Ночей | Цена / ночь | Итого за локацию |
|:---:|:---|:---|:---:|:---:|:---:|
| 01–04 | 🏙️ Тайбэй | [Morwing Hotel Fairy Tale](https://trip.com) | 3 | 3 200 ₽ | 9 600 ₽ |
`
    const bookings = parseHotelsMarkdown(markdown, '2026-10-01')
    expect(bookings).toHaveLength(1)
    const hotel = bookings[0]
    expect(hotel.type).toBe('hotel')
    expect(hotel.title).toBe('Morwing Hotel Fairy Tale')
    if (hotel.type === 'hotel') {
      expect(hotel.data.hotelName).toBe('Morwing Hotel Fairy Tale')
      expect(hotel.data.address).toBe('Тайбэй')
    }
  })
})

describe('Location Parser', () => {
  it('extracts coordinates from google maps url with !3d and !4d', () => {
    const url = 'https://www.google.com/maps/place/Taipei+101/@25.033964,121.564472,17z/data=!3m1!4b1!4m6!3m5!1s0x3442abb6da9c9e1f:0x12068b050d0f8be0!8m2!3d25.033964!4d121.564472'
    const coords = extractCoordinatesFromUrl(url)
    expect(coords).toBeDefined()
    expect(coords![0]).toBeCloseTo(121.564472, 4)
    expect(coords![1]).toBeCloseTo(25.033964, 4)
  })

  it('extracts fallback query from url when link text is generic', () => {
    const text = '* _Ссылка на локацию_: [Google Maps](https://maps.google.com/?q=Taipei+101)'
    const locations = extractLocationsFromText(text)
    expect(locations).toHaveLength(1)
    expect(locations[0].name).toBe('Taipei 101')
    expect(locations[0].query).toBe('Taipei 101')
  })

  it('creates only one location when link has custom title and line contains iframe with query', () => {
    const text = '* _Ссылка на локацию_: [Google Maps: Chifeng Street Zhongshan](https://maps.google.com/?q=Chifeng+Street+Taipei)<iframe src="https://maps.google.com/maps?q=Chifeng+Street+Taipei&output=embed" style="width: 100%; min-width: 100%; height: 350px; display: block; border: 0; border-radius: 8px; margin-top: 10px; margin-bottom: 15px;" loading="lazy"></iframe>'
    const locations = extractLocationsFromText(text)
    expect(locations).toHaveLength(1)
    expect(locations[0].name).toBe('Chifeng Street Zhongshan')
    expect(locations[0].query).toBe('Chifeng Street Taipei')
  })
})

describe('Checklist Parser', () => {
  it('cleans leading dashes from task description', () => {
    const loc = extractLocationFromText('*Локация:* Din Tai Fung')
    expect(loc).toBe('Din Tai Fung')
  })
})

describe('Activity & Day Title Parser', () => {
  it('parses activities with time ranges', () => {
    const md = `
* **09:30 - 11:30** — **Прогулка по парку (Тайбэй)**:
    * *Контекст*: Красивый парк.
`
    const activities = parseActivitiesFromMarkdown(md)
    expect(activities).toHaveLength(1)
    expect(activities[0].startTime).toBe('09:30')
    expect(activities[0].endTime).toBe('11:30')
    expect(activities[0].title).toBe('Прогулка по парку (Тайбэй)')
    expect(activities[0].tag).toBe('walk')
  })

  it('extracts clean day title removing number prefixes', () => {
    const title1 = extractDayTitle('01 Тайбэй (пт) 🛬 Врата на Формозу', 1)
    expect(title1).toBe('🛬 Врата на Формозу')

    const title2 = extractDayTitle('02 Токио', 2)
    expect(title2).toBe('Токио')
  })
})
