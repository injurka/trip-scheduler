import type { AiModel } from './request'
import { TRPCError } from '@trpc/server'
import { llmUsageRepository } from '~/repositories/llm-usage.repository'
import { quotaService } from '~/services/quota.service'
import { createAiChatRequest, DEFAULT_AI_MODEL } from './request'

export interface ParseJsonWithAiRepairOptions<T = any> {
  userId?: string
  model?: AiModel
  operation?: string
  maxRetries?: number
  customInstructions?: string
  validate?: (data: T) => boolean
}

/**
 * Extracts and sanitizes a JSON string from raw LLM output.
 * Handles markdown code fences, leading/trailing commentary, comments, and trailing commas.
 */
export function sanitizeJsonString(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return ''
  }

  let text = raw.trim()

  // 1. Extract content from markdown code block if present (e.g. ```json ... ```)
  const firstFence = text.indexOf('```')
  const lastFence = text.lastIndexOf('```')
  if (firstFence !== -1 && lastFence > firstFence) {
    let inner = text.slice(firstFence + 3, lastFence).trim()
    if (inner.toLowerCase().startsWith('json')) {
      inner = inner.slice(4).trim()
    }
    text = inner
  }
  else {
    // Strip partial/unclosed markdown code fences
    text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  }

  // 2. Find outermost JSON structure: first '{' or '[' to last matching '}' or ']'
  const firstBrace = text.indexOf('{')
  const firstBracket = text.indexOf('[')

  let startIndex = -1
  let isArray = false

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIndex = firstBrace
    isArray = false
  }
  else if (firstBracket !== -1) {
    startIndex = firstBracket
    isArray = true
  }

  if (startIndex !== -1) {
    const endChar = isArray ? ']' : '}'
    const lastIndex = text.lastIndexOf(endChar)
    if (lastIndex > startIndex) {
      text = text.substring(startIndex, lastIndex + 1)
    }
  }

  // 3. Remove single-line comments (// ...) outside strings
  text = text.replace(/^\s*\/\/.*$/gm, '')

  // 4. Remove multi-line comments (/* ... */)
  text = text.replace(/\/\*[\s\S]*?\*\//g, '')

  // 5. Remove trailing commas before closing braces/brackets
  text = text.replace(/,\s*([\]}])/g, '$1')

  return text.trim()
}

/**
 * Attempts to safely parse JSON.
 */
export function tryParseJson<T = any>(raw: string): { success: true, data: T } | { success: false, error: Error } {
  // Direct attempt
  try {
    const data = JSON.parse(raw)
    return { success: true, data }
  }
  catch {
    // Fall through to sanitized parse
  }

  // Sanitized attempt
  const sanitized = sanitizeJsonString(raw)
  try {
    const data = JSON.parse(sanitized)
    return { success: true, data }
  }
  catch (error: any) {
    return { success: false, error }
  }
}

/**
 * Parses JSON response from LLM, and if invalid, triggers an agentic AI repair request
 * to fix the JSON syntax and structure.
 */
export async function parseJsonWithAiRepair<T = any>(
  rawResponse: string,
  options: ParseJsonWithAiRepairOptions<T> = {},
): Promise<T> {
  const {
    userId,
    model = DEFAULT_AI_MODEL,
    operation = 'llmOperation',
    maxRetries = 2,
    customInstructions,
    validate,
  } = options

  // 1. Initial parse attempt
  const initialResult = tryParseJson<T>(rawResponse)
  if (initialResult.success) {
    if (!validate || validate(initialResult.data)) {
      return initialResult.data
    }
  }

  let lastError = initialResult.success
    ? new Error('Валидация спарсенных данных JSON не прошла проверку структуры.')
    : initialResult.error

  let currentContent = rawResponse

  console.warn(
    `[AI JSON Parser] Первичный парсинг JSON не удался (${lastError.message}). Запуск агента исправления JSON (попыток: ${maxRetries})...`,
  )

  // 2. Agentic Repair Loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (userId) {
        await quotaService.checkLlmCreditQuota(userId)
      }

      console.warn(`[AI JSON Parser] Попытка исправления JSON ${attempt}/${maxRetries}...`)

      const repairPrompts = {
        system: `You are an expert JSON repair assistant.
Your task is to take the provided malformed text or invalid JSON and fix all syntax errors, unescaped characters/newlines, missing or mismatched brackets/quotes, and trailing commas.
Return ONLY valid RFC 8259 compliant JSON.
DO NOT wrap the response in markdown code blocks (\`\`\`json).
DO NOT include any commentary, markdown, or text other than the JSON object/array.`,
        user: `The previous JSON output failed parsing with error: "${lastError.message}".
${customInstructions ? `Required Structure/Notes: ${customInstructions}\n` : ''}
Fix all JSON syntax errors and return ONLY the valid JSON:

--- MALFORMED CONTENT ---
${currentContent}`,
      }

      const repairCompletion = await createAiChatRequest(repairPrompts, {
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      })

      if (repairCompletion.usage && userId) {
        await quotaService.deductLlmCredits(
          userId,
          model,
          repairCompletion.usage.prompt_tokens,
          repairCompletion.usage.completion_tokens,
        )

        await llmUsageRepository.create({
          userId,
          model,
          operation: `${operation}:repair`,
          inputTokens: repairCompletion.usage.prompt_tokens,
          outputTokens: repairCompletion.usage.completion_tokens,
        })
      }

      const repairedRaw = repairCompletion.choices[0]?.message?.content
      if (!repairedRaw) {
        throw new Error('AI агент исправления вернул пустой ответ.')
      }

      const repairResult = tryParseJson<T>(repairedRaw)
      if (repairResult.success) {
        if (!validate || validate(repairResult.data)) {
          console.warn(`[AI JSON Parser] JSON успешно исправлен ИИ на попытке ${attempt}!`)
          return repairResult.data
        }
        lastError = new Error('Валидация исправленных данных JSON не прошла проверку структуры.')
      }
      else {
        lastError = repairResult.error
      }

      currentContent = repairedRaw
    }
    catch (attemptErr: any) {
      console.error(`[AI JSON Parser] Ошибка на шаге исправления ${attempt}:`, attemptErr)
      lastError = attemptErr
    }
  }

  console.error('[AI JSON Parser] Все попытки исправления JSON исчерпаны. Исходный ответ:', rawResponse)
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'ИИ вернул невалидный JSON, и попытка автоматического исправления агентом не удалась.',
    cause: lastError,
  })
}
