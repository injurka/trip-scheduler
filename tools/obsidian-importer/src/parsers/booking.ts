/* eslint-disable no-misleading-character-class */
import type { Booking, BookingSectionContent, FlightSegment } from '../types'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Месяцы для парсинга текстовых дат (например, "29 окт", "21 нояб")
 */
const MONTHS_MAP: Record<string, number> = {
  янв: 0,
  фев: 1,
  мар: 2,
  апр: 3,
  мая: 4,
  май: 4,
  июн: 5,
  июл: 6,
  авг: 7,
  сен: 8,
  окт: 9,
  ноя: 10,
  дек: 11,
}

function parseDateSnippet(snippet: string, fallbackDate: Date): string {
  const m = snippet.match(/(\d{1,2})\s*([а-яё]+)/i)
  if (m) {
    const day = Number.parseInt(m[1], 10)
    const monthStr = m[2].toLowerCase().slice(0, 3)
    const month = MONTHS_MAP[monthStr] ?? fallbackDate.getMonth()
    const d = new Date(fallbackDate.getFullYear(), month, day, 12, 0, 0)
    return d.toISOString().split('T')[0]
  }
  return fallbackDate.toISOString().split('T')[0]
}

function inferTimezone(airportOrCity?: string): string {
  if (!airportOrCity)
    return '+03:00'
  const norm = airportOrCity.toUpperCase()
  if (/SVO|DME|VKO|LED|МОСКВА|ПИТЕР|САНКТ|МУРМАНСК|MMK/i.test(norm))
    return '+03:00'
  if (/ULV|УЛЬЯНОВСК|SAMARA|KUF/i.test(norm))
    return '+04:00'
  if (/TPE|CAN|TFU|CSX|CKG|HGH|PEK|PVG|SHA|ТАЙБЭЙ|ГУАНЧЖОУ|КИТАЙ|ТАЙВАНЬ|ШАНХАЙ|ПЕКИН|ЧАНША|ЧУНЦИН|ЧЭНДУ/i.test(norm))
    return '+08:00'
  if (/NRT|HND|KIX|ТОКИО|ОСАКА|ЯПОНИЯ/i.test(norm))
    return '+09:00'
  if (/ICN|GMP|СЕУЛ|КОРЕЯ/i.test(norm))
    return '+09:00'
  if (/DPS|БАЛИ|ИНДОНЕЗИЯ/i.test(norm))
    return '+08:00'
  if (/BKK|HKT|ТАИЛАНД|ПХУКЕТ|БАНГКОК/i.test(norm))
    return '+07:00'
  return '+03:00'
}

/**
 * Удаляет эмодзи и пиктограммы из строки, оставляя только текст.
 */
function removeEmoji(str: string): string {
  if (!str)
    return ''
  return str
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\u200D/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Формирует заголовок для записи об отеле.
 * Возвращает только название отеля без локации и дат.
 */
function makeHotelTitle(hotelName: string): string {
  return hotelName || 'Отель'
}

/**
 * Формирует чистый заголовок перелёта вида «Город1 - Город2»
 * из заголовка секции или массива сегментов.
 */
function makeFlightTitle(raw: string, isOutbound: boolean, isInbound: boolean, segments?: FlightSegment[]): string {
  // Приоритет — использовать города из распарсенных сегментов
  if (segments && segments.length > 0) {
    const first = segments[0]
    const last = segments[segments.length - 1]
    if (first.departureCity && last.arrivalCity) {
      return `${first.departureCity} - ${last.arrivalCity}`
    }
  }

  if (!raw)
    return isOutbound ? 'Рейс ТУДА' : (isInbound ? 'Рейс ОБРАТНО' : 'Авиаперелет')

  // Заменяем стрелки на " - " до удаления символов
  let clean = raw.replace(/\s*(?:➔|->|—|–)\s*/g, ' - ')

  // Убираем коды аэропортов в скобках: (SVO), (MMK), (SVO-B)
  clean = clean.replace(/\s*\([A-Z0-9]{3}(?:-[A-Z0-9]+)?\)/gi, '')

  // Убираем emoji и markdown
  clean = removeEmoji(clean)
  clean = clean.replace(/[*_`#\\]/g, '')

  // Нормализуем разделитель
  clean = clean.replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ').trim()

  return clean || (isOutbound ? 'Рейс ТУДА' : (isInbound ? 'Рейс ОБРАТНО' : 'Авиаперелет'))
}

/**
 * Парсер отелей из файла Отели.md
 */
export function parseHotelsMarkdown(content: string, startDateStr: string): Booking[] {
  const startDate = new Date(startDateStr)
  const bookings: Booking[] = []

  // 1. Ищем детали отелей по подсекциям (каталогу)
  const detailSections = content.split(/\n(?=###?\s+)/)
  const featuresMap = new Map<string, string>()

  for (const sec of detailSections) {
    const mainHotelMatch = sec.match(/\*\s*\*\*№?1?\s*\(?(?:Основной|Флагманский выбор|Основной выбор)?\)?:\*\*\s*\[?([^\]\n*]+)\]?(?:\(([^)]+)\))?[^\n]*/i)
      || sec.match(/####?\s*\d*\.?\s*(?:🏆|🎨|🌲|🌊)?\s*\[?([^\n(\]]+)\]?/i)

    if (mainHotelMatch) {
      const rawName = mainHotelMatch[1].replace(/[*_`]/g, '').trim()
      const featuresMatch = sec.match(/\*\s*\*(?:Особенности|Инфраструктура и удобства|Инфраструктура|Сервис и особенности):\*\s*([^\n]+)/i)
        || sec.match(/\*\s*\*\*Инфраструктура[^*]*\*\*:\s*([^\n]+)/i)

      if (featuresMatch && rawName) {
        featuresMap.set(rawName.toLowerCase(), featuresMatch[1].trim())
      }
    }
  }

  // 2. Парсим таблицу отелей
  const lines = content.split('\n')

  // Динамические индексы столбцов — определяем по строке заголовка таблицы
  let colNights = 0
  let colLocation = 1
  let colHotel = 2
  let colFeatures = 3
  let colPriceNight = 4
  let colTotal = 5
  let headerDetected = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|'))
      continue

    // Строка разделителя
    if (trimmed.includes('---'))
      continue

    const cols = trimmed.slice(1, -1).split('|').map(c => c.trim())

    // Пытаемся распознать строку заголовка таблицы
    if (!headerDetected && /ночи|локаци|отел|итого|цена/i.test(trimmed)) {
      // Определяем индексы по ключевым словам в заголовках
      const lc = cols.map(c => c.toLowerCase())
      const findIdx = (patterns: RegExp[]): number => {
        for (const p of patterns) {
          const idx = lc.findIndex(c => p.test(c))
          if (idx !== -1)
            return idx
        }
        return -1
      }

      const iNights = findIdx([/ночи|ночь|дни/])
      const iLocation = findIdx([/локаци|город/])
      const iHotel = findIdx([/отел/])
      const iFeatures = findIdx([/особен|инфра|удобства|оценка/])
      const iPriceNight = findIdx([/цена|стоимост.*ночь/])
      const iTotal = findIdx([/итого/])

      if (iNights !== -1)
        colNights = iNights
      if (iLocation !== -1)
        colLocation = iLocation
      if (iHotel !== -1)
        colHotel = iHotel
      if (iFeatures !== -1)
        colFeatures = iFeatures
      if (iPriceNight !== -1)
        colPriceNight = iPriceNight
      if (iTotal !== -1)
        colTotal = iTotal

      headerDetected = true
      continue
    }

    // Пропускаем строки заголовков и прочие нежелательные строки
    if (/ночи|локация|отель|итого|стоимость \/ ночь/i.test(trimmed))
      continue

    if (cols.length >= 4) {
      const nightsCol = cols[colNights]?.replace(/[*_`]/g, '').trim() ?? ''
      const rawLocationCol = cols[colLocation] ?? ''
      const hotelCol = cols[colHotel] ?? ''
      const featuresCol = cols[colFeatures]?.replace(/[*_`]/g, '').trim() ?? ''
      const priceNightCol = cols[colPriceNight]?.replace(/[*_`]/g, '').trim() ?? ''
      const totalCol = cols[colTotal]?.replace(/[*_`]/g, '').trim() ?? ''

      let hotelName = hotelCol.replace(/[_`]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
      let sourceUrl: string | undefined
      const linkMatch = hotelCol.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (linkMatch) {
        hotelName = linkMatch[1].replace(/[_`\\]/g, '').trim()
        sourceUrl = linkMatch[2].trim()
      }

      // Убираем эмодзи из имени отеля
      hotelName = removeEmoji(hotelName)

      // Если отель основной или единственный в строке
      if (hotelName && !/опция|альтернатива/i.test(nightsCol)) {
        // Поддержка нескольких периодов проживания в одной строке (например, "14–15, 17–18")
        const subRanges = nightsCol.split(',').map(s => s.trim()).filter(Boolean)
        const parsedRanges: Array<{ start: number, end: number }> = []

        for (const sub of subRanges) {
          const rangeMatch = sub.match(/(\d{1,2})\s*[-–—]\s*(\d{1,2})/)
          if (rangeMatch) {
            parsedRanges.push({
              start: Number.parseInt(rangeMatch[1], 10),
              end: Number.parseInt(rangeMatch[2], 10),
            })
          }
          else {
            const singleMatch = sub.match(/(\d{1,2})/)
            if (singleMatch) {
              const num = Number.parseInt(singleMatch[1], 10)
              parsedRanges.push({ start: num, end: num })
            }
          }
        }

        if (parsedRanges.length === 0) {
          parsedRanges.push({ start: 1, end: 1 })
        }

        for (let rIdx = 0; rIdx < parsedRanges.length; rIdx++) {
          const { start: startDayNum, end: endDayNum } = parsedRanges[rIdx]

          const inDate = new Date(startDate)
          inDate.setDate(inDate.getDate() + (startDayNum - 1))
          const checkInDate = inDate.toISOString().split('T')[0]

          const outDate = new Date(startDate)
          outDate.setDate(outDate.getDate() + endDayNum)
          const checkOutDate = outDate.toISOString().split('T')[0]

          const features = featuresMap.get(hotelName.toLowerCase()) || featuresCol || ''
          const priceInfo = priceNightCol ? `${priceNightCol} / ночь${totalCol ? ` (Итого: ${totalCol})` : ''}` : ''
          const notesParts = [priceInfo, features].filter(Boolean)
          const notes = notesParts.join('. ')

          // Чистим локацию: убираем эмодзи, разметку, даты в скобках типа "(30 окт – 03 ноя)"
          const cleanLocation = removeEmoji(rawLocationCol)
            .replace(/[*_`]/g, '')
            .replace(/\(\s*\d{1,2}\s*[а-яё]+[^)]*–[^)]*\)/gi, '') // убираем диапазоны дат
            .replace(/\(\s*\d{1,2}\s*[а-яё]+[^)]*\)/gi, '') // убираем одиночные даты
            .replace(/\s+/g, ' ')
            .trim()

          const baseTitle = makeHotelTitle(hotelName)
          const stayTitle = parsedRanges.length > 1 ? `${baseTitle} (${rIdx + 1}-й заезд)` : baseTitle

          bookings.push({
            id: crypto.randomUUID(),
            type: 'hotel',
            icon: 'mdi:hotel',
            title: stayTitle,
            data: {
              hotelName,
              address: cleanLocation || undefined,
              checkInDate,
              checkOutDate,
              notes: notes || undefined,
              sourceUrl,
            },
          })
        }
      }
    }
  }

  // 3. Fallback: Если таблицы нет, парсим из списков каталога
  if (bookings.length === 0) {
    for (const sec of detailSections) {
      const linkMatch = sec.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/)
      const nameMatch = sec.match(/####?\s*\d*\.?\s*(?:🏆|🎨|🌲|🌊)?\s*([^\n(\]]+)/i)
      if (linkMatch || nameMatch) {
        const hotelName = (linkMatch ? linkMatch[1] : nameMatch![1]).replace(/[*_`\\]/g, '').trim()
        const sourceUrl = linkMatch ? linkMatch[2].trim() : undefined
        const locMatch = sec.match(/\*\s*\*(?:Локация|Адрес):\*\s*([^\n]+)/i)
        const priceMatch = sec.match(/\*\s*\*(?:Стоимость|Цена):\*\s*`?([^`\n]+)`?/i)
        const notesMatch = sec.match(/\*\s*\*(?:Инфраструктура|Особенности):\*\s*([^\n]+)/i)

        const address = locMatch ? locMatch[1].replace(/[*_`]/g, '').trim() : undefined
        const notes = [priceMatch ? `Стоимость: ${priceMatch[1].trim()}` : '', notesMatch ? notesMatch[1].trim() : ''].filter(Boolean).join('. ')

        bookings.push({
          id: crypto.randomUUID(),
          type: 'hotel',
          icon: 'mdi:hotel',
          title: `Отель: ${hotelName}`,
          data: {
            hotelName,
            address,
            checkInDate: startDateStr,
            checkOutDate: startDateStr,
            notes: notes || undefined,
            sourceUrl,
          },
        })
      }
    }
  }

  return bookings
}

/**
 * Парсер авиаперелетов из файла Авиаперелеты.md
 */
export function parseFlightsMarkdown(content: string, startDateStr: string, endDateStr?: string): Booking[] {
  const startDate = new Date(startDateStr)
  const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate)
  const bookings: Booking[] = []

  // Общая ссылка на покупку билетов и общие примечания
  let sourceUrl: string | undefined
  const linkMatch = content.match(/\[[^\]]*(?:Trip\.com|Авиасейлс|Билет|Купить|Бронирован)[^\]]*\]\((https?:\/\/[^)]+)\)/i)
    || content.match(/\(?(https?:\/\/[^\s\)]+trip\.com[^\s\)]*)\)?/i)
  if (linkMatch) {
    sourceUrl = linkMatch[1].trim()
  }

  let generalNotes = ''
  const priceMatch = content.match(/Стоимость:[^\n*]+`?([^\n`*]+)`?/i)
  if (priceMatch) {
    generalNotes = `Стоимость: ${priceMatch[1].trim()}`
  }

  // Разделяем на секции перелетов
  const flightSections = content.split(/\n(?=##\s*(?:🛫|✈️)?\s*\d*\.?\s*Перелет)/i)

  for (const fSec of flightSections) {
    const isOutbound = /ТУДА|Москва\s*➔|вылет|отправлен/i.test(fSec) && !/ОБРАТНО/i.test(fSec)
    const isInbound = /ОБРАТНО|➔\s*Москва|возвращен/i.test(fSec)

    // Извлекаем сырой заголовок маршрута из заголовка секции (после «Перелет ...:»)
    const titleMatch = fSec.match(/##\s*[^\n]*(?:Перелет|Рейс)[^\n:]*:\s*([^\n]+)/i)
    const rawRouteTitle = titleMatch ? titleMatch[1].trim() : ''

    const segments: FlightSegment[] = []
    const lines = fSec.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && !trimmed.includes('---') && !/сегмент|рейс|отправление/i.test(trimmed)) {
        const cols = trimmed.slice(1, -1).split('|').map(c => c.trim())
        if (cols.length >= 4 && !/пересадка|стыковка/i.test(cols[0])) {
          const routeCol = cols[0]
          const flightCol = cols[1]
          const depCol = cols[2]
          const arrCol = cols[3]

          const citiesMatch = routeCol.match(/\*\*?([^(➔\n]+)(?:\(([^)\-]+)(?:-([^\)]+))?\))?\s*➔\s*([^(➔\n]+)(?:\(([^)\-]+)(?:-([^\)]+))?\)?)?\*\*?/)
          if (citiesMatch) {
            const departureCity = citiesMatch[1].trim()
            const departureAirport = citiesMatch[2]?.trim() || 'SVO'
            const terminalDeparture = citiesMatch[3]?.trim()

            const arrivalCity = citiesMatch[4].trim()
            const arrivalAirport = citiesMatch[5]?.trim() || 'TPE'
            const terminalArrival = citiesMatch[6]?.trim()

            const fnMatch = flightCol.match(/([A-Z0-9]{2}\s*\d{1,4})/i)
            const flightNumber = fnMatch ? fnMatch[1].trim() : ''
            const aircraftMatch = flightCol.match(/`?([A-Za-z0-9\s\-]+(?:A3\d\d|Boeing\s*\d\d\d|Airbus|Сухой|SSJ|Embraer)[^`<]*)`?/i)
            const aircraft = aircraftMatch ? aircraftMatch[1].trim() : ''

            const depTimeMatch = depCol.match(/(\d{1,2}:\d{2})/)
            const depTime = depTimeMatch ? depTimeMatch[1] : '12:00'
            const depDateStr = parseDateSnippet(depCol, isOutbound ? startDate : endDate)

            const arrTimeMatch = arrCol.match(/(\d{1,2}:\d{2})/)
            const arrTime = arrTimeMatch ? arrTimeMatch[1] : '14:00'
            const arrDateStr = parseDateSnippet(arrCol, isOutbound ? startDate : endDate)

            const departureTimeZone = inferTimezone(departureAirport)
            const arrivalTimeZone = inferTimezone(arrivalAirport)

            segments.push({
              departureCity,
              arrivalCity,
              departureAirport,
              arrivalAirport,
              terminalDeparture: terminalDeparture || undefined,
              terminalArrival: terminalArrival || undefined,
              flightNumber: flightNumber || undefined,
              airline: flightNumber.startsWith('CZ') ? 'China Southern Airlines' : (flightNumber.startsWith('SU') ? 'Аэрофлот' : undefined),
              aircraft: aircraft || undefined,
              departureDateTime: `${depDateStr}T${depTime}:00`,
              arrivalDateTime: `${arrDateStr}T${arrTime}:00`,
              departureTimeZone,
              arrivalTimeZone,
            })
          }
        }
      }
    }

    if (segments.length > 0) {
      bookings.push({
        id: crypto.randomUUID(),
        type: 'flight',
        icon: 'mdi:airplane',
        title: makeFlightTitle(rawRouteTitle, isOutbound, isInbound, segments),
        data: {
          bookingReference: '',
          sourceUrl: sourceUrl || undefined,
          notes: generalNotes || undefined,
          segments,
        },
      })
    }
  }

  // 4. Fallback: Если структурированных сегментов в таблице не найдено (как в кратких перелетах Мурманска)
  if (bookings.length === 0) {
    const routeMatch = content.match(/Маршрут:[^\n`*]+`?([A-Z\s/]+➔[A-Z\s/]+)`?/i)
      || content.match(/Москва\s*➔\s*([^\n(\]]+)/i)

    const routeText = routeMatch ? routeMatch[0].replace(/[*_`]/g, '').trim() : 'Москва ➔ Регион'
    const cleanTitle = makeFlightTitle(routeText, true, false)

    bookings.push({
      id: crypto.randomUUID(),
      type: 'flight',
      icon: 'mdi:airplane',
      title: cleanTitle,
      data: {
        bookingReference: '',
        sourceUrl: sourceUrl || undefined,
        notes: generalNotes || undefined,
        segments: [
          {
            departureCity: 'Москва',
            departureAirport: 'SVO',
            arrivalCity: 'Пункт назначения',
            departureDateTime: `${startDateStr}T10:00:00`,
            arrivalDateTime: `${startDateStr}T12:40:00`,
            departureTimeZone: '+03:00',
            arrivalTimeZone: '+03:00',
          },
        ],
      },
    })
  }

  return bookings
}

/**
 * Парсер поездов, трансферов и экскурсий из файла Транспорт.md / Поезда.md
 */
export function parseTransportMarkdown(content: string, startDateStr: string): Booking[] {
  const startDate = new Date(startDateStr)
  const bookings: Booking[] = []
  const lines = content.split('\n')

  // Собираем ссылки из текста советов в конце файла
  const urlMap = new Map<string, string>()
  const links = content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)
  for (const l of links) {
    const text = l[1].toLowerCase()
    const url = l[2]
    urlMap.set(text, url)
    if (url.includes('rosatomflot'))
      urlMap.set('ленин', url)
    if (url.includes('oopt-murman'))
      urlMap.set('оопт', url)
    if (url.includes('sam-syit'))
      urlMap.set('саам', url)
  }

  /**
   * Определяет иконку и тип транспорта по тексту в колонке «Транспорт».
   * Возвращает { type, icon } для Booking.
   */
  function classifyTransport(transportText: string, segmentText: string): { type: 'train' | 'car', icon: string } {
    const t = transportText.toLowerCase()
    const s = segmentText.toLowerCase()

    // Паром / корабль
    if (/паром|ferry|⛴|корабл|судно/i.test(t) || /паром|ferry|⛴/i.test(s))
      return { type: 'train', icon: 'mdi:ferry' }

    // Автобус (включая горные, шаттлы и городские)
    if (/автобус|bus|🚌|шаттл|shuttle/i.test(t))
      return { type: 'train', icon: 'mdi:bus' }

    // Метро / MRT / подземка
    if (/метро|mrt|🚇|subway|underground/i.test(t))
      return { type: 'train', icon: 'mdi:subway-variant' }

    // Скоростной поезд THSR
    if (/thsr|高鐵|скоростн|🚄|high.speed/i.test(t))
      return { type: 'train', icon: 'mdi:train-variant' }

    // Обычный поезд TRA / EMU / узкоколейка
    if (/tra|поезд|train|🚆|🚂|emu|узкоколейн|tze-chiang/i.test(t))
      return { type: 'train', icon: 'mdi:train' }

    // Мотоцикл / электробайк / скутер
    if (/мотоцикл|скутер|байк|мопед|e-bike|ebike|🛵/i.test(t))
      return { type: 'car', icon: 'mdi:moped' }

    // Такси / машина / авто / аренда
    if (/такси|taxi|авто|машина|car|джип|трансфер|аренда|🚗|🚖|grab|uber/i.test(t)
      || /такси|авто|прокат|трансфер/i.test(s)) {
      return { type: 'car', icon: 'mdi:car' }
    }

    // Fallback
    return { type: 'train', icon: 'mdi:transit-transfer' }
  }

  /**
   * Извлекает маршрут «A ➔ B» из сегмента или генерирует осмысленное название.
   * Никогда не возвращает дату или пустую строку.
   */
  function extractRouteTitle(segmentCol: string, transportCol: string): { title: string, from: string, to: string } {
    // Ищем стрелочный маршрут A ➔ B (может быть несколько точек через ➔)
    const arrowMatch = segmentCol.match(/(.+?)\s*➔\s*(.+)/)
    if (arrowMatch) {
      // Берём первую и последнюю точки если несколько ➔
      const parts = segmentCol.split(/\s*➔\s*/)
      const to = parts[parts.length - 1].trim()
      const fromClean = parts[0].trim()
      return { title: `${fromClean} ➔ ${to}`, from: fromClean, to }
    }

    // Ищем паттерн «Аэропорт / Вокзал / Порт» в тексте сегмента
    const locationParts = segmentCol.split(/[(),;]+/).map(s => s.trim()).filter(s => s.length > 3)
    if (locationParts.length >= 2) {
      const from = locationParts[0]
      const to = locationParts[1]
      return { title: `${from} ➔ ${to}`, from, to }
    }

    // Попытка извлечь имя из колонки транспорта
    const transportClean = removeEmoji(transportCol).replace(/[*_`]/g, '').replace(/\([^)]*\)/g, '').trim()
    if (transportClean && transportClean.length > 4)
      return { title: transportClean, from: '', to: '' }

    // Финальный fallback — хоть что-то осмысленное
    const segClean = removeEmoji(segmentCol).replace(/[*_`]/g, '').replace(/\d{1,2}\s*[а-яё]+\s*(?:\([^)]*\))?/gi, '').trim()
    return { title: segClean || 'Трансфер', from: '', to: '' }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && !trimmed.includes('---') && !/сегмент|маршрут|время в пути|отправление/i.test(trimmed)) {
      const cols = trimmed.slice(1, -1).split('|').map(c => c.trim())

      // Формат графика: | День | Дата/День | Сегмент | Транспорт | Время в пути | Способ бронирования |
      if (cols.length >= 5 && /^\s*\*?\*?\d{1,2}/.test(cols[0])) {
        const dayCol = cols[0].replace(/[*_`]/g, '').trim()
        // Гибко определяем, какая колонка что содержит:
        // col[1] может быть "дата/день недели" или сразу сегмент (если 5 колонок)
        // Если col[1] выглядит как дата — col[2] это сегмент, col[3] транспорт, col[4] время, col[5] оплата
        // Если col[1] не дата — col[1] это сегмент, col[2] транспорт, col[3] время, col[4] оплата
        let segmentCol: string
        let transportCol: string
        let durationCol: string
        let paymentCol: string

        const col1LooksLikeDate = /^\d{1,2}\s*[а-яё]+\s*(?:\([^)]*\))?$/i.test(cols[1].replace(/[*_`]/g, '').trim())

        if (col1LooksLikeDate && cols.length >= 6) {
          // формат с отдельной колонкой даты
          segmentCol = cols[2].replace(/[*_`]/g, '').trim()
          transportCol = cols[3].replace(/[*_`]/g, '').trim()
          durationCol = cols[4].replace(/[*_`]/g, '').trim()
          paymentCol = cols[5]?.replace(/[*_`]/g, '').trim() ?? ''
        }
        else {
          // стандартный формат (дата вместе с номером дня, или её нет)
          segmentCol = cols[1].replace(/[*_`]/g, '').trim()
          transportCol = cols[2].replace(/[*_`]/g, '').trim()
          durationCol = cols[3].replace(/[*_`]/g, '').trim()
          paymentCol = cols[4]?.replace(/[*_`]/g, '').trim() ?? ''
        }

        // Если сегмент по-прежнему похож на дату — пробуем следующую колонку
        if (/^\d{1,2}\s*[а-яё]+\s*(?:\([^)]*\))?$/i.test(segmentCol) && cols.length > 5) {
          segmentCol = cols[2].replace(/[*_`]/g, '').trim()
          transportCol = cols[3].replace(/[*_`]/g, '').trim()
          durationCol = cols[4].replace(/[*_`]/g, '').trim()
          paymentCol = cols[5]?.replace(/[*_`]/g, '').trim() ?? ''
        }

        const dayNum = Number.parseInt(dayCol, 10) || 1
        const eventDate = new Date(startDate)
        eventDate.setDate(eventDate.getDate() + (dayNum - 1))
        const dateStr = eventDate.toISOString().split('T')[0]

        // Пропускаем короткие внутригородские поездки (такси не к аэропорту)
        if (/яндекс\s*go|городское\s*такси/i.test(transportCol) && !/аэропорт/i.test(segmentCol))
          continue

        // Пропускаем передвижения внутри острова (без ➔ и слишком короткие описания)
        if (!segmentCol || segmentCol.length < 5)
          continue

        let sourceUrl: string | undefined
        for (const [key, url] of urlMap.entries()) {
          if (segmentCol.toLowerCase().includes(key) || transportCol.toLowerCase().includes(key) || paymentCol.toLowerCase().includes(key)) {
            sourceUrl = url
            break
          }
        }
        if (!sourceUrl) {
          const directUrlMatch = paymentCol.match(/([a-z0-9\-]+\.(?:ru|com|org|net|tw)\/\S+)/i)
            || paymentCol.match(/(?:https?:\/\/)([a-z0-9\-.]+\.[a-z]{2,})/i)
          if (directUrlMatch) {
            sourceUrl = directUrlMatch[0].startsWith('http') ? directUrlMatch[0] : `https://${directUrlMatch[1]}`
          }
        }

        const notes = [
          transportCol,
          durationCol ? `Время в пути: ${durationCol}` : '',
          paymentCol,
        ].filter(Boolean).join('. ')

        // Экскурсия / билет / пропуск
        if (/экскурси|билет|пропуск|эко-сбор|музей|сеанс|катер|подъемник/i.test(segmentCol)
          || /экскурси|музей|билет/i.test(transportCol)) {
          const cleanTitle = removeEmoji(segmentCol).replace(/[*_`]/g, '').replace(/^[^а-яёa-z0-9]+/i, '').trim()
          bookings.push({
            id: crypto.randomUUID(),
            type: 'attraction',
            icon: 'mdi:ticket-confirmation-outline',
            title: cleanTitle,
            data: {
              attractionName: cleanTitle,
              dateTime: `${dateStr}T11:00:00`,
              notes,
              sourceUrl,
            },
          })
          continue
        }

        // Обычный транспорт — определяем тип и генерируем осмысленный тайтл
        const { type, icon } = classifyTransport(transportCol, segmentCol)
        const { title, from, to } = extractRouteTitle(segmentCol, transportCol)

        if (type === 'car') {
          bookings.push({
            id: crypto.randomUUID(),
            type: 'car',
            icon,
            title,
            data: {
              company: removeEmoji(transportCol).replace(/[*_`]/g, '').trim() || undefined,
              pickupLocation: from || undefined,
              dropoffLocation: to || undefined,
              pickupDateTime: `${dateStr}T09:00:00`,
              dropoffDateTime: `${dateStr}T12:00:00`,
              pickupTimeZone: inferTimezone(from),
              dropoffTimeZone: inferTimezone(to),
              notes,
              sourceUrl,
            },
          })
        }
        else {
          bookings.push({
            id: crypto.randomUUID(),
            type: 'train',
            icon,
            title,
            data: {
              departureStation: from || undefined,
              arrivalStation: to || undefined,
              departureDateTime: `${dateStr}T09:00:00`,
              arrivalDateTime: `${dateStr}T12:00:00`,
              departureTimeZone: inferTimezone(from),
              arrivalTimeZone: inferTimezone(to),
              notes,
              sourceUrl,
            },
          })
        }
      }
      // Стандартный формат поездов: | Маршрут | Тип | Отправление | Прибытие | Оплата |
      else if (cols.length >= 4) {
        const routeCol = cols[0].replace(/[*_`]/g, '').trim()
        const trainCol = cols[1].replace(/[*_`]/g, '').trim()
        const depTimeCol = cols[2].replace(/[*_`]/g, '').trim()
        const arrTimeCol = cols[3].replace(/[*_`]/g, '').trim()
        const notesCol = cols.length >= 5 ? cols.slice(4).join('; ').replace(/[*_`]/g, '').trim() : ''

        const stationsMatch = routeCol.match(/([^\s➔]+)\s*➔\s*([^\s➔]+)/)
        if (stationsMatch) {
          const departureStation = stationsMatch[1].trim()
          const arrivalStation = stationsMatch[2].trim()

          bookings.push({
            id: crypto.randomUUID(),
            type: 'train',
            icon: 'mdi:train',
            title: `${departureStation} ➔ ${arrivalStation}`,
            data: {
              departureStation,
              arrivalStation,
              departureDateTime: `${startDateStr}T${depTimeCol.length === 5 ? depTimeCol : '12:00'}:00`,
              arrivalDateTime: `${startDateStr}T${arrTimeCol.length === 5 ? arrTimeCol : '14:00'}:00`,
              departureTimeZone: inferTimezone(departureStation),
              arrivalTimeZone: inferTimezone(arrivalStation),
              trainNumber: trainCol || undefined,
              notes: notesCol || undefined,
            },
          })
        }
      }
    }
  }

  return bookings
}

/**
 * Сканирует папку хранилища путешествия и парсит все файлы бронирований
 */
export function parseObsidianBookings(tripPath: string, startDateStr: string, endDateStr?: string): BookingSectionContent {
  const bookings: Booking[] = []

  const bookingDirNames = ['03 - Бронирования', '03 - Bookings', '01 - Бронирования', 'Бронирования', 'Bookings']
  let bookingDirPath = ''

  for (const name of bookingDirNames) {
    const checkPath = join(tripPath, name)
    if (existsSync(checkPath) && statSync(checkPath).isDirectory()) {
      bookingDirPath = checkPath
      break
    }
  }

  if (bookingDirPath) {
    const files = readdirSync(bookingDirPath).filter(f => f.endsWith('.md'))

    for (const file of files) {
      const filePath = join(bookingDirPath, file)
      const content = readFileSync(filePath, 'utf-8')

      if (/отел|гостиниц|проживан|hotel/i.test(file)) {
        const hotels = parseHotelsMarkdown(content, startDateStr)
        bookings.push(...hotels)
      }
      else if (/авиа|перелет|рейс|flight/i.test(file)) {
        const flights = parseFlightsMarkdown(content, startDateStr, endDateStr)
        bookings.push(...flights)
      }
      else if (/транспорт|поезд|паром|авто|машина|аренда|прокат|train|transport|car/i.test(file)) {
        const transportItems = parseTransportMarkdown(content, startDateStr)
        bookings.push(...transportItems)
      }
    }
  }

  return {
    bookings,
  }
}
