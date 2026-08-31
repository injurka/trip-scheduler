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
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && !trimmed.includes('---') && !/ночи|локация|отель|итого|стоимость \/ ночь/i.test(trimmed)) {
      const cols = trimmed.slice(1, -1).split('|').map(c => c.trim())
      if (cols.length >= 4) {
        const nightsCol = cols[0].replace(/[*_`]/g, '').trim() // "01–04" или "09" или "01–03"
        const locationCol = cols[1].replace(/[*_`]/g, '').replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim() // "Тайбэй"
        const hotelCol = cols[2] // "[Morwing Hotel Fairy Tale](https://www.trip.com/w/VfPGsYCo6W2)"
        const featuresCol = cols.length >= 5 ? cols[3].replace(/[*_`]/g, '').trim() : ''
        const priceNightCol = cols.length >= 6 ? cols[4].replace(/[*_`]/g, '').trim() : ''
        const totalCol = cols.length >= 6 ? cols[5].replace(/[*_`]/g, '').trim() : ''

        let hotelName = hotelCol.replace(/[*_`]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
        let sourceUrl: string | undefined
        const linkMatch = hotelCol.match(/\[([^\]]+)\]\(([^)]+)\)/)
        if (linkMatch) {
          hotelName = linkMatch[1].replace(/[*_`\\]/g, '').trim()
          sourceUrl = linkMatch[2].trim()
        }

        // Если отель основной или единственный в строке
        if (hotelName && !/опция|альтернатива/i.test(nightsCol)) {
          let startDayNum = 1
          let endDayNum = 1
          const rangeMatch = nightsCol.match(/(\d{1,2})\s*[-–—]\s*(\d{1,2})/)
          if (rangeMatch) {
            startDayNum = Number.parseInt(rangeMatch[1], 10)
            endDayNum = Number.parseInt(rangeMatch[2], 10)
          }
          else {
            const singleMatch = nightsCol.match(/(\d{1,2})/)
            if (singleMatch) {
              startDayNum = Number.parseInt(singleMatch[1], 10)
              endDayNum = startDayNum
            }
          }

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

          const cleanLocation = locationCol
            .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
            .replace(/[\u{2600}-\u{26FF}]/gu, '')
            .replace(/[\u{2700}-\u{27BF}]/gu, '')
            .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
            .replace(/^\s*[\(（][^)]*[\)）]\s*/, '')
            .replace(/[*_`]/g, '')
            .trim()

          const hotelTitle = cleanLocation
            ? (cleanLocation.toLowerCase().includes(hotelName.toLowerCase()) ? `Отель в ${cleanLocation}` : `Отель в ${cleanLocation} (${hotelName})`)
            : `Отель: ${hotelName}`

          bookings.push({
            id: crypto.randomUUID(),
            type: 'hotel',
            icon: 'mdi:hotel',
            title: hotelTitle,
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

    const titleMatch = fSec.match(/##\s*[^\n]*(Перелет[^\n:]+:[^\n]+)/i)
    const blockTitle = titleMatch
      ? titleMatch[1].replace(/[*_#]/g, '').trim()
      : (isOutbound ? 'Рейс ТУДА' : (isInbound ? 'Рейс ОБРАТНО' : 'Авиаперелет'))

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

          const citiesMatch = routeCol.match(/\*\*?([^(➔\n]+)(?:\(([^)\-]+)(?:-([^\)]+))?\))?\s*➔\s*([^(➔\n]+)(?:\(([^)\-]+)(?:-([^\)]+))?\)?)\*\*?/)
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
        title: blockTitle,
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

    const routeText = routeMatch ? routeMatch[0] : 'Перелет Москва ➔ Регион'
    const cleanTitle = `Авиаперелет: ${routeText.replace(/[*_`]/g, '').trim()}`

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

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && !trimmed.includes('---') && !/сегмент|маршрут|время в пути|отправление/i.test(trimmed)) {
      const cols = trimmed.slice(1, -1).split('|').map(c => c.trim())

      // Формат графика: | День | Сегмент | Транспорт | Время в пути | Способ бронирования / Оплата |
      if (cols.length >= 5 && /^\s*\*?\*?\d{1,2}/.test(cols[0])) {
        const dayCol = cols[0].replace(/[*_`]/g, '').trim()
        const segmentCol = cols[1].replace(/[*_`]/g, '').trim()
        const transportCol = cols[2].replace(/[*_`]/g, '').trim()
        const durationCol = cols[3].replace(/[*_`]/g, '').trim()
        const paymentCol = cols[4].replace(/[*_`]/g, '').trim()

        const dayNum = Number.parseInt(dayCol, 10) || 1
        const eventDate = new Date(startDate)
        eventDate.setDate(eventDate.getDate() + (dayNum - 1))
        const dateStr = eventDate.toISOString().split('T')[0]

        // Пропускаем короткие внутригородские поездки на такси по 10-15 мин (Яндекс Go)
        if (/яндекс\s*go|городское\s*такси/i.test(transportCol) && !/аэропорт/i.test(segmentCol)) {
          continue
        }

        let sourceUrl: string | undefined
        for (const [key, url] of urlMap.entries()) {
          if (segmentCol.toLowerCase().includes(key) || transportCol.toLowerCase().includes(key) || paymentCol.toLowerCase().includes(key)) {
            sourceUrl = url
            break
          }
        }
        if (!sourceUrl) {
          const directUrlMatch = paymentCol.match(/([a-z0-9\-]+\.(?:ru|com|org|net))/i)
          if (directUrlMatch) {
            sourceUrl = `https://${directUrlMatch[1]}`
          }
        }

        const notes = [transportCol, durationCol ? `Время в пути: ${durationCol}` : '', paymentCol].filter(Boolean).join('. ')

        // Если это экскурсия / билет / пропуск
        if (/экскурси|билет|пропуск|эко-сбор|музей|сеанс|катер|подъемник/i.test(segmentCol) || /экскурси|музей|билет/i.test(transportCol)) {
          const cleanTitle = segmentCol.replace(/^[^а-яёa-z0-9]+/i, '').trim()
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
        }
        else {
          // Это междугородний трансфер / переезд / поезд / аренда авто
          const stationsMatch = segmentCol.match(/([^\s➔]+)\s*➔\s*([^\s➔]+)/)
          const depStation = stationsMatch ? stationsMatch[1].trim() : segmentCol
          const arrStation = stationsMatch ? stationsMatch[2].trim() : ''

          const isVehicle = /джип|внедорожник|минивэн|авто|такси|трансфер|машина|car|аренда/i.test(transportCol)
            || /джип|трансфер|авто|прокат/i.test(segmentCol)

          if (isVehicle) {
            bookings.push({
              id: crypto.randomUUID(),
              type: 'car',
              icon: 'mdi:car',
              title: `Трансфер: ${segmentCol}`,
              data: {
                company: transportCol,
                pickupLocation: depStation,
                dropoffLocation: arrStation,
                pickupDateTime: `${dateStr}T09:00:00`,
                dropoffDateTime: `${dateStr}T12:00:00`,
                pickupTimeZone: inferTimezone(depStation),
                dropoffTimeZone: inferTimezone(arrStation),
                notes,
                sourceUrl,
              },
            })
          }
          else {
            bookings.push({
              id: crypto.randomUUID(),
              type: 'train',
              icon: 'mdi:train',
              title: `Трансфер: ${segmentCol}`,
              data: {
                departureStation: depStation,
                arrivalStation: arrStation,
                departureDateTime: `${dateStr}T09:00:00`,
                arrivalDateTime: `${dateStr}T12:00:00`,
                departureTimeZone: inferTimezone(depStation),
                arrivalTimeZone: inferTimezone(arrStation),
                notes,
                sourceUrl,
              },
            })
          }
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
            title: `Поезд ${departureStation} ➔ ${arrivalStation}`,
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
