import OpenAI from 'openai'
import { externalApiCallsCounter, externalApiDurationHistogram } from '~/services/metrics.service'

// Allowed Models
export const AI_MODELS = [
  'baidu-deepseek-v4-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const

export const VISION_CAPABLE_MODELS: readonly AiModel[] = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
]

export type AiModel = typeof AI_MODELS[number]
export type AiChatModel = AiModel

export const DEFAULT_AI_MODEL: AiModel = 'gemini-2.5-flash-lite'

export interface AiRequestOptions {
  model?: AiModel
  temperature?: number
  response_format?: { type: 'text' | 'json_object' }
}

export interface AiRequestPrompts {
  system: string | OpenAI.Chat.Completions.ChatCompletionContentPartText[]
  user: string | OpenAI.Chat.Completions.ChatCompletionContentPart[]
}

interface ProviderConfig {
  apiKey: string | undefined
  baseURL: string | undefined
}

/**
 * Обертка для измерения длительности и подсчета ошибок внешних API вызовов.
 * @param service Имя внешнего сервиса (например, модель LLM).
 * @param operation Название операции (например, 'chat_completion').
 * @param apiCallFn Асинхронная функция, выполняющая сам API вызов.
 * @returns Результат выполнения apiCallFn.
 */
async function measureExternalApiCall<T>(
  service: string,
  operation: string,
  apiCallFn: () => Promise<T>,
): Promise<T> {
  const end = externalApiDurationHistogram.startTimer({ service, operation })
  try {
    const result = await apiCallFn()
    end()
    // При успехе инкрементируем счетчик со статусом 'success'
    externalApiCallsCounter.inc({ service, operation, status: 'success' })
    return result
  }
  catch (error: any) {
    end()
    // При ошибке инкрементируем счетчик со статусом 'error'
    externalApiCallsCounter.inc({ service, operation, status: 'error' })
    throw error
  }
}

function getProviderConfig(modelName: AiModel): ProviderConfig {
  const isHubMixModel = (AI_MODELS as readonly string[]).includes(modelName)

  if (isHubMixModel) {
    return {
      apiKey: process.env.AI_HUBMIX_KEY,
      baseURL: process.env.AI_HUBMIX_API_URL,
    }
  }

  console.warn(`Provider config not clearly defined for model: ${modelName}. Falling back to HubMix.`)
  return {
    apiKey: process.env.AI_HUBMIX_KEY,
    baseURL: process.env.AI_HUBMIX_API_URL,
  }
}

function validateChatModel(model: string): model is AiModel {
  return AI_MODELS.includes(model as AiModel)
}

export async function createAiChatRequest(
  prompt: AiRequestPrompts,
  options?: AiRequestOptions,
) {
  const mergedOptions = {
    model: DEFAULT_AI_MODEL,
    response_format: { type: 'json_object' as 'json_object' | 'text' },
    temperature: 0.4,
    ...options,
  }

  if (!validateChatModel(mergedOptions.model)) {
    throw new Error(`Invalid chat model: ${mergedOptions.model}. Available chat models: ${AI_MODELS.join(', ')}`)
  }

  const hasImageUrl = Array.isArray(prompt.user) && prompt.user.some((p: any) => p?.type === 'image_url')

  const initialModel = hasImageUrl && !VISION_CAPABLE_MODELS.includes(mergedOptions.model)
    ? 'gemini-2.5-flash'
    : mergedOptions.model

  const availableModels = hasImageUrl
    ? AI_MODELS.filter(m => VISION_CAPABLE_MODELS.includes(m))
    : AI_MODELS

  // Model candidate list: primary model first, followed by others as fallback
  const candidateModels: AiModel[] = [
    initialModel,
    ...availableModels.filter(m => m !== initialModel),
  ]

  let lastError: any = null

  for (let i = 0; i < candidateModels.length; i++) {
    const currentModel = candidateModels[i]
    const { apiKey, baseURL } = getProviderConfig(currentModel)

    const openai = new OpenAI({
      apiKey,
      baseURL,
    })

    try {
      return await measureExternalApiCall(currentModel, 'chat_completion', () =>
        openai.chat.completions.create({
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          model: currentModel,
          response_format: mergedOptions.response_format,
          temperature: mergedOptions.temperature,
          stream: false,
        }))
    }
    catch (error: any) {
      lastError = error
      const hasNext = i < candidateModels.length - 1
      if (hasNext) {
        const nextModel = candidateModels[i + 1]
        console.warn(
          `[LLM Request] Модель "${currentModel}" вернула ошибку (${error.message}). Переключение на резервную модель "${nextModel}"...`,
        )
      }
      else {
        console.error(
          `[LLM Request] Все модели (${candidateModels.join(', ')}) завершились ошибкой. Последняя ошибка:`,
          error,
        )
      }
    }
  }

  throw lastError
}
