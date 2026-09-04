import type { CityWeatherData, SeasonalityLevel } from '../../../db/schema.type'
import type { AiRequestPrompts } from '~/lib/llm'
import { z } from 'zod'
import { AI_MODELS, createAiChatRequest, DEFAULT_AI_MODEL, parseJsonWithAiRepair } from '~/lib/llm'
import { cityWeatherCacheRepository } from '~/repositories/city-weather-cache.repository'
import { llmUsageRepository } from '~/repositories/llm-usage.repository'
import { quotaService } from '~/services/quota.service'

const MONTH_NAMES_RU = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
]

const DAYS_IN_MONTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export const CityWeatherResponseSchema = z.object({
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  tempAverage: z.number().nullable().optional(),
  tempMin: z.number().nullable().optional(),
  tempMax: z.number().nullable().optional(),
  feelsLike: z.number().nullable().optional(),
  rainyDays: z.number().nullable().optional(),
  precipitationProbability: z.number().nullable().optional(),
  precipitationType: z.string().nullable().optional(),
  windSpeed: z.number().nullable().optional(),
  windDescription: z.string().nullable().optional(),
  seasonality: z.enum(['low', 'medium', 'high', 'peak']).nullable().optional(),
  seasonalityDescription: z.string().nullable().optional(),
  daylight: z.string().nullable().optional(),
  daylightDescription: z.string().nullable().optional(),
  clothingRecommendation: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
})

export interface GeoLocation {
  name: string
  latitude: number
  longitude: number
  country?: string
}

export interface ClimateNormals {
  tempAverage: number
  tempMin: number
  tempMax: number
  feelsLike: number
  windSpeed: number
  rainyDays: number
  precipitationProbability: number
}

export interface AstronomicalDaylight {
  daylightHours: number
  twilightHours: number
  isPolarNight: boolean
  isPolarDay: boolean
  isWhiteNights: boolean
  daylightText: string
  daylightValue: string
  daylightDescription: string
}

/**
 * Локальный справочник ключевых туристических и арктических локаций.
 * Исключает сетевые тайм-ауты и сбои внешнего геокодера.
 */
export const KNOWN_LOCATIONS: Record<string, GeoLocation> = {
  // Арктика и Заполярье
  'мурманск': { name: 'Мурманск', latitude: 68.9707, longitude: 33.0750, country: 'Россия' },
  'териберка': { name: 'Териберка', latitude: 69.1641, longitude: 35.1436, country: 'Россия' },
  'кировск': { name: 'Кировск', latitude: 67.6144, longitude: 33.6738, country: 'Россия' },
  'апатиты': { name: 'Апатиты', latitude: 67.5641, longitude: 33.4031, country: 'Россия' },
  'североморск': { name: 'Североморск', latitude: 69.0706, longitude: 33.4243, country: 'Россия' },
  'мончегорск': { name: 'Мончегорск', latitude: 67.9400, longitude: 32.9100, country: 'Россия' },
  'кандалакша': { name: 'Кандалакша', latitude: 67.1561, longitude: 32.4131, country: 'Россия' },
  'полярные зори': { name: 'Полярные Зори', latitude: 67.3670, longitude: 32.4988, country: 'Россия' },
  'норильск': { name: 'Норильск', latitude: 69.3535, longitude: 88.2027, country: 'Россия' },
  'дудинка': { name: 'Дудинка', latitude: 69.4058, longitude: 86.1778, country: 'Россия' },
  'воркута': { name: 'Воркута', latitude: 67.4975, longitude: 64.0611, country: 'Россия' },
  'салехард': { name: 'Салехард', latitude: 66.5299, longitude: 66.6019, country: 'Россия' },
  'новый уренгой': { name: 'Новый Уренгой', latitude: 66.0845, longitude: 76.6791, country: 'Россия' },
  'нарьян-мар': { name: 'Нарьян-Мар', latitude: 67.6381, longitude: 53.0069, country: 'Россия' },
  'архангельск': { name: 'Архангельск', latitude: 64.5401, longitude: 40.5433, country: 'Россия' },
  'северодвинск': { name: 'Северодвинск', latitude: 64.5635, longitude: 39.8302, country: 'Россия' },
  'петрозаводск': { name: 'Петрозаводск', latitude: 61.7849, longitude: 34.3469, country: 'Россия' },
  'сортавала': { name: 'Сортавала', latitude: 61.7046, longitude: 30.6917, country: 'Россия' },
  'рускеала': { name: 'Рускеала', latitude: 61.9328, longitude: 30.5806, country: 'Россия' },
  'якутск': { name: 'Якутск', latitude: 62.0355, longitude: 129.6755, country: 'Россия' },
  'анадырь': { name: 'Анадырь', latitude: 64.7342, longitude: 177.5103, country: 'Россия' },

  // Крупные российские города и туристические центры
  'москва': { name: 'Москва', latitude: 55.7558, longitude: 37.6173, country: 'Россия' },
  'санкт-петербург': { name: 'Санкт-Петербург', latitude: 59.9343, longitude: 30.3351, country: 'Россия' },
  'питер': { name: 'Санкт-Петербург', latitude: 59.9343, longitude: 30.3351, country: 'Россия' },
  'казань': { name: 'Казань', latitude: 55.7961, longitude: 49.1064, country: 'Россия' },
  'нижний новгород': { name: 'Нижний Новгород', latitude: 56.3269, longitude: 44.0059, country: 'Россия' },
  'екатеринбург': { name: 'Екатеринбург', latitude: 56.8389, longitude: 60.6057, country: 'Россия' },
  'новосибирск': { name: 'Новосибирск', latitude: 55.0084, longitude: 82.9357, country: 'Россия' },
  'красноярск': { name: 'Красноярск', latitude: 56.0153, longitude: 92.8932, country: 'Россия' },
  'иркутск': { name: 'Иркутск', latitude: 52.2864, longitude: 104.3050, country: 'Россия' },
  'байкальск': { name: 'Байкальск', latitude: 51.5208, longitude: 104.1481, country: 'Россия' },
  'листвянка': { name: 'Листвянка', latitude: 51.8547, longitude: 104.8694, country: 'Россия' },
  'улан-удэ': { name: 'Улан-Удэ', latitude: 51.8348, longitude: 107.5848, country: 'Россия' },
  'владивосток': { name: 'Владивосток', latitude: 43.1155, longitude: 131.8855, country: 'Россия' },
  'хабаровск': { name: 'Хабаровск', latitude: 48.4827, longitude: 135.0838, country: 'Россия' },
  'калининград': { name: 'Калининград', latitude: 54.7104, longitude: 20.4522, country: 'Россия' },
  'сочи': { name: 'Сочи', latitude: 43.6028, longitude: 39.7342, country: 'Россия' },
  'адлер': { name: 'Адлер', latitude: 43.4273, longitude: 39.9231, country: 'Россия' },
  'красная поляна': { name: 'Красная Поляна', latitude: 43.6792, longitude: 40.2056, country: 'Россия' },
  'кисловодск': { name: 'Кисловодск', latitude: 43.9056, longitude: 42.7153, country: 'Россия' },
  'пятигорск': { name: 'Пятигорск', latitude: 44.0486, longitude: 43.0594, country: 'Россия' },
  'минеральные воды': { name: 'Минеральные Воды', latitude: 44.2108, longitude: 43.1347, country: 'Россия' },
  'петропавловск-камчатский': { name: 'Петропавловск-Камчатский', latitude: 53.0452, longitude: 158.6500, country: 'Россия' },
  'южно-сахалинск': { name: 'Южно-Сахалинск', latitude: 46.9592, longitude: 142.7380, country: 'Россия' },
  'горно-алтайск': { name: 'Горно-Алтайск', latitude: 51.9581, longitude: 85.9603, country: 'Россия' },
  'чемал': { name: 'Чемал', latitude: 51.4111, longitude: 86.0028, country: 'Россия' },
  'выборг': { name: 'Выборг', latitude: 60.7100, longitude: 28.7497, country: 'Россия' },

  // Зарубежные направления
  'тромсё': { name: 'Тромсё', latitude: 69.6492, longitude: 18.9553, country: 'Норвегия' },
  'рейкьявик': { name: 'Рейкьявик', latitude: 64.1466, longitude: -21.9426, country: 'Исландия' },
  'рованиеми': { name: 'Рованиеми', latitude: 66.5039, longitude: 25.7294, country: 'Финляндия' },
  'минск': { name: 'Минск', latitude: 53.9006, longitude: 27.5590, country: 'Беларусь' },
  'тбилиси': { name: 'Тбилиси', latitude: 41.7151, longitude: 44.8271, country: 'Грузия' },
  'ереван': { name: 'Ереван', latitude: 40.1792, longitude: 44.4991, country: 'Армения' },
  'баку': { name: 'Баку', latitude: 40.4093, longitude: 49.8671, country: 'Азербайджан' },
  'ташкент': { name: 'Ташкент', latitude: 41.2995, longitude: 69.2401, country: 'Узбекистан' },
  'алматы': { name: 'Алматы', latitude: 43.2389, longitude: 76.8897, country: 'Казахстан' },
  'астана': { name: 'Астана', latitude: 51.1694, longitude: 71.4491, country: 'Казахстан' },
  'стамбул': { name: 'Стамбул', latitude: 41.0082, longitude: 28.9784, country: 'Турция' },
  'анталья': { name: 'Анталья', latitude: 36.8969, longitude: 30.7133, country: 'Турция' },
  'дубай': { name: 'Дубай', latitude: 25.2048, longitude: 55.2708, country: 'ОАЭ' },
  'париж': { name: 'Париж', latitude: 48.8566, longitude: 2.3522, country: 'Франция' },
  'рим': { name: 'Рим', latitude: 41.9028, longitude: 12.4964, country: 'Италия' },
  'бангкок': { name: 'Бангкок', latitude: 13.7563, longitude: 100.5018, country: 'Таиланд' },
  'пхукет': { name: 'Пхукет', latitude: 7.8804, longitude: 98.3923, country: 'Таиланд' },
}

export function findKnownLocation(cityName: string): GeoLocation | null {
  const norm = normalizeCityName(cityName)
  return KNOWN_LOCATIONS[norm] || null
}

/**
 * Нормализует название города для гарантированного попадания в кэш.
 */
export function normalizeCityName(raw: string): string {
  let name = (raw || '').trim().toLowerCase()
  name = name.replace(/^(?:г(?:ород|\.)?|пос(?:елок|\.)?|пгт|с(?:ело|\.)?|д(?:еревня|\.)?|ст-ца|хутор)\s+/i, '')
  if (name.includes(',')) {
    name = name.split(',')[0].trim()
  }
  return name.replace(/\s+/g, ' ').trim()
}

/**
 * Безопасное разделение сырого текста длины дня на компактное значение и описание
 */
export function splitDaylightText(rawText?: string | null): { value: string, description: string } {
  if (!rawText)
    return { value: '—', description: 'Световой день' }

  const text = rawText.trim()

  if (/^~?\d+(?:-\d+)?\s*(?:ч|час(?:а|ов)?)$/i.test(text)) {
    return { value: text, description: 'Световой день' }
  }

  const inParensMatch = text.match(/\((~?\d+(?:-\d+)?\s*(?:ч|час)[^)]*)\)/i)
  if (inParensMatch && inParensMatch[1]) {
    const value = inParensMatch[1].trim()
    const description = text.replace(inParensMatch[0], '').replace(/[,;]\s*$/, '').trim()
    return { value, description: description || 'Световой день' }
  }

  return { value: text, description: 'Световой день' }
}

/**
 * Астрономический расчет длины светового дня по широте и месяцу.
 */
export function calculateAstronomicalDaylight(latitude: number, month: number, day = 15): AstronomicalDaylight {
  const clampedLat = Math.max(-89.9, Math.min(89.9, latitude))
  const latRad = (clampedLat * Math.PI) / 180

  const daysBeforeMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  const dayOfYear = (daysBeforeMonth[month - 1] ?? 0) + day

  const declinationRad = (23.44 * Math.PI / 180) * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81))

  const cosLat = Math.cos(latRad)
  const sinLat = Math.sin(latRad)
  const cosDec = Math.cos(declinationRad)
  const sinDec = Math.sin(declinationRad)
  const denominator = cosLat * cosDec

  const cosOmega0 = (Math.sin((-0.833 * Math.PI) / 180) - sinLat * sinDec) / denominator
  const cosOmegaTwCivil = (Math.sin((-6.0 * Math.PI) / 180) - sinLat * sinDec) / denominator
  const cosOmegaTwNautical = (Math.sin((-12.0 * Math.PI) / 180) - sinLat * sinDec) / denominator

  let daylightHours = 0
  let isPolarNight = false
  let isPolarDay = false

  if (cosOmega0 >= 1) {
    isPolarNight = true
    daylightHours = 0
  }
  else if (cosOmega0 <= -1) {
    isPolarDay = true
    daylightHours = 24
  }
  else {
    const omega0 = Math.acos(cosOmega0)
    daylightHours = (omega0 / Math.PI) * 24
  }

  let twilightHours = 0
  let isWhiteNights = false

  if (cosOmegaTwCivil >= 1) {
    twilightHours = 0
  }
  else if (cosOmegaTwCivil <= -1) {
    twilightHours = 24
  }
  else {
    const omegaTw = Math.acos(cosOmegaTwCivil)
    twilightHours = (omegaTw / Math.PI) * 24
  }

  if (!isPolarDay && cosOmegaTwNautical <= -1) {
    isWhiteNights = true
  }

  let daylightValue = ''
  let daylightDescription = ''

  if (isPolarDay) {
    daylightValue = '24 ч'
    daylightDescription = 'Полярный день, круглосуточное солнце'
  }
  else if (isPolarNight) {
    if (twilightHours > 0.5) {
      const roundedTw = Math.round(twilightHours * 10) / 10
      daylightValue = roundedTw >= 1 && roundedTw <= 2.2 ? '~1-2 ч' : `~${Math.round(twilightHours)} ч`
      daylightDescription = 'Полярная ночь: солнце не восходит, короткие светлые сумерки'
    }
    else {
      daylightValue = '0 ч'
      daylightDescription = 'Полярная ночь: круглосуточная темнота, солнце не восходит'
    }
  }
  else if (isWhiteNights) {
    daylightValue = `~${Math.round(daylightHours)} ч`
    daylightDescription = 'Сезон белых ночей: вечерние сумерки сразу переходят в утренние'
  }
  else if (daylightHours < 4) {
    daylightValue = `~${Math.round(daylightHours * 10) / 10} ч`
    daylightDescription = 'Короткий световой день, низкое солнце над горизонтом'
  }
  else if (daylightHours < 8) {
    daylightValue = `~${Math.round(daylightHours)} ч`
    daylightDescription = 'Короткий зимний световой день'
  }
  else {
    daylightValue = `~${Math.round(daylightHours)} ч`
    daylightDescription = 'Световой день обычной продолжительности'
  }

  const daylightText = `${daylightDescription} (${daylightValue})`

  return {
    daylightHours: Math.round(daylightHours * 10) / 10,
    twilightHours: Math.round(twilightHours * 10) / 10,
    isPolarNight,
    isPolarDay,
    isWhiteNights,
    daylightText,
    daylightValue,
    daylightDescription,
  }
}

/**
 * Расчет ощущаемой температуры по формуле Wind Chill Index
 */
export function calculateFeelsLike(temp: number, windSpeedKmh: number): number {
  if (temp <= 10 && windSpeedKmh >= 4.8) {
    const vPow = windSpeedKmh ** 0.16
    const windChill = 13.12 + 0.6215 * temp - 11.37 * vPow + 0.3965 * temp * vPow
    return Math.round(windChill)
  }
  return temp
}

async function fetchCityCoordinates(cityName: string): Promise<GeoLocation | null> {
  const localMatch = findKnownLocation(cityName)
  if (localMatch) {
    return localMatch
  }

  const cleanName = normalizeCityName(cityName)

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanName)}&count=3&language=ru&format=json`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = await res.json()
      if (data.results && data.results.length > 0) {
        const first = data.results[0]
        return {
          name: first.name,
          latitude: first.latitude,
          longitude: first.longitude,
          country: first.country,
        }
      }
    }

    // Резервная попытка поиска на английском
    const fallbackUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanName)}&count=3&language=en&format=json`
    const fallbackRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(5000) })
    if (fallbackRes.ok) {
      const data = await fallbackRes.json()
      if (data.results && data.results.length > 0) {
        const first = data.results[0]
        return {
          name: first.name,
          latitude: first.latitude,
          longitude: first.longitude,
          country: first.country,
        }
      }
    }
    return null
  }
  catch {
    return null
  }
}

async function fetchClimateNormals(lat: number, lon: number, month: number): Promise<ClimateNormals | null> {
  try {
    const daysInMonth = DAYS_IN_MONTHS[month - 1] || 30
    const sampleYear = new Date().getFullYear() - 1
    const mStr = String(month).padStart(2, '0')
    const startDate = `${sampleYear}-${mStr}-01`
    const endDate = `${sampleYear}-${mStr}-${String(daysInMonth).padStart(2, '0')}`

    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max&timezone=auto`

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok)
      return null

    const data = await res.json()
    const daily = data?.daily
    if (!daily)
      return null

    const validMeans: number[] = (daily.temperature_2m_mean || []).filter((v: any) => typeof v === 'number')
    const validMins: number[] = (daily.temperature_2m_min || []).filter((v: any) => typeof v === 'number')
    const validMaxs: number[] = (daily.temperature_2m_max || []).filter((v: any) => typeof v === 'number')
    const validWinds: number[] = (daily.wind_speed_10m_max || []).filter((v: any) => typeof v === 'number')
    const validPrecip: number[] = (daily.precipitation_sum || []).filter((v: any) => typeof v === 'number')

    if (!validMeans.length)
      return null

    const tempAverage = Math.round(validMeans.reduce((a, b) => a + b, 0) / validMeans.length)
    const tempMin = Math.round(validMins.reduce((a, b) => a + b, 0) / validMins.length)
    const tempMax = Math.round(validMaxs.reduce((a, b) => a + b, 0) / validMaxs.length)
    const windSpeed = Math.round(validWinds.reduce((a, b) => a + b, 0) / validWinds.length)
    const rainyDays = validPrecip.filter(p => p >= 1.0).length
    const precipitationProbability = Math.min(100, Math.max(0, Math.round((rainyDays / validPrecip.length) * 100)))
    const feelsLike = calculateFeelsLike(tempAverage, windSpeed)

    return {
      tempAverage,
      tempMin: Math.min(tempMin, tempAverage),
      tempMax: Math.max(tempMax, tempAverage),
      feelsLike,
      windSpeed,
      rainyDays,
      precipitationProbability,
    }
  }
  catch {
    return null
  }
}

/**
 * Валидирует и корректирует показатели погоды, устраняя галлюцинации нейросети.
 */
export function sanitizeAndValidateWeather(
  data: Partial<CityWeatherData>,
  cityNormalized: string,
  month: number,
  knownLat?: number | null,
): CityWeatherData {
  const localGeo = findKnownLocation(cityNormalized)
  const latitude = knownLat ?? localGeo?.latitude ?? null
  const monthName = MONTH_NAMES_RU[month - 1] || 'выбранный месяц'

  const isArcticCity = (latitude !== null && latitude >= 66.0) || [
    'мурманск',
    'териберка',
    'кировск',
    'апатиты',
    'норильск',
    'дудинка',
    'воркута',
    'салехард',
    'североморск',
    'полярные зори',
    'нарьян-мар',
  ].includes(cityNormalized)

  const isWinter = [12, 1, 2].includes(month)

  let avgT = data.tempAverage ?? -5
  let minT = data.tempMin ?? avgT - 5
  let maxT = data.tempMax ?? avgT + 5
  let windSpeed = data.windSpeed ?? 15

  // Коррекция арктической зимы: исключаем плюсовую температуру в Заполярье в январе
  if (isArcticCity && isWinter) {
    if (avgT > -3) {
      avgT = -10
      minT = -15
      maxT = -6
    }
    else {
      maxT = Math.min(maxT, -1)
    }
  }

  // Гарантия min <= avg <= max
  if (minT > maxT) {
    const tmp = minT
    minT = maxT
    maxT = tmp
  }
  if (avgT < minT)
    avgT = minT
  if (avgT > maxT)
    avgT = maxT

  windSpeed = Math.max(0, windSpeed)
  const feelsLike = calculateFeelsLike(avgT, windSpeed)

  // Расчет и защита светового дня
  let daylightVal = data.daylight || '~10 ч'
  let daylightDesc = data.daylightDescription || 'Световой день'

  if (latitude !== null) {
    const astro = calculateAstronomicalDaylight(latitude, month)
    daylightVal = astro.daylightValue
    daylightDesc = astro.daylightDescription
  }
  else if (isArcticCity && [12, 1].includes(month)) {
    daylightVal = month === 1 ? '~1-2 ч' : '0 ч'
    daylightDesc = 'Полярная ночь: солнце не восходит, короткие светлые сумерки'
  }
  else if (data.daylight) {
    const split = splitDaylightText(data.daylight)
    daylightVal = split.value
    daylightDesc = data.daylightDescription || split.description
  }

  return {
    city: data.city || cityNormalized,
    tempAverage: avgT,
    tempMin: minT,
    tempMax: maxT,
    feelsLike,
    rainyDays: Math.min(31, Math.max(0, data.rainyDays ?? 8)),
    precipitationProbability: Math.min(100, Math.max(0, data.precipitationProbability ?? 25)),
    precipitationType: data.precipitationType || (avgT <= 0 ? 'Снег' : 'Дождь'),
    windSpeed,
    windDescription: data.windDescription || (windSpeed > 25 ? 'Порывистый ветер' : 'Умеренный ветер'),
    seasonality: (data.seasonality as SeasonalityLevel) ?? 'medium',
    seasonalityDescription: data.seasonalityDescription ?? `Туристический сезон в ${monthName}`,
    daylight: daylightVal,
    daylightDescription: daylightDesc,
    clothingRecommendation: data.clothingRecommendation || (avgT <= -5 ? 'Теплая зимняя куртка, термобелье, шапка, перчатки' : 'Удобная одежда по сезону'),
    summary: data.summary || `Климатические условия для путешествия в ${monthName}.`,
    updatedAt: data.updatedAt || new Date().toISOString(),
  }
}

function getSystemPrompt(hasRealMetrics: boolean): string {
  return `
Ты профессиональный климатолог и опытный гид-путешественник. Твоя задача — составить точную климатическую справку и туристический контекст для путешественника по указанному городу и месяцу.

${hasRealMetrics ? 'ВНИМАНИЕ: Тебе предоставлены проверенные физические метеорологические данные и астрономическая длина дня. Твоя главная задача — НЕ изменять предоставленные числовые показатели, а дополнить их качественными туристическими описаниями.' : ''}

Отвечай СТРОГО в формате валидного JSON-объекта со следующими полями:
{
  "latitude": number (географическая широта города от -90 до 90),
  "longitude": number (географическая долгота города от -180 до 180),
  "tempAverage": number (среднесуточная температура в градусах Цельсия, целое число),
  "tempMin": number (минимальная температура ночью/утром в градусах Цельсия),
  "tempMax": number (максимальная дневная температура в градусах Цельсия),
  "feelsLike": number (ощущаемая температура с учетом влажности и ветра),
  "rainyDays": number (среднее количество дней с осадками в данном месяце),
  "precipitationProbability": number (вероятность осадков в процентах, от 0 до 100),
  "precipitationType": string (характер осадков на русском: например "снегопады, метели", "дожди, туманы", "сухая ясная погода"),
  "windSpeed": number (средняя скорость ветра в км/ч),
  "windDescription": string (описание ветра на русском: например "Штормовой арктический ветер", "Свежий морской бриз", "Слабый / штиль"),
  "seasonality": "low" | "medium" | "high" | "peak",
  "seasonalityDescription": string (описание сезона и загрузки: например "Пик сезона северного сияния, бронировать жилье заранее"),
  "daylight": string (СТРОГО ТОЛЬКО компактное значение времени: например "~14 ч", "~1-2 ч", "24 ч", "0 ч"),
  "daylightDescription": string (подробное описание: например "Полярная ночь: солнце не восходит, короткие сумерки", "Полярный день, круглосуточное солнце", "Сезон белых ночей", "Стандартная продолжительность дня"),
  "clothingRecommendation": string (рекомендации по одежде: например "Непродуваемый пуховик, термобелье, балаклава, нескользкая обувь"),
  "summary": string (1-2 емких предложения с главным советом для поездки в этом месяце)
}

ПРАВИЛА:
1. tempMin <= tempAverage <= tempMax.
2. В арктических регионах (Мурманск, Териберка, Кировск, Норильск) в декабре и январе средняя температура ВСЕГДА отрицательная (зимой типично от -10°C до -20°C, никакой плюсовой температуры на регулярной основе быть не может).
3. В период полярной ночи длина дня составляет строго 0 ч (или ~1-2 ч сумерек в январе), никогда не указывай 8-9 часов дня для Арктики зимой!
4. В поле daylight пиши ТОЛЬКО компактное время (например "~1-2 ч", "~14 ч", "24 ч", "0 ч"). Любые пояснения пиши ИСКЛЮЧИТЕЛЬНО в daylightDescription!
`
}

function getSeasonalFallbackWeather(city: string, month: number, latitude?: number): CityWeatherData {
  const monthName = MONTH_NAMES_RU[month - 1] || 'выбранный месяц'
  const isNorthern = latitude === undefined ? true : latitude >= 0
  const isWinter = isNorthern ? [12, 1, 2].includes(month) : [6, 7, 8].includes(month)
  const isSummer = isNorthern ? [6, 7, 8].includes(month) : [12, 1, 2].includes(month)
  const isTransition = !isWinter && !isSummer

  const isArctic = latitude !== null && latitude !== undefined && latitude >= 66.0

  let avg = 15
  let min = 10
  let max = 20
  let precipType = 'Переменная облачность, возможны кратковременные дожди'
  let clothing = 'Удобная многослойная одежда, куртка-ветровка'

  if (isArctic && isWinter) {
    avg = -11
    min = -17
    max = -6
    precipType = 'Снег, метели, поземок'
    clothing = 'Теплая непродуваемая парка или пуховик, термобелье, теплая обувь'
  }
  else if (isWinter) {
    avg = -6
    min = -11
    max = -1
    precipType = 'Снег, гололедица'
    clothing = 'Теплая зимняя куртка, шапка, перчатки, теплая обувь'
  }
  else if (isSummer) {
    avg = 22
    min = 16
    max = 27
    precipType = 'Преимущественно сухо, возможны грозы'
    clothing = 'Легкая летняя одежда, головной убор от солнца'
  }
  else if (isTransition) {
    avg = 8
    min = 3
    max = 13
    precipType = 'Кратковременные дожди'
    clothing = 'Демисезонная непромокаемая куртка, свитер, удобная обувь'
  }

  const daylightInfo = latitude !== undefined
    ? calculateAstronomicalDaylight(latitude, month)
    : null

  return {
    city,
    tempAverage: avg,
    tempMin: min,
    tempMax: max,
    feelsLike: calculateFeelsLike(avg, 18),
    rainyDays: 8,
    precipitationProbability: 30,
    precipitationType: precipType,
    windSpeed: 18,
    windDescription: isArctic ? 'Сильный порывистый арктический ветер' : 'Умеренный ветер',
    seasonality: 'medium',
    seasonalityDescription: `Сезон в ${monthName}`,
    daylight: daylightInfo?.daylightValue ?? (isArctic && isWinter ? '~1-2 ч' : '~10 ч'),
    daylightDescription: daylightInfo?.daylightDescription ?? 'Световой день',
    clothingRecommendation: clothing,
    summary: `Поездка в ${city} в ${monthName}. Учитывайте погодные условия при подготовке багажа.`,
    updatedAt: new Date().toISOString(),
  }
}

export const weatherGenerationService = {
  async generateOrGetCityWeather(
    city: string,
    month: number,
    userId: string,
    forceRefresh = false,
  ): Promise<{ data: CityWeatherData, fromCache: boolean }> {
    const trimmedCity = city.trim()
    const cityNormalized = normalizeCityName(trimmedCity)

    // 1. Проверяем кэш в БД (при forceRefresh игнорируем кэш)
    if (!forceRefresh) {
      const cached = await cityWeatherCacheRepository.getByCityAndMonth(cityNormalized, month)
      if (cached) {
        if (cached.daylight && !cached.daylightDescription) {
          const parsedDaylight = splitDaylightText(cached.daylight)
          cached.daylight = parsedDaylight.value
          cached.daylightDescription = parsedDaylight.description
        }
        return { data: { ...cached, city: trimmedCity }, fromCache: true }
      }
    }

    const monthName = MONTH_NAMES_RU[month - 1] || `${month}-й месяц`

    // 2. Определение координат города (локальный словарь -> внешний геокодер)
    const geo = await fetchCityCoordinates(trimmedCity)
    const lat = geo?.latitude ?? null
    const daylight = lat !== null ? calculateAstronomicalDaylight(lat, month) : null

    // 3. Реальные метеорологические нормы из архива
    const realClimate = geo ? await fetchClimateNormals(geo.latitude, geo.longitude, month) : null

    try {
      let userPrompt = `Составь климатический контекст и туристический прогноз для города "${trimmedCity}" на месяц "${monthName}" (${month}-й месяц года).`
      if (realClimate && geo && daylight) {
        userPrompt += `
Реальные климатические наблюдения (${geo.name}, ${geo.country || ''}):
- Широта: ${geo.latitude}, долгота: ${geo.longitude}
- Средняя температура: ${realClimate.tempAverage}°C (ночь/утро от ${realClimate.tempMin}°C, день до ${realClimate.tempMax}°C)
- Ощущается как: ${realClimate.feelsLike}°C
- Скорость ветра: ${realClimate.windSpeed} км/ч
- Дней с осадками: ${realClimate.rainyDays}, вероятность: ${realClimate.precipitationProbability}%
- Астрономический день: значение "${daylight.daylightValue}", описание "${daylight.daylightDescription}"

Используй эти фактические цифры и составь точный туристический контекст.`
      }
      else if (daylight && lat !== null) {
        userPrompt += `
Географическая широта: ${lat}. Астрономический день для этой широты: значение "${daylight.daylightValue}", описание "${daylight.daylightDescription}".
Составь реалистичные климатические показатели для этого региона в ${monthName}.`
      }
      else {
        userPrompt += `
Координаты города не найдены в базе. Определи его реальные географические координаты (широту и долготу), климатический пояс и реалистичную погоду на ${monthName}.`
      }

      const prompts: AiRequestPrompts = {
        system: getSystemPrompt(Boolean(realClimate)),
        user: userPrompt,
      }

      const modelId = DEFAULT_AI_MODEL
      const completion = await createAiChatRequest(prompts, {
        model: modelId,
        response_format: { type: 'json_object' },
        temperature: 0.1,
      })

      if (completion.usage) {
        const actualModelId = (AI_MODELS as readonly string[]).find(m => completion.model?.includes(m) || m.includes(completion.model)) || modelId
        await quotaService.deductLlmCredits(
          userId,
          actualModelId,
          completion.usage.prompt_tokens,
          completion.usage.completion_tokens,
        )

        await llmUsageRepository.create({
          userId,
          model: actualModelId,
          operation: 'weatherGeneration',
          inputTokens: completion.usage.prompt_tokens,
          outputTokens: completion.usage.completion_tokens,
        })
      }

      const jsonResponse = completion.choices[0]?.message?.content
      if (!jsonResponse) {
        throw new Error('Пустой ответ от ИИ при генерации погоды.')
      }

      const parsed = await parseJsonWithAiRepair<z.infer<typeof CityWeatherResponseSchema>>(jsonResponse, {
        userId,
        model: modelId,
        operation: 'weatherGeneration',
        maxRetries: 2,
        schema: CityWeatherResponseSchema,
      })

      const finalLat = lat ?? parsed.latitude ?? null

      const rawResult: Partial<CityWeatherData> = {
        city: trimmedCity,
        tempAverage: realClimate?.tempAverage ?? parsed.tempAverage,
        tempMin: realClimate?.tempMin ?? parsed.tempMin,
        tempMax: realClimate?.tempMax ?? parsed.tempMax,
        feelsLike: realClimate?.feelsLike ?? parsed.feelsLike,
        rainyDays: realClimate?.rainyDays ?? parsed.rainyDays,
        precipitationProbability: realClimate?.precipitationProbability ?? parsed.precipitationProbability,
        precipitationType: parsed.precipitationType,
        windSpeed: realClimate?.windSpeed ?? parsed.windSpeed,
        windDescription: parsed.windDescription,
        seasonality: (parsed.seasonality as SeasonalityLevel) ?? 'medium',
        seasonalityDescription: parsed.seasonalityDescription,
        daylight: parsed.daylight,
        daylightDescription: parsed.daylightDescription,
        clothingRecommendation: parsed.clothingRecommendation,
        summary: parsed.summary,
        updatedAt: new Date().toISOString(),
      }

      // Физическая валидация и защита от климатических галлюцинаций
      const validatedResult = sanitizeAndValidateWeather(rawResult, cityNormalized, month, finalLat)

      // Сохраняем результат в кэш базы данных (перезаписывает предыдущий)
      await cityWeatherCacheRepository.save(cityNormalized, month, validatedResult)

      return { data: validatedResult, fromCache: false }
    }
    catch (err) {
      console.error(`[Weather Generation] Ошибка генерации для города ${trimmedCity}:`, err)
      const fallback = getSeasonalFallbackWeather(trimmedCity, month, lat ?? undefined)
      return { data: fallback, fromCache: false }
    }
  },

  async getBatchWeatherFromCache(
    cities: string[],
    month: number,
  ): Promise<Record<string, CityWeatherData>> {
    const normalizedMap = new Map<string, string>()
    const normalizedList: string[] = []

    for (const c of cities) {
      const norm = normalizeCityName(c)
      normalizedMap.set(norm, c.trim())
      normalizedList.push(norm)
    }

    const cachedMap = await cityWeatherCacheRepository.getManyByCitiesAndMonth(normalizedList, month)
    const result: Record<string, CityWeatherData> = {}

    for (const [norm, data] of cachedMap.entries()) {
      const originalName = normalizedMap.get(norm) || data.city
      if (data.daylight && !data.daylightDescription) {
        const parsedDaylight = splitDaylightText(data.daylight)
        data.daylight = parsedDaylight.value
        data.daylightDescription = parsedDaylight.description
      }
      result[originalName] = { ...data, city: originalName }
    }

    return result
  },

  sanitizeAndValidateWeather,

  /**
   * Санитизация сохраненного weatherData путешествия: прогоняет каждую городскую сводку
   * через физическую валидацию по месяцу начала поездки.
   */
  sanitizeTripWeatherPayload(
    payload: Record<string, unknown>,
    startDate?: string | Date | null,
  ): Record<string, CityWeatherData> {
    const month = startDate
      ? new Date(startDate).getMonth() + 1
      : new Date().getMonth() + 1
    const result: Record<string, CityWeatherData> = {}
    for (const [city, data] of Object.entries(payload)) {
      if (!data || typeof data !== 'object')
        continue
      result[city] = sanitizeAndValidateWeather(
        data as Partial<CityWeatherData>,
        normalizeCityName(city),
        month,
      )
    }
    return result
  },
}
