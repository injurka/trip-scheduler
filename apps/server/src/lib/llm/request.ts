import OpenAI from 'openai'
import { externalApiCallsCounter, externalApiDurationHistogram } from '~/services/metrics.service'

// Chat Models
const AI_HUBMIX_MODELS_CHAT = [
  'gemini-2.5-pro',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'Qwen3-VL-235B-A22B-Instruct',
  'Qwen3-Next-80B-A3B-Instruct',
] as const

// TTS Models (OpenAI compatible)
export const AI_TTS_MODELS = [
  'tts-1-hd',
  'gemini-2.5-pro',
  'gpt-4o-mini-tts',
] as const
export type AiTtsModel = typeof AI_TTS_MODELS[number]

// Combined list of all models for general validation or use
export const AI_MODELS = [
  ...AI_HUBMIX_MODELS_CHAT,
  ...AI_TTS_MODELS,
] as const
export type AiModel = typeof AI_MODELS[number] // General model type covering both chat and TTS

// Specific Chat Model Type
const AI_CHAT_MODELS = [...AI_HUBMIX_MODELS_CHAT] as const
export type AiChatModel = typeof AI_CHAT_MODELS[number]

export interface AiRequestOptions {
  model?: AiModel
  temperature?: number
  response_format?: { type: 'text' | 'json_object' }
}

export interface AiRequestPrompts {
  system: string | OpenAI.Chat.Completions.ChatCompletionContentPartText[]
  user: string | OpenAI.Chat.Completions.ChatCompletionContentPart[]
}

export interface AiSpeechRequestPayload {
  input: string
  model: AiTtsModel
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac'
  speed?: number // Speed from 0.25 to 4.0
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
  const isHubMixModel = (AI_HUBMIX_MODELS_CHAT as readonly string[]).includes(modelName)
    || (AI_TTS_MODELS as readonly string[]).includes(modelName)

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

function validateChatModel(model: string): model is AiChatModel {
  return AI_CHAT_MODELS.includes(model as AiChatModel)
}

function validateTtsModel(model: string): model is AiTtsModel {
  return AI_TTS_MODELS.includes(model as AiTtsModel)
}

export async function createAiChatRequest(
  prompt: AiRequestPrompts,
  options?: AiRequestOptions,
) {
  const mergedOptions = {
    model: 'gemini-flash-latest' satisfies AiChatModel,
    response_format: { type: 'json_object' as 'json_object' | 'text' },
    temperature: 0.4,
    ...options,
  }

  if (!validateChatModel(mergedOptions.model)) {
    throw new Error(`Invalid chat model: ${mergedOptions.model}. Available chat models: ${AI_CHAT_MODELS.join(', ')}`)
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

export async function createAiSpeechRequest(
  payload: AiSpeechRequestPayload,
) {
  if (!validateTtsModel(payload.model)) {
    throw new Error(`Invalid TTS model: ${payload.model}. Available TTS models: ${AI_TTS_MODELS.join(', ')}`)
  }

  const { apiKey, baseURL } = getProviderConfig(payload.model)

  const openai = new OpenAI({
    apiKey,
    baseURL,
  })

  return measureExternalApiCall(payload.model, 'speech_creation', () =>
    openai.audio.speech.create({
      model: payload.model,
      input: payload.input,
      voice: payload.voice,
      response_format: payload.response_format ?? 'mp3',
      speed: payload.speed ?? 1.0,
    }))
}
