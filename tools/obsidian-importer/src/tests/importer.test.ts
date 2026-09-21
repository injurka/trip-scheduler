import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { enrichActivityWithMediaAndLocation } from '../lib/enricher'
import { normalizeFsPath } from '../lib/vault-locator'
import { parseActivitiesFromMarkdown } from '../parsers/activity'
import { parseHotelsMarkdown } from '../parsers/booking'
import { extractLocationFromText } from '../parsers/checklist'
import { detectDocumentCategory, parseObsidianDocuments } from '../parsers/document'
import { extractCoordinatesFromUrl, extractLocationsFromText } from '../parsers/location'
import { parseTransportBlock } from '../parsers/transport'
import {
  extractCities,
  extractDayDescription,
  extractDayTitle,
  extractShortDescription,
  extractTags,
  parseDayFrontmatter,
  parseObsidianTripFolder,
  parseTripFrontmatter,
} from '../parsers/vault'

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

describe('Day YAML frontmatter', () => {
  const dayMarkdown = `---
day: 10
date: "2026-11-13"
weekday: "Пятница"
title: "Скоростной транзит и спокойный вечер в Цзяи"
location: "Хуалянь ➔ Banqiao ➔ Цзяи (Chiayi)"
phase: "🌴 Фаза 1 — Чистый отпуск"
accommodation: "StarYi Hotel"
highlight: >-
  Вместо одиннадцатичасового транспортного коридора — прибытие в Цзяи к обеду, 
  зелёный Chiayi Park и вечерний рынок Вэньхуа без спешки.
tags:
  - маршрут/день
  - тайвань
  - транзит
---

# 🗓️ День 10: Пятница (🚄 Скоростной транзит и спокойный вечер в Цзяи)

---

* **07:00 - 09:15** — Поезд TRA EMU3000 в Banqiao:
    * Скоростной экспресс.
`

  it('parses day frontmatter properties correctly', () => {
    const fm = parseDayFrontmatter(dayMarkdown)
    expect(fm.day).toBe(10)
    expect(fm.date).toBe('2026-11-13')
    expect(fm.weekday).toBe('Пятница')
    expect(fm.title).toBe('Скоростной транзит и спокойный вечер в Цзяи')
    expect(fm.location).toBe('Хуалянь ➔ Banqiao ➔ Цзяи (Chiayi)')
    expect(fm.phase).toBe('🌴 Фаза 1 — Чистый отпуск')
    expect(fm.accommodation).toBe('StarYi Hotel')
    expect(fm.highlight).toContain('зелёный Chiayi Park')
    expect(fm.tags).toEqual(['маршрут/день', 'тайвань', 'транзит'])
  })

  it('extracts day description from day frontmatter without blockquotes', () => {
    const desc = extractDayDescription(dayMarkdown)
    expect(desc).toContain('Фаза 1 — Чистый отпуск')
    expect(desc).toContain('зелёный Chiayi Park')
  })

  it('parses day with frontmatter in parseObsidianTripFolder', () => {
    const tripDir = mkdtempSync(join(tmpdir(), 'obsidian-day-fm-'))
    try {
      mkdirSync(join(tripDir, '02 - Маршрутный план'), { recursive: true })
      writeFileSync(join(tripDir, 'Trip.md'), '# Trip\n\n## 📝 Краткое описание\n\nТест.')
      writeFileSync(join(tripDir, '02 - Маршрутный план', '10 Цзяи.md'), dayMarkdown)

      const trip = parseObsidianTripFolder(tripDir, '2026-11-04')
      expect(trip.days).toHaveLength(1)
      const d = trip.days[0]
      expect(d.dayNumber).toBe(10)
      expect(d.date).toBe('2026-11-13')
      expect(d.title).toBe('Скоростной транзит и спокойный вечер в Цзяи')
      expect(d.location).toBe('Хуалянь ➔ Banqiao ➔ Цзяи (Chiayi)')
      expect(d.accommodation).toBe('StarYi Hotel')
      expect(d.description).toContain('Фаза 1')
    }
    finally {
      rmSync(tripDir, { recursive: true, force: true })
    }
  })

  it('parses is_ready in frontmatter and appends (✅ Готов) to day description', () => {
    const readyMarkdown = `---
day: 3
date: 2026-11-06
weekday: Пятница
title: Первые огни Тайбэя
location: Гуанчжоу ➔ TPE ➔ Тайбэй
phase: 🌴 Фаза 1 — Чистый отпуск
highlight: Первое знакомство с Формозой без гонки после перелёта.
is_ready: true
---

# 🗓️ День 03: Пятница
`
    const fm = parseDayFrontmatter(readyMarkdown)
    expect(fm.is_ready).toBe(true)
    expect(fm.isReady).toBe(true)

    const desc = extractDayDescription(readyMarkdown, fm)
    expect(desc).toBe('Фаза 1 — Чистый отпуск. Первое знакомство с Формозой без гонки после перелёта. (✅ Готов)')

    const notReadyMarkdown = readyMarkdown.replace('is_ready: true', 'is_ready: false')
    const fmNotReady = parseDayFrontmatter(notReadyMarkdown)
    expect(fmNotReady.is_ready).toBe(false)
    const descNotReady = extractDayDescription(notReadyMarkdown, fmNotReady)
    expect(descNotReady).toBe('Фаза 1 — Чистый отпуск. Первое знакомство с Формозой без гонки после перелёта.')
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
      expect(hotel.data.notes).toBeUndefined()
    }
  })

  it('strips *(оплачено)* and (оплачено) from hotelName and keeps notes clean from prices', () => {
    const markdown = `
| Ночи | Локация | Отель №1 (Основной выбор) | Ночей | Цена / ночь | Итого за локацию |
|:---:|:---|:---|:---:|:---:|:---:|
| 03–06 | 🏙️ **Тайбэй** (06 ноя – 10 ноя) | Dongmen Hotel *(оплачено)* | 4н | 4 375 ₽ | 17 501 ₽ |

### 🏙️ Тайбэй (4 ночи: 06 ноя – 10 ноя)
* **✅ Забронировано:** **Dongmen Hotel (東門旅店)** — **4 375 ₽ / ночь**
  * *Особенности:* Расположение прямо у станции метро MRT Dongmen.
`
    const bookings = parseHotelsMarkdown(markdown, '2026-11-04')
    expect(bookings).toHaveLength(1)
    const hotel = bookings[0]
    expect(hotel.title).toBe('Dongmen Hotel')
    if (hotel.type === 'hotel') {
      expect(hotel.data.hotelName).toBe('Dongmen Hotel')
      expect(hotel.data.notes).toBe('Расположение прямо у станции метро MRT Dongmen.')
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
  })

  it('extracts hotel photos from detail catalog bullet points and callouts', () => {
    const markdown = `
| Ночи | Локация | Отель №1 | Ночей | Цена / ночь | Итого |
|:---:|:---|:---|:---:|:---:|:---:|
| 01 | Тайбэй | [Morwing Hotel Fairy Tale](https://trip.com) | 1 | 3 200 ₽ | 3 200 ₽ |
| 02 | Цзяоси | [Mutaixu hot spring](https://trip.com) | 1 | 3 100 ₽ | 3 100 ₽ |

### 🏙️ Тайбэй (Ночь 01)
* **№1 (Основной):** [Morwing Hotel Fairy Tale](https://trip.com) — **3 200 ₽ / ночь**
  * *Особенности:* Центр города
  * *Фото:* ![[Morwing_1.jpg]], ![[Morwing_2.png]]

### ♨️ Цзяоси (Ночь 02)
* **✅ Забронировано:** [Mutaixu hot spring](https://trip.com) — **3 100 ₽ / ночь**
  * *Особенности:* Термальный бассейн
> [!INFO]- Картинки
> ![[mutaixu_pool.webp]]
> ![[mutaixu_room.jpg]]
`
    const bookings = parseHotelsMarkdown(markdown, '2026-10-01')
    expect(bookings).toHaveLength(2)

    const morwing = bookings[0]
    expect(morwing.data.photos).toEqual(['Morwing_1.jpg', 'Morwing_2.png'])
    expect(morwing.data.imageUrls).toEqual(['Morwing_1.jpg', 'Morwing_2.png'])

    const mutaixu = bookings[1]
    expect(mutaixu.data.photos).toEqual(['mutaixu_pool.webp', 'mutaixu_room.jpg'])
    expect(mutaixu.data.imageUrls).toEqual(['mutaixu_pool.webp', 'mutaixu_room.jpg'])
  })

  it('extracts photos from an indented collapsible hotel callout', () => {
    const markdown = `
| Ночи | Локация | Отель №1 | Ночей | Цена / ночь | Итого |
|:---:|:---|:---|:---:|:---:|:---:|
| 02 | Гуанчжоу (05 ноя – 06 ноя) | Southern Airlines Pearl Hotel (North District) | 1 | 150 CNY | 150 CNY |

### Гуанчжоу (05 ноя – 06 ноя)
* **Забронировано:** Southern Airlines Pearl Hotel (North District)
  * *Логистика:* Бесплатный шаттл от стойки China Southern.
  > [!INFO]- Картинки
  > ![[_/hotels/southern_airlines_pearl_hotel_1.png]]
  > ![[_/hotels/southern_airlines_pearl_hotel_2.png]]
`
    const bookings = parseHotelsMarkdown(markdown, '2026-11-04')
    expect(bookings).toHaveLength(1)
    expect(bookings[0].data.photos).toEqual([
      '_/hotels/southern_airlines_pearl_hotel_1.png',
      '_/hotels/southern_airlines_pearl_hotel_2.png',
    ])
  })

  it('keeps a trailing primary gallery attached after documents and alternatives', () => {
    const markdown = `
| Ночи | Локация | Отель №1 | Ночей | Цена / ночь | Итого |
|:---:|:---|:---|:---:|:---:|:---:|
| 14–17 | Тайнань (17 ноя – 21 ноя) | Yoshi Hotel | 4 | 3 961 ₽ | 15 844 ₽ |

### Тайнань (17 ноя – 21 ноя)
* **✅ Забронировано:** **Yoshi Hotel**
  * *Особенности:* Исторический центр.
  * *Документы:* Ваучер.
* **Альтернативы:**
  * [WUYU](https://example.com/wuyu)
  * [LIHO Hotel](https://example.com/liho)
> [!INFO]- Картинки
> ![[_/hotels/yoshi.jpg]]
`
    const bookings = parseHotelsMarkdown(markdown, '2026-11-04')
    expect(bookings).toHaveLength(1)
    expect(bookings[0].data.photos).toEqual(['_/hotels/yoshi.jpg'])
  })

  it('extracts hotel photos from dedicated Фото table column', () => {
    const markdown = `
| Ночи | Локация | Отель №1 | Ночей | Цена / ночь | Фото | Итого |
|:---:|:---|:---|:---:|:---:|:---|:---:|
| 01 | Тайбэй | [Morwing Hotel Fairy Tale](https://trip.com) | 1 | 3 200 ₽ | ![[table_photo.jpg]] | 3 200 ₽ |
`
    const bookings = parseHotelsMarkdown(markdown, '2026-10-01')
    expect(bookings).toHaveLength(1)
    expect(bookings[0].data.photos).toContain('table_photo.jpg')
  })

  it('extracts hotel photos in fallback catalog parsing without table', () => {
    const markdown = `
### 🏙️ Тайбэй (01–04 ноя)
* **№1 (Основной):** [Morwing Hotel Fairy Tale](https://trip.com)
  * *Локация:* Тайбэй
  * *Стоимость:* 3 200 ₽
  * *Особенности:* Wi-Fi 300 Мбит/с
  * *Фото:* ![[fallback_hotel.jpg]]
`
    const bookings = parseHotelsMarkdown(markdown, '2026-11-01')
    expect(bookings).toHaveLength(1)
    expect(bookings[0].data.photos).toContain('fallback_hotel.jpg')
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
    const url = 'https://maps.google.com/?q=Taipei+101'
    const text = `* _Ссылка на локацию_: [Google Maps](${url})`
    const locations = extractLocationsFromText(text)
    expect(locations).toHaveLength(1)
    expect(locations[0].name).toBe('Taipei 101')
    expect(locations[0].query).toBe('Taipei 101')
    expect(locations[0].externalUrl).toBe(url)
  })

  it('creates only one location when link has custom title and line contains iframe with query', () => {
    const text = '* _Ссылка на локацию_: [Google Maps: Chifeng Street Zhongshan](https://maps.google.com/?q=Chifeng+Street+Taipei)<iframe src="https://maps.google.com/maps?q=Chifeng+Street+Taipei&output=embed" style="width: 100%; min-width: 100%; height: 350px; display: block; border: 0; border-radius: 8px; margin-top: 10px; margin-bottom: 15px;" loading="lazy"></iframe>'
    const locations = extractLocationsFromText(text)
    expect(locations).toHaveLength(1)
    expect(locations[0].name).toBe('Chifeng Street Zhongshan')
    expect(locations[0].query).toBe('Chifeng Street Taipei')
    expect(locations[0].externalUrl).toBe('https://maps.google.com/?q=Chifeng+Street+Taipei')
  })

  it('preserves the exact map URL in the imported geolocation point', async () => {
    const url = 'https://www.google.com/maps/place/Southern+Airlines+Pearl+Airport+Hotel/@23.4268711,113.3121694,17.46z/data=!3m1!4b1!8m2!3d23.427542!4d113.318474'
    const markdown = `
* **16:00 - 17:00** — Трансфер в транзитный отель:
    * _Ссылка на отель_: [Google Maps: Southern Airlines Pearl Hotel (North District)](${url})
`.trim()

    const activity = parseActivitiesFromMarkdown(markdown)[0]
    const enriched = await enrichActivityWithMediaAndLocation(
      activity,
      new Map(),
      null,
      null,
      new Map(),
      new Map(),
      { geocode: false, uploadImages: false },
    )
    const geolocation = enriched.sections?.find(section => section.type === 'geolocation')

    expect(geolocation?.type).toBe('geolocation')
    if (geolocation?.type === 'geolocation') {
      expect(geolocation.points[0]).toMatchObject({
        coordinates: [113.318474, 23.427542],
        externalUrl: url,
      })
    }
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

  it('keeps named Google directions endpoints in payload coordinate order', () => {
    const url = 'https://www.google.com/maps/dir/Longshan+Temple/Bopiliao+Historical+Block/@25.0366454,121.5008012,307m/data=!4m18!4m17!1m5!1m1!1s0x3442a9a8d7e7de09:0xf8e8335e58c41c8a!2m2!1d121.4998654!2d25.0373106!1m5!1m1!1s0x3442a9a8d017b6dd:0xff3361bbadd40fe9!2m2!1d121.5021648!2d25.036838!3e2'
    const text = `* _Маршрут пешком_: [Google Maps: Longshan Temple → Bopiliao Historical Block](${url})`
    const locations = extractLocationsFromText(text)

    expect(locations).toHaveLength(2)
    expect(locations.map(location => location.coordinates)).toEqual([
      [121.4998654, 25.0373106],
      [121.5021648, 25.036838],
    ])
    expect(locations.map(location => location.pointType)).toEqual(['start', 'end'])
  })

  it('ignores Google directions camera and map-mode path segments', () => {
    const url = 'https://www.google.com/maps/dir/25.0355642,121.4999438/25.0368022,121.4998956/@25.0355642,121.4973689,1270m/am=t/data=!3m1!1e3!4m6!4m5!3e2'
    const text = `* _Маршрут пешком_: [Google Maps: MRT Longshan Temple → Longshan Temple](${url})`
    const locations = extractLocationsFromText(text)

    expect(locations).toHaveLength(2)
    expect(locations.map(location => location.coordinates)).toEqual([
      [121.4999438, 25.0355642],
      [121.4998956, 25.0368022],
    ])
  })

  it('does not create an am=t waypoint for a named Google walking route', () => {
    const url = 'https://www.google.com/maps/dir/Bopiliao+Historical+Block,+Lane+173,+Kangding+Rd,+Fuyin+Village,+Wanhua+District,+Taipei+City,+Taiwan+108/The+Red+House,+No.+10,+Chengdu+Rd,+Ximen+Village,+Wanhua+District,+Taipei+City,+Taiwan+108/@25.0401668,121.5045655,848m/am=t/data=!3m2!1e3!5s0x3442a909a49c352f:0x94934848da84e6ed!4m18!4m17!1m5!1m1!1s0x3442a9a8d017b6dd:0xff3361bbadd40fe9!2m2!1d121.5021648!2d25.036838!1m5!1m1!1s0x3442a909a4acec8b:0x7c34275cfedcc1c5!2m2!1d121.5068592!2d25.0420139!3e2'
    const text = `* _Маршрут пешком_: [Google Maps: Bopiliao Historical Block → The Red House](${url})`
    const locations = extractLocationsFromText(text)

    expect(locations).toHaveLength(2)
    expect(locations.map(location => location.name)).toEqual([
      'Bopiliao Historical Block, Lane 173, Kangding Rd, Fuyin Village, Wanhua District, Taipei City, Taiwan 108',
      'The Red House, No. 10, Chengdu Rd, Ximen Village, Wanhua District, Taipei City, Taiwan 108',
    ])
    expect(locations.map(location => location.pointType)).toEqual(['start', 'end'])
  })

  it('aligns a named origin and coordinate destination in Google directions', () => {
    const url = 'https://www.google.com/maps/dir/Dihua+Old+Street/25.0627303,121.510896/@25.058117,121.507176,1270m/data=!4m14!4m13!1m5!1m1!1s0x3442a91438867265:0xc524ad8c103e4a1e!2m2!1d121.5097835!2d25.0581195!1m0!3e2'
    const text = `* _Маршрут пешком_: [Google Maps: Dihua Old Street → MRT D3](${url})`
    const locations = extractLocationsFromText(text)

    expect(locations).toHaveLength(2)
    expect(locations.map(location => location.name)).toEqual(['Dihua Old Street', 'MRT D3'])
    expect(locations.map(location => location.coordinates)).toEqual([
      [121.5097835, 25.0581195],
      [121.510896, 25.0627303],
    ])
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

  it('parses structured transport blocks and keeps bus routes readable for the current API', () => {
    const metroBlock = parseTransportBlock(`
type: metro
title: Taoyuan Airport MRT + Taipei MRT

routes:
  - from: Airport Terminal 2 (A13)
    to: Taipei Main Station (A1)
    line: Taoyuan Airport MRT
    code: A
    color: "#A93C93"
    direction: Taipei Main Station
    stops: 2
  - from: Taipei Main Station (R10)
    to: Dongmen (R07)
    line: Tamsui–Xinyi Line
    code: R
    color: "#D2072A"
    direction: Xiangshan
    stops: 3
`.trim())

    expect(metroBlock).toMatchObject({
      type: 'metro',
      title: 'Taoyuan Airport MRT + Taipei MRT',
    })
    expect(metroBlock?.routes).toHaveLength(2)
    expect(metroBlock?.routes[0]).toMatchObject({
      from: 'Airport Terminal 2 (A13)',
      to: 'Taipei Main Station (A1)',
      route: 'Taoyuan Airport MRT',
      code: 'A',
      color: '#A93C93',
      stops: 2,
    })

    const metroActivity = parseActivitiesFromMarkdown(`
* **15:30 - 16:30** — Airport MRT:
\`\`\`transport
type: metro
title: Taoyuan Airport MRT + Taipei MRT

routes:
  - from: Airport Terminal 2 (A13)
    to: Taipei Main Station (A1)
    line: Taoyuan Airport MRT
    code: A
    color: "#A93C93"
    direction: Taipei Main Station
    stops: 2
\`\`\`
`.trim())[0]
    const metroSection = metroActivity.sections?.find(section => section.type === 'metro')

    expect(metroSection?.type === 'metro' ? metroSection.rides : []).toHaveLength(1)
    expect(metroSection?.type === 'metro' ? metroSection.rides[0].lineName : '').toBe('Taoyuan Airport MRT')

    const activity = parseActivitiesFromMarkdown(`
* **10:00 - 11:00** — Автобус до деревни:
\`\`\`transport
type: bus
title: Chiayi → Hinoki Village

routes:
  - from: TRA Chiayi Station
    to: Hinoki Village
    route: Zhongxiao Xinmin Main Line
    code: Red A
    operator: Kuo-Kuang
    direction: Minxiong Industrial Park Service Center
    stops: 2
    walk: 95 м / 2 мин
\`\`\`
`.trim())[0]
    const description = activity.sections?.find(section => section.type === 'description')

    expect(description?.type === 'description' ? description.text : '').toContain('Kuo-Kuang')
    expect(description?.type === 'description' ? description.text : '').toContain('95 м / 2 мин')
    expect(description?.type === 'description' ? description.text : '').not.toContain('```transport')
  })

  it('extracts clean day title removing number prefixes', () => {
    const title1 = extractDayTitle('01 Тайбэй (пт) 🛬 Врата на Формозу', 1)
    expect(title1).toBe('🛬 Врата на Формозу')

    const title2 = extractDayTitle('02 Токио', 2)
    expect(title2).toBe('Токио')
  })
})

describe('Activity Enrichment', () => {
  it('attaches a flight booking only to the activity overlapping the flight time', async () => {
    const { enrichActivityWithMediaAndLocation } = await import('../lib/enricher')
    const booking = {
      id: 'flight-cz3097',
      type: 'flight' as const,
      icon: 'mdi:airplane',
      title: 'Гуанчжоу - Тайбэй',
      data: {
        segments: [{
          departureCity: 'Гуанчжоу',
          arrivalCity: 'Тайбэй',
          departureDateTime: '2026-11-06T12:00:00',
          arrivalDateTime: '2026-11-06T14:15:00',
          flightNumber: 'CZ3097',
        }],
      },
    }
    const activities = [
      {
        startTime: '07:30',
        endTime: '08:00',
        title: 'Сборы и чек-аут',
        description: 'Проверьте посадочный талон на CZ3097.',
      },
      {
        startTime: '08:00',
        endTime: '09:00',
        title: 'Шаттл в CAN-T2',
        description: 'Вернитесь в терминал до вылета CZ3097.',
      },
      {
        startTime: '09:00',
        endTime: '12:00',
        title: 'Контроль и ожидание рейса CZ3097',
        description: 'Пройдите формальности перед посадкой.',
      },
      {
        startTime: '12:00',
        endTime: '14:15',
        title: 'Перелет Гуанчжоу - Тайбэй',
        description: 'Рейс CZ3097 на Тайвань.',
      },
    ]

    const enriched = await Promise.all(activities.map(activity => enrichActivityWithMediaAndLocation(
      {
        startTime: activity.startTime,
        endTime: activity.endTime,
        title: activity.title,
        tag: 'transport',
        sections: [{ id: `desc-${activity.startTime}`, type: 'description', text: activity.description }],
      },
      new Map(),
      null,
      null,
      new Map(),
      new Map(),
      { geocode: false, bookings: [booking], dayDate: '2026-11-06' },
    )))

    const bookingSections = enriched.map(activity => activity.sections?.filter(section => section.type === 'booking') ?? [])
    expect(bookingSections.slice(0, 3).every(sections => sections.length === 0)).toBeTrue()
    expect(bookingSections[3]).toHaveLength(1)
    expect(bookingSections[3][0]).toMatchObject({ bookingId: 'flight-cz3097' })
  })

  it('keeps a parsed metro section while enriching the activity description', async () => {
    const { enrichActivityWithMediaAndLocation } = await import('../lib/enricher')
    const rawAct = {
      startTime: '15:30',
      endTime: '16:30',
      title: 'Airport MRT',
      tag: 'transport' as const,
      sections: [
        {
          id: 'desc-1',
          type: 'description' as const,
          text: 'Сесть на поезд и доехать до отеля.',
        },
        {
          id: 'metro-1',
          type: 'metro' as const,
          mode: 'free' as const,
          systemId: null,
          rides: [{
            id: 'ride-1',
            startStationId: null,
            startStation: 'A13',
            endStationId: null,
            endStation: 'A1',
            lineId: null,
            lineName: 'Taoyuan Airport MRT',
            lineNumber: 'A',
            lineColor: '#A93C93',
            direction: 'Taipei Main Station',
            stops: 2,
          }],
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

    const metro = res.sections?.find(section => section.type === 'metro')
    expect(metro?.type === 'metro' ? metro.rides : []).toHaveLength(1)
    expect(metro?.type === 'metro' ? metro.rides[0].endStation : '').toBe('A1')
  })

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

  it('generates stable folder IDs and supports direct path to PrivateDocuments', () => {
    const tempTripDir = mkdtempSync(join(tmpdir(), 'trip-stable-doc-test-'))
    try {
      const privateDocsDir = join(tempTripDir, '_', 'PrivateDocuments')
      const hotelsDir = join(privateDocsDir, 'Отели')
      const flightsDir = join(privateDocsDir, 'Авибилеты')
      mkdirSync(hotelsDir, { recursive: true })
      mkdirSync(flightsDir, { recursive: true })

      writeFileSync(join(hotelsDir, 'Yoshi Hotel.pdf'), 'HOTEL-PDF')
      writeFileSync(join(flightsDir, 'SVO-TPE-SVO.pdf'), 'FLIGHT-PDF')

      const fromRoot1 = parseObsidianDocuments(tempTripDir)
      const fromRoot2 = parseObsidianDocuments(tempTripDir)

      expect(fromRoot1.documentsContent.folders).toHaveLength(2)
      expect(fromRoot1.documents).toHaveLength(2)
      // Folder IDs must be stable across multiple runs
      expect(fromRoot1.documentsContent.folders[0].id).toBe(fromRoot2.documentsContent.folders[0].id)
      expect(fromRoot1.documentsContent.folders[1].id).toBe(fromRoot2.documentsContent.folders[1].id)

      // Direct path to PrivateDocuments directory must also parse identically
      const fromDirect = parseObsidianDocuments(privateDocsDir)
      expect(fromDirect.documentsContent.folders).toHaveLength(2)
      expect(fromDirect.documents).toHaveLength(2)
      expect(fromDirect.documentsContent.folders.map(f => f.id).sort())
        .toEqual(fromRoot1.documentsContent.folders.map(f => f.id).sort())
    }
    finally {
      rmSync(tempTripDir, { recursive: true, force: true })
    }
  })
})
