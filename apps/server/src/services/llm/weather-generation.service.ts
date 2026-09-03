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

export const CityWeatherResponseSchema = z.object({
  tempAverage: z.number().nullable(),
  tempMin: z.number().nullable(),
  tempMax: z.number().nullable(),
  feelsLike: z.number().nullable().optional(),
  rainyDays: z.number().nullable().optional(),
  precipitationProbability: z.number().nullable().optional(),
  precipitationType: z.string().nullable().optional(),
  windSpeed: z.number().nullable().optional(),
  windDescription: z.string().nullable().optional(),
  seasonality: z.enum(['low', 'medium', 'high', 'peak']).nullable().optional(),
  seasonalityDescription: z.string().nullable().optional(),
  daylight: z.string().nullable().optional(),
  clothingRecommendation: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
})

function getSystemPrompt(): string {
  return `
Ты эксперт-климатолог и профессиональный гид по путешествиям. Твоя задача — составить точную климатическую справку и туристический контекст для путешественника по указанному городу и месяцу.

Отвечай СТРОГО в формате валидного JSON-объекта со следующими полями:
{
  "tempAverage": number (средняя дневная температура в градусах Цельсия, целое число),
  "tempMin": number (минимальная температура ночью/утром в градусах Цельсия),
  "tempMax": number (максимальная дневная температура в градусах Цельсия),
  "feelsLike": number (ощущаемая температура с учетом типичной влажности и ветра),
  "rainyDays": number (среднее количество дней с осадками в данном месяце),
  "precipitationProbability": number (вероятность осадков в процентах, от 0 до 100),
  "precipitationType": string (характер осадков на русском: например "дожди, туманы", "мокрый снег", "редкие дожди", "сухая солнечная погода"),
  "windSpeed": number (средняя скорость ветра в км/ч),
  "windDescription": string (описание ветра на русском: например "Умеренный северный бриз", "Свежий морской ветер", "Слабый / штиль"),
  "seasonality": "low" | "medium" | "high" | "peak",
  "seasonalityDescription": string (описание туристической загруженности и сезона на русском: например "Умеренная загруженность, сезон золотой осени и северного сияния"),
  "daylight": string (длина светового дня и особенности освещения на русском: например "~13 часов, завершение белых ночей", "Полярный день", "Короткий день ~5 ч"),
  "clothingRecommendation": string (рекомендации по экипировке на русском: например "Ветрозащитная куртка, непромокаемая обувь, флиска, шапка"),
  "summary": string (1-2 емких предложения с главным практическим советом по климату для поездки в этом месяце)
}

ПРАВИЛА:
1. Строго соблюдай соотношение: tempMin <= tempAverage <= tempMax.
2. Значения seasonality должны быть строго одним из: "low", "medium", "high", "peak".
3. Данные должны отражать реальный климат и туристические реалии города в данный месяц.
4. Отвечай только JSON-объектом, без markdown-тегов и пояснений.
`
}

function getFallbackWeather(city: string, month: number): CityWeatherData {
  const monthName = MONTH_NAMES_RU[month - 1] || 'выбранный месяц'
  return {
    city,
    tempAverage: 15,
    tempMin: 10,
    tempMax: 20,
    feelsLike: 14,
    rainyDays: 8,
    precipitationProbability: 30,
    precipitationType: 'Переменная облачность, возможны кратковременные дожди',
    windSpeed: 15,
    windDescription: 'Умеренный ветер',
    seasonality: 'medium',
    seasonalityDescription: `Обычный туристический сезон в ${monthName}`,
    daylight: '~12–14 часов',
    clothingRecommendation: 'Удобная многослойная одежда, ветровка и обувь для ходьбы',
    summary: `Комфортное время для поездки в город ${city} в ${monthName}.`,
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
    const cityNormalized = trimmedCity.toLowerCase()

    // 1. Проверяем кэш в БД, если не запрошено принудительное обновление
    if (!forceRefresh) {
      const cached = await cityWeatherCacheRepository.getByCityAndMonth(cityNormalized, month)
      if (cached) {
        return { data: { ...cached, city: trimmedCity }, fromCache: true }
      }
    }

    const monthName = MONTH_NAMES_RU[month - 1] || `${month}-й месяц`

    // 2. Генерируем через LLM
    try {
      const prompts: AiRequestPrompts = {
        system: getSystemPrompt(),
        user: `Составь климатический контекст и прогноз для города "${trimmedCity}" на месяц "${monthName}" (${month}-й месяц года).`,
      }

      const modelId = DEFAULT_AI_MODEL
      const completion = await createAiChatRequest(prompts, {
        model: modelId,
        response_format: { type: 'json_object' },
        temperature: 0.3,
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

      const weatherResult: CityWeatherData = {
        city: trimmedCity,
        tempAverage: parsed.tempAverage ?? 15,
        tempMin: parsed.tempMin ?? ((parsed.tempAverage ?? 15) - 5),
        tempMax: parsed.tempMax ?? ((parsed.tempAverage ?? 15) + 5),
        feelsLike: parsed.feelsLike ?? parsed.tempAverage,
        rainyDays: parsed.rainyDays ?? 7,
        precipitationProbability: parsed.precipitationProbability ?? 25,
        precipitationType: parsed.precipitationType ?? 'Кратковременные осадки',
        windSpeed: parsed.windSpeed ?? 15,
        windDescription: parsed.windDescription ?? 'Умеренный ветер',
        seasonality: (parsed.seasonality as SeasonalityLevel) ?? 'medium',
        seasonalityDescription: parsed.seasonalityDescription ?? `Сезон в ${monthName}`,
        daylight: parsed.daylight ?? '~12 часов',
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
      const fallback = getFallbackWeather(trimmedCity, month)
      await cityWeatherCacheRepository.save(cityNormalized, month, fallback)
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
      const norm = c.trim().toLowerCase()
      normalizedMap.set(norm, c.trim())
      normalizedList.push(norm)
    }

    const cachedMap = await cityWeatherCacheRepository.getManyByCitiesAndMonth(normalizedList, month)
    const result: Record<string, CityWeatherData> = {}

    for (const [norm, data] of cachedMap.entries()) {
      const originalName = normalizedMap.get(norm) || data.city
      result[originalName] = { ...data, city: originalName }
    }

    return result
  },
}
