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
 * Безопасное разделение сырого текста длины дня (на случай старых данных или галлюцинаций LLM)
 */
export function splitDaylightText(rawText?: string | null): { value: string, description: string } {
  if (!rawText)
    return { value: '—', description: 'Световой день' }

  const text = rawText.trim()

  // Если уже компактное значение, например "~14 ч", "~1-2 ч", "24 ч", "0 ч"
  if (/^~?\d+(?:-\d+)?\s*(?:ч|час(?:а|ов)?)$/i.test(text)) {
    return { value: text, description: 'Световой день' }
  }

  // Если строка вида "Полярная ночь (~1-2 часа)" или "Сумерки (~1-2 ч)"
  const inParensMatch = text.match(/\((~?\d+(?:-\d+)?\s*(?:ч|час)[^)]*)\)/i)
  if (inParensMatch && inParensMatch[1]) {
    const value = inParensMatch[1].trim()
    const description = text.replace(inParensMatch[0], '').replace(/[,;]\s*$/, '').trim()
    return { value, description: description || 'Световой день' }
  }

  return { value: text, description: 'Световой день' }
}

/**
 * Расчет длины светового дня с разделением на компактное значение и подробное описание.
 */
export function calculateAstronomicalDaylight(latitude: number, month: number, day = 15): AstronomicalDaylight {
  const clampedLat = Math.max(-89.9, Math.min(89.9, latitude))
  const latRad = (clampedLat * Math.PI) / 180

  const daysBeforeMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  const dayOfYear = (daysBeforeMonth[month - 1] ?? 0) + day

  // Угол склонения Солнца
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
      // Для полярной ночи с сумерками выводим диапазон ~1-2 ч (или точные часы)
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
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=ru&format=json`
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) })
    if (!res.ok)
      return null
    const data = await res.json()
    if (!data.results || !data.results.length)
      return null

    const first = data.results[0]
    return {
      name: first.name,
      latitude: first.latitude,
      longitude: first.longitude,
      country: first.country,
    }
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

    const res = await fetch(url, { signal: AbortSignal.timeout(3500) })
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

function getSystemPrompt(hasRealMetrics: boolean): string {
  return `
Ты профессиональный климатолог и опытный гид-путешественник. Твоя задача — составить точную климатическую справку и туристический контекст для путешественника по указанному городу и месяцу.

${hasRealMetrics ? 'ВНИМАНИЕ: Тебе предоставлены проверенные физические метеорологические данные и астрономическая длина дня. Твоя главная задача — НЕ изменять предоставленные числовые показатели, а дополнить их качественными туристическими описаниями.' : ''}

Отвечай СТРОГО в формате валидного JSON-объекта со следующими полями:
{
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
2. seasonality строго одно из: "low", "medium", "high", "peak".
3. В поле daylight пиши ТОЛЬКО компактное время (например "~1-2 ч", "~14 ч", "24 ч", "0 ч"). Любые слова "Полярная ночь", "сумерки", "белые ночи" пиши ИСКЛЮЧИТЕЛЬНО в daylightDescription!
4. Отвечай только JSON-объектом, без markdown-разметки и пояснений.
`
}

function getSeasonalFallbackWeather(city: string, month: number, latitude?: number): CityWeatherData {
  const monthName = MONTH_NAMES_RU[month - 1] || 'выбранный месяц'
  const isNorthern = latitude === undefined ? true : latitude >= 0
  const isWinter = isNorthern ? [12, 1, 2].includes(month) : [6, 7, 8].includes(month)
  const isSummer = isNorthern ? [6, 7, 8].includes(month) : [12, 1, 2].includes(month)
  const isTransition = !isWinter && !isSummer

  let avg = 15
  let min = 10
  let max = 20
  let precipType = 'Переменная облачность, возможны кратковременные дожди'
  let clothing = 'Удобная многослойная одежда, куртка-ветровка'

  if (isWinter) {
    avg = -5
    min = -10
    max = 0
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
    feelsLike: calculateFeelsLike(avg, 15),
    rainyDays: 8,
    precipitationProbability: 30,
    precipitationType: precipType,
    windSpeed: 15,
    windDescription: 'Умеренный ветер',
    seasonality: 'medium',
    seasonalityDescription: `Обычный туристический сезон в ${monthName}`,
    daylight: daylightInfo?.daylightValue ?? '~10–12 ч',
    daylightDescription: daylightInfo?.daylightDescription ?? 'Световой день',
    clothingRecommendation: clothing,
    summary: `Поездка в ${city} в ${monthName}. Уточняйте краткосрочный прогноз перед выездом.`,
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

    // 1. Проверяем кэш в БД
    if (!forceRefresh) {
      const cached = await cityWeatherCacheRepository.getByCityAndMonth(cityNormalized, month)
      if (cached) {
        // Если в кэше старый формат со склеенным текстом — разделяем на лету
        if (cached.daylight && !cached.daylightDescription) {
          const parsedDaylight = splitDaylightText(cached.daylight)
          cached.daylight = parsedDaylight.value
          cached.daylightDescription = parsedDaylight.description
        }
        return { data: { ...cached, city: trimmedCity }, fromCache: true }
      }
    }

    const monthName = MONTH_NAMES_RU[month - 1] || `${month}-й месяц`

    // 2. Координаты и астрономический световой день
    const geo = await fetchCityCoordinates(trimmedCity)
    const lat = geo?.latitude ?? 55.75
    const daylight = calculateAstronomicalDaylight(lat, month)

    // 3. Реальные метеорологические нормы
    const realClimate = geo ? await fetchClimateNormals(geo.latitude, geo.longitude, month) : null

    try {
      let userPrompt = `Составь климатический контекст и прогноз для города "${trimmedCity}" на месяц "${monthName}" (${month}-й месяц года).`
      if (realClimate && geo) {
        userPrompt += `
Реальные климатические наблюдения (${geo.name}, ${geo.country || ''}):
- Средняя температура: ${realClimate.tempAverage}°C (ночь/утро от ${realClimate.tempMin}°C, день до ${realClimate.tempMax}°C)
- Ощущается как: ${realClimate.feelsLike}°C
- Скорость ветра: ${realClimate.windSpeed} км/ч
- Дней с осадками: ${realClimate.rainyDays}, вероятность: ${realClimate.precipitationProbability}%
- Астрономический день: значение "${daylight.daylightValue}", описание "${daylight.daylightDescription}"

Используй эти фактические цифры и составь точный туристический контекст.`
      }
      else {
        userPrompt += `
Астрономический день для этой широты: значение "${daylight.daylightValue}", описание "${daylight.daylightDescription}".
Составь реалистичные климатические показатели для этого региона в ${monthName}.`
      }

      const prompts: AiRequestPrompts = {
        system: getSystemPrompt(Boolean(realClimate)),
        user: userPrompt,
      }

      const modelId = DEFAULT_AI_MODEL
      const completion = await createAiChatRequest(prompts, {
        model: modelId,
        response_format: { type: 'json_object' },
        temperature: 0.2,
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

      let minT = realClimate?.tempMin ?? parsed.tempMin ?? (parsed.tempAverage ? parsed.tempAverage - 5 : -5)
      let maxT = realClimate?.tempMax ?? parsed.tempMax ?? (parsed.tempAverage ? parsed.tempAverage + 5 : 5)
      let avgT = realClimate?.tempAverage ?? parsed.tempAverage ?? Math.round((minT + maxT) / 2)

      if (minT > maxT) {
        const tmp = minT
        minT = maxT
        maxT = tmp
      }
      if (avgT < minT)
        avgT = minT
      if (avgT > maxT)
        avgT = maxT

      const windSpeed = realClimate?.windSpeed ?? parsed.windSpeed ?? 15
      const feelsLike = realClimate?.feelsLike ?? parsed.feelsLike ?? calculateFeelsLike(avgT, windSpeed)
      const rainyDays = realClimate?.rainyDays ?? parsed.rainyDays ?? 8
      const precipProb = realClimate?.precipitationProbability ?? parsed.precipitationProbability ?? 30

      // Астрономический расчет имеет абсолютный приоритет над текстом LLM
      let resolvedDaylight = daylight.daylightValue
      let resolvedDaylightDescription = daylight.daylightDescription

      // Если астрономия не дала специфики, но LLM вернула данные — парсим их с защитой от склейки
      if (!geo && !daylight.isPolarNight && !daylight.isPolarDay && parsed.daylight) {
        const split = splitDaylightText(parsed.daylight)
        resolvedDaylight = split.value
        resolvedDaylightDescription = parsed.daylightDescription || split.description
      }

      const weatherResult: CityWeatherData = {
        city: trimmedCity,
        tempAverage: avgT,
        tempMin: minT,
        tempMax: maxT,
        feelsLike,
        rainyDays,
        precipitationProbability: precipProb,
        precipitationType: parsed.precipitationType || (avgT <= 0 ? 'Снег' : 'Кратковременные дожди'),
        windSpeed,
        windDescription: parsed.windDescription || (windSpeed > 25 ? 'Сильный ветер' : 'Умеренный ветер'),
        seasonality: (parsed.seasonality as SeasonalityLevel) ?? 'medium',
        seasonalityDescription: parsed.seasonalityDescription ?? `Сезон в ${monthName}`,
        daylight: resolvedDaylight,
        daylightDescription: resolvedDaylightDescription,
        clothingRecommendation: parsed.clothingRecommendation ?? 'Комфортная одежда по погоде',
        summary: parsed.summary ?? `Поездка в ${trimmedCity} в ${monthName}.`,
        updatedAt: new Date().toISOString(),
      }

      // Сохраняем в кэш БД
      await cityWeatherCacheRepository.save(cityNormalized, month, weatherResult)

      return { data: weatherResult, fromCache: false }
    }
    catch (err) {
      console.error(`[Weather Generation] Ошибка генерации для города ${trimmedCity}:`, err)
      const fallback = getSeasonalFallbackWeather(trimmedCity, month, geo?.latitude)
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
      // Защита для старого кэша
      if (data.daylight && !data.daylightDescription) {
        const parsedDaylight = splitDaylightText(data.daylight)
        data.daylight = parsedDaylight.value
        data.daylightDescription = parsedDaylight.description
      }
      result[originalName] = { ...data, city: originalName }
    }

    return result
  },
}
