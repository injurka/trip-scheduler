import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { normalizeFsPath } from '../lib/vault-locator'
import { parseActivitiesFromMarkdown } from '../parsers/activity'
import { parseHotelsMarkdown } from '../parsers/booking'
import { extractLocationFromText } from '../parsers/checklist'
import { detectDocumentCategory, parseObsidianDocuments } from '../parsers/document'
import { extractCoordinatesFromUrl, extractLocationsFromText } from '../parsers/location'
import { extractCities, extractDayTitle, extractShortDescription, extractTags, parseObsidianTripFolder, parseTripFrontmatter } from '../parsers/vault'

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

describe('Trip YAML frontmatter', () => {
  const markdown = `---
cover: "_/all/cover.jpg"
descriptionShort: >-
  Короткое описание
  в две строки.
tags:
  - Тайвань
  - Воркейшн
cities: [Тайбэй, Гаосюн]
---

# Тайвань

## 📝 Краткое описание

Описание из Markdown.
`

  it('parses supported scalar, folded and array values', () => {
    expect(parseTripFrontmatter(markdown)).toEqual({
      cover: '_/all/cover.jpg',
      descriptionShort: 'Короткое описание в две строки.',
      tags: ['Тайвань', 'Воркейшн'],
      cities: ['Тайбэй', 'Гаосюн'],
    })
  })

  it('keeps commas inside quoted flow-array values', () => {
    expect(parseTripFrontmatter('---\ncities: ["Taipei, Taiwan", Гаосюн]\n---\n')).toEqual({
      cities: ['Taipei, Taiwan', 'Гаосюн'],
    })
  })

  it('gives explicit metadata priority over inferred Markdown values', () => {
    expect(extractShortDescription(markdown)).toBe('Короткое описание в две строки.')
    expect(extractTags(markdown)).toEqual(['Тайвань', 'Воркейшн'])
    expect(extractCities(markdown)).toEqual(['Тайбэй', 'Гаосюн'])
  })

  it('keeps legacy Markdown extraction when frontmatter is absent', () => {
    const legacy = '# Тайвань\n\n## 📝 Краткое описание\n\nСтарое подробное описание путешествия по Тайваню без YAML-метаданных. Оно продолжает извлекаться из привычного Markdown-раздела.\n\n## Маршрут'
    expect(extractShortDescription(legacy)).toBe('Старое подробное описание путешествия по Тайваню без YAML-метаданных. Оно продолжает извлекаться из привычного Markdown-раздела.')
    expect(extractTags(legacy)).toContain('Тайвань')
  })

  it('resolves a local cover from a trip folder', () => {
    const tripDir = mkdtempSync(join(tmpdir(), 'obsidian-trip-frontmatter-'))
    try {
      mkdirSync(join(tripDir, '_', 'all'), { recursive: true })
      writeFileSync(join(tripDir, '_', 'all', 'cover.jpg'), 'fixture')
      writeFileSync(join(tripDir, 'Trip.md'), markdown)
      const trip = parseObsidianTripFolder(tripDir, '2026-10-29')
      expect(trip.cover).toBe('_/all/cover.jpg')
      expect(trip.coverImagePath).toBe(join(tripDir, '_', 'all', 'cover.jpg'))
      expect(existsSync(trip.coverImagePath!)).toBeTrue()
    }
    finally {
      rmSync(tripDir, { recursive: true, force: true })
    }
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

  it('imports hotel coordinates from the dedicated map-location column', () => {
    const markdown = `
| Ночи | Локация | Отель №1 | Ночей | Локация отеля | Итого |
|:---:|:---|:---|:---:|:---|:---:|
| 01 | Тайбэй | [Morwing Hotel Fairy Tale](https://trip.com) | 1 | [Google Maps](https://maps.google.com/?q=25.047878,121.517113) | 3 200 ₽ |
`
    const bookings = parseHotelsMarkdown(markdown, '2026-10-01')

    expect(bookings).toHaveLength(1)
    expect(bookings[0]).toMatchObject({
      type: 'hotel',
      data: { location: { lat: 25.047878, lon: 121.517113 } },
    })
  })

  it('correctly uses explicit date ranges from location column instead of relative day offset', () => {
    const markdown = `
| Ночи | Локация | Отель №1 (Основной выбор) | Ночей | Цена / ночь | Итого за локацию |
|:---:|:---|:---|:---:|:---:|:---:|
| **01–04** | 🏙️ **Тайбэй** (30 окт – 03 ноя) | [Morwing Hotel Fairy Tale](https://www.trip.com/w/VfPGsYCo6W2) | **4н** | 3 183 ₽ | **12 732 ₽** |
| **09** | 🌲 **Алишань (2200 м)** (07 ноя – 08 ноя) | [Ho Fong Villa Hotel](https://www.trip.com/w/PWHVD6Yp6W2) | **1н** | 8 310 ₽ | **8 310 ₽** |
`
    // Trip starts on 29 Oct (flight), but Taipei hotel is 30 Oct – 03 Nov
    const bookings = parseHotelsMarkdown(markdown, '2026-10-29')
    expect(bookings).toHaveLength(2)

    const taipei = bookings[0]
    expect(taipei.type).toBe('hotel')
    if (taipei.type === 'hotel') {
      expect(taipei.data.hotelName).toBe('Morwing Hotel Fairy Tale')
      expect(taipei.data.address).toBe('Тайбэй')
      expect(taipei.data.checkInDate).toBe('2026-10-30')
      expect(taipei.data.checkOutDate).toBe('2026-11-03')
    }

    const alishan = bookings[1]
    expect(alishan.type).toBe('hotel')
    if (alishan.type === 'hotel') {
      expect(alishan.data.hotelName).toBe('Ho Fong Villa Hotel')
      expect(alishan.data.address).toBe('Алишань (2200 м)')
      expect(alishan.data.checkInDate).toBe('2026-11-07')
      expect(alishan.data.checkOutDate).toBe('2026-11-08')
    }
  })

  it('handles multi-stay hotel rows with multiple explicit date intervals', () => {
    const markdown = `
| Ночи / Дни | Локация | Отель №1 (Основной выбор) | Ночей | Цена / ночь | Итого за локацию |
|:---:|:---|:---|:---:|:---:|:---:|
| **15–16, 18–19** | 🚢 **Гаосюн** (12 ноя – 14 ноя, 15 ноя – 17 ноя) | [moon yancheg](https://www.trip.com/w/9icz1Kpr6W2) | **4н** | 2 316 ₽ | **9 264 ₽** |
`
    const bookings = parseHotelsMarkdown(markdown, '2026-10-29')
    expect(bookings).toHaveLength(2)

    const stay1 = bookings[0]
    expect(stay1.title).toBe('moon yancheg (1-й заезд)')
    if (stay1.type === 'hotel') {
      expect(stay1.data.checkInDate).toBe('2026-11-12')
      expect(stay1.data.checkOutDate).toBe('2026-11-14')
      expect(stay1.data.address).toBe('Гаосюн')
    }

    const stay2 = bookings[1]
    expect(stay2.title).toBe('moon yancheg (2-й заезд)')
    if (stay2.type === 'hotel') {
      expect(stay2.data.checkInDate).toBe('2026-11-15')
      expect(stay2.data.checkOutDate).toBe('2026-11-17')
      expect(stay2.data.address).toBe('Гаосюн')
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

  it('deduplicates a named map link and its iframe after activity normalization', () => {
    const markdown = `
* **10:00 - 13:00** — Fenqihu Old Street:
    * _Ссылка на локацию_: [Google Maps: 3. Fenqihu Station — багаж](https://maps.google.com/?q=Fenqihu+Station)<iframe src="https://maps.google.com/maps?q=Fenqihu+Station&output=embed"></iframe>
    * _Ссылка на локацию_: [Google Maps: Fenqihu Hotel Restaurant — бэнто](https://maps.google.com/?q=奮起湖大飯店)<iframe src="https://maps.google.com/maps?q=奮起湖大飯店&output=embed"></iframe>
    `.trim()
    const activity = parseActivitiesFromMarkdown(markdown)[0]
    const description = activity.sections?.find(section => section.type === 'description')
    const locations = extractLocationsFromText(description?.type === 'description' ? description.text : '')

    expect(locations).toHaveLength(2)
    expect(locations.map(location => location.query)).toEqual([
      'Fenqihu Station',
      '奮起湖大飯店',
    ])
  })

  it('keeps different locations whose names partially overlap', () => {
    const text = `
* _Ссылка на локацию_: [Google Maps: Old Street](https://maps.google.com/?q=Old+Street)
* _Ссылка на локацию_: [Google Maps: Fenqihu Old Street](https://maps.google.com/?q=Fenqihu+Old+Street)
    `.trim()

    const locations = extractLocationsFromText(text)

    expect(locations).toHaveLength(2)
    expect(locations.map(location => location.query)).toEqual([
      'Old Street',
      'Fenqihu Old Street',
    ])
  })

  it('segments route titles with arrows into clean waypoints without duplicate noise', () => {
    const text = '* _Хайкинг-трек_: [Google Maps: Jiufen Old Street Entrance → Shuqi Road → A-Mei Tea House](https://www.google.com/maps/dir/25.109860,121.845190/25.109200,121.844300/25.108800,121.843900/?travelmode=walking)'
    const locations = extractLocationsFromText(text)
    expect(locations).toHaveLength(3)
    expect(locations[0].name).toBe('Jiufen Old Street Entrance')
    expect(locations[0].pointType).toBe('start')
    expect(locations[1].name).toBe('Shuqi Road')
    expect(locations[1].pointType).toBe('via')
    expect(locations[2].name).toBe('A-Mei Tea House')
    expect(locations[2].pointType).toBe('end')
    expect(locations[0].routeName).toBe('Jiufen Old Street Entrance → Shuqi Road → A-Mei Tea House')
  })

  it('creates connect waypoints without text for intermediate curve coordinates', () => {
    const text = '* _Хайкинг-трек_: [Google Maps: Yehliu Visitor Center → Yehliu Cape Tip](https://www.google.com/maps/dir/25.206380,121.690460/25.207800,121.693400/25.212700,121.696100/?travelmode=walking)'
    const locations = extractLocationsFromText(text)
    expect(locations).toHaveLength(3)
    expect(locations[0].name).toBe('Yehliu Visitor Center')
    expect(locations[0].pointType).toBe('start')
    expect(locations[1].name).toBe('')
    expect(locations[1].pointType).toBe('connect')
    expect(locations[2].name).toBe('Yehliu Cape Tip')
    expect(locations[2].pointType).toBe('end')
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

describe('Activity Enrichment', () => {
  it('enriches activity with clean route without noisy duplicate comments', async () => {
    const { enrichActivityWithMediaAndLocation } = await import('../lib/enricher')
    const rawAct = {
      startTime: '10:00',
      endTime: '12:00',
      title: 'Геопарк Елю',
      tag: 'walk' as const,
      sections: [
        {
          id: 'desc-1',
          type: 'description' as const,
          text: `
_Ссылка на локацию_: [Google Maps: Yehliu Geopark](https://maps.google.com/?q=25.206380,121.690460)
_Хайкинг-трек_: [Google Maps: Yehliu Visitor Center → Yehliu Cape Tip](https://www.google.com/maps/dir/25.206380,121.690460/25.207800,121.693400/25.212700,121.696100/?travelmode=walking)
          `.trim(),
        },
      ],
    }

    const res = await enrichActivityWithMediaAndLocation(
      rawAct,
      new Map(),
      null,
      null,
      new Map(),
      new Map(),
      { geocode: false },
    )

    const geoSec = res.sections?.find(s => s.type === 'geolocation') as any
    expect(geoSec).toBeDefined()
    expect(geoSec.routes).toHaveLength(1)
    expect(geoSec.routes[0].title).toBe('Yehliu Visitor Center → Yehliu Cape Tip')
    expect(geoSec.routes[0].points).toHaveLength(3)
    expect(geoSec.routes[0].points[0].type).toBe('start')
    expect(geoSec.routes[0].points[0].address).toBe('Yehliu Visitor Center')
    expect(geoSec.routes[0].points[0].comment).toBeUndefined()
    expect(geoSec.routes[0].points[1].type).toBe('connect')
    expect(geoSec.routes[0].points[1].address).toBeUndefined()
    expect(geoSec.routes[0].points[1].comment).toBeUndefined()
    expect(geoSec.routes[0].points[2].type).toBe('end')
    expect(geoSec.routes[0].points[2].address).toBe('Yehliu Cape Tip')
    expect(geoSec.routes[0].points[2].comment).toBeUndefined()
  })
})

describe('PrivateDocuments Parser', () => {
  it('correctly categorizes documents based on filename and subfolder', () => {
    expect(detectDocumentCategory('Эл. маршрут-квитанция.pdf')).toBe('tickets')
    expect(detectDocumentCategory('ticket_china_eastern.pdf')).toBe('tickets')
    expect(detectDocumentCategory('boarding_pass.pdf')).toBe('tickets')
    expect(detectDocumentCategory('Загранпаспорт.pdf')).toBe('id')
    expect(detectDocumentCategory('visa_taiwan.png')).toBe('id')
    expect(detectDocumentCategory('Driver_License.pdf')).toBe('id')
    expect(detectDocumentCategory('Полис_Тинькофф_Страхование.pdf')).toBe('insurance')
    expect(detectDocumentCategory('Hotel_Confirmation.pdf')).toBe('lodging')
    expect(detectDocumentCategory('THSR_Train_Booking.pdf')).toBe('transport')
    expect(detectDocumentCategory('Guide_Notes.txt')).toBe('other')
  })

  it('scans _/PrivateDocuments and creates folders with private access', () => {
    const tempTripDir = mkdtempSync(join(tmpdir(), 'trip-doc-test-'))
    try {
      const privateDocsDir = join(tempTripDir, '_', 'PrivateDocuments')
      const ticketsSubdir = join(privateDocsDir, 'Билеты')
      mkdirSync(ticketsSubdir, { recursive: true })

      writeFileSync(join(privateDocsDir, 'Эл. маршрут-квитанция.pdf'), 'PDF-CONTENT-ROOT')
      writeFileSync(join(ticketsSubdir, 'Поезд_THSR.pdf'), 'PDF-CONTENT-SUBDIR')

      const result = parseObsidianDocuments(tempTripDir)

      expect(result.documents).toHaveLength(2)

      const rootDoc = result.documents.find(d => d.fileName === 'Эл. маршрут-квитанция.pdf')
      expect(rootDoc).toBeDefined()
      expect(rootDoc?.title).toBe('Эл. маршрут-квитанция')
      expect(rootDoc?.category).toBe('tickets')
      expect(rootDoc?.access).toBe('private')
      expect(rootDoc?.folderName).toBeNull()

      const subDoc = result.documents.find(d => d.fileName === 'Поезд_THSR.pdf')
      expect(subDoc).toBeDefined()
      expect(subDoc?.title).toBe('Поезд_THSR')
      expect(subDoc?.category).toBe('transport')
      expect(subDoc?.access).toBe('private')
      expect(subDoc?.folderName).toBe('Билеты')

      expect(result.documentsContent.folders).toHaveLength(1)
      expect(result.documentsContent.folders[0].name).toBe('Билеты')
    }
    finally {
      rmSync(tempTripDir, { recursive: true, force: true })
    }
  })

  it('scans PublicDocument and _/PublicDocuments with public access', () => {
    const tempTripDir = mkdtempSync(join(tmpdir(), 'trip-pub-doc-test-'))
    try {
      const publicDocDir = join(tempTripDir, 'PublicDocument')
      const underPublicDocsDir = join(tempTripDir, '_', 'PublicDocuments')
      const guidesSubdir = join(underPublicDocsDir, 'Инструкции')
      mkdirSync(publicDocDir, { recursive: true })
      mkdirSync(guidesSubdir, { recursive: true })

      writeFileSync(join(publicDocDir, 'General_Guide.pdf'), 'PDF-GUIDE')
      writeFileSync(join(guidesSubdir, 'Metro_Map.png'), 'PNG-MAP')

      const result = parseObsidianDocuments(tempTripDir)

      expect(result.documents).toHaveLength(2)

      const guideDoc = result.documents.find(d => d.fileName === 'General_Guide.pdf')
      expect(guideDoc).toBeDefined()
      expect(guideDoc?.title).toBe('General_Guide')
      expect(guideDoc?.access).toBe('public')
      expect(guideDoc?.folderName).toBeNull()

      const mapDoc = result.documents.find(d => d.fileName === 'Metro_Map.png')
      expect(mapDoc).toBeDefined()
      expect(mapDoc?.title).toBe('Metro_Map')
      expect(mapDoc?.access).toBe('public')
      expect(mapDoc?.folderName).toBe('Инструкции')

      expect(result.documentsContent.folders).toHaveLength(1)
      expect(result.documentsContent.folders[0].name).toBe('Инструкции')
    }
    finally {
      rmSync(tempTripDir, { recursive: true, force: true })
    }
  })

  it('recognizes the singular _/PrivateDocument and _/PublicDocument aliases', () => {
    const tempTripDir = mkdtempSync(join(tmpdir(), 'trip-singular-doc-test-'))
    try {
      const privateDocsDir = join(tempTripDir, '_', 'PrivateDocument')
      const publicDocsDir = join(tempTripDir, '_', 'PublicDocument')
      mkdirSync(privateDocsDir, { recursive: true })
      mkdirSync(publicDocsDir, { recursive: true })

      writeFileSync(join(privateDocsDir, 'Passport.pdf'), 'PRIVATE-PASSPORT')
      writeFileSync(join(publicDocsDir, 'General_Guide.pdf'), 'PUBLIC-GUIDE')

      const result = parseObsidianDocuments(tempTripDir)

      expect(result.documents).toHaveLength(2)
      expect(result.documents.find(d => d.fileName === 'Passport.pdf')?.access).toBe('private')
      expect(result.documents.find(d => d.fileName === 'General_Guide.pdf')?.access).toBe('public')
    }
    finally {
      rmSync(tempTripDir, { recursive: true, force: true })
    }
  })
})
