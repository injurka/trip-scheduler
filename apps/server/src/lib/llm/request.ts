import OpenAI from 'openai'
import { externalApiCallsCounter, externalApiDurationHistogram } from '~/services/metrics.service'

// Allowed Models
export const AI_MODELS = [
  'baidu-deepseek-v4-flash-0731',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
] as const

export type AiModel = typeof AI_MODELS[number]
export type AiChatModel = AiModel

export const DEFAULT_AI_MODEL: AiModel = 'baidu-deepseek-v4-flash-0731'

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

  const { apiKey, baseURL } = getProviderConfig(mergedOptions.model)

  const openai = new OpenAI({
    apiKey,
    baseURL,
  })

  return measureExternalApiCall(mergedOptions.model, 'chat_completion', () =>
    openai.chat.completions.create({
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      model: mergedOptions.model,
      response_format: mergedOptions.response_format,
      temperature: mergedOptions.temperature,
      stream: false,
    }))
}
