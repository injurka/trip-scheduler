import OpenAI from 'openai'

// Chat Models
const AI_HUBMIX_MODELS_CHAT = [
  'gemini-2.5-pro',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
] as const

// Combined list of all models for general validation or use
export const AI_MODELS = [
  ...AI_HUBMIX_MODELS_CHAT,
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

interface ProviderConfig {
  apiKey: string | undefined
  baseURL: string | undefined
}

function getProviderConfig(modelName: AiModel): ProviderConfig {
  const isHubMixModel = (AI_HUBMIX_MODELS_CHAT as readonly string[]).includes(modelName)

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

  return openai.chat.completions.create({
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    model: mergedOptions.model,
    response_format: mergedOptions.response_format,
    temperature: mergedOptions.temperature,
    stream: false,
  })
}
