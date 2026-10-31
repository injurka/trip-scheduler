import type { ZodType } from 'zod'
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
  maxTokens?: number
  customInstructions?: string
  validate?: (data: T) => boolean
  schema?: ZodType<T>
  validateWithErrors?: (data: any) => { success: true, data: T } | { success: false, errors: string[] }
  transformOnSuccess?: (data: T) => T
}

export interface DataValidationResult<T> {
  success: boolean
  data?: T
  errors?: string[]
}

const VALID_JSON_ESCAPE_CHARS = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't'])
const HEX_DIGIT_REGEX = /^[0-9a-f]{4}$/i

/**
 * Validates parsed data against schema, validateWithErrors, or validate callback.
 */
export function validateParsedData<T = any>(
  data: any,
  options: Pick<ParseJsonWithAiRepairOptions<T>, 'schema' | 'validate' | 'validateWithErrors'>,
): DataValidationResult<T> {
  if (options.schema) {
    const result = options.schema.safeParse(data)
    if (!result.success) {
      const errors: string[] = []
      const collectErrors = (issue: any) => {
        if (issue.code === 'invalid_union') {
          const nested = issue.errors || issue.unionErrors
          if (Array.isArray(nested)) {
            for (const sub of nested) {
              if (Array.isArray(sub)) {
                for (const subIssue of sub) {
                  collectErrors(subIssue)
                }
              }
              else if (sub && Array.isArray(sub.issues)) {
                for (const subIssue of sub.issues) {
                  collectErrors(subIssue)
                }
              }
            }
            return
          }
        }

        const path = issue.path && issue.path.length > 0 ? issue.path.join('.') : 'root'
        errors.push(`Field "${path}": ${issue.message}`)
      }

      for (const issue of result.error.issues) {
        collectErrors(issue)
      }

      const specificErrors = errors.filter(e => !e.includes('Field "root": Invalid input') && !e.includes('Field "root": expected array, received object'))
      const finalErrors = specificErrors.length > 0 ? specificErrors : errors

      return { success: false, errors: finalErrors.length > 0 ? finalErrors : ['Validation failed'] }
    }

    // Schema passed — also run validateWithErrors or validate if provided!
    if (options.validateWithErrors) {
      const customResult = options.validateWithErrors(result.data)
      if (!customResult.success) {
        return { success: false, errors: customResult.errors }
      }
      return { success: true, data: customResult.data }
    }

    if (options.validate) {
      const isValid = options.validate(result.data)
      if (!isValid) {
        return { success: false, errors: ['Структура данных не прошла проверку валидатора.'] }
      }
    }

    return { success: true, data: result.data }
  }

  if (options.validateWithErrors) {
    const result = options.validateWithErrors(data)
    if (result.success) {
      return { success: true, data: result.data }
    }
    return { success: false, errors: result.errors }
  }

  if (options.validate) {
    const isValid = options.validate(data)
    if (isValid) {
      return { success: true, data }
    }
    return { success: false, errors: ['Структура данных не прошла проверку валидатора.'] }
  }

  return { success: true, data }
}

/**
 * Extracts outer JSON candidate from markdown fences and surrounding prose.
 */
export function extractOuterJsonCandidate(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return ''
  }

  let text = raw.trim()

  // 1. Extract content from outer markdown code block ONLY if the whole response starts with a fence
  // (Careful not to match ```mermaid fences inside JSON string values when response itself is not fenced!)
  if (text.startsWith('```')) {
    const lastFence = text.lastIndexOf('```')
    if (lastFence > 3) {
      let inner = text.slice(3, lastFence).trim()
      if (inner.toLowerCase().startsWith('json')) {
        inner = inner.slice(4).trim()
      }
      text = inner
    }
    else {
      text = text.replace(/^```(?:json)?/i, '').trim()
    }
  }
  else {
    // Check if there's a ```json block preceded only by short prose (no `{` before the fence)
    const firstBrace = text.indexOf('{')
    const firstBracket = text.indexOf('[')
    const firstFence = text.indexOf('```')
    const earliestJsonChar = firstBrace === -1
      ? firstBracket
      : (firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket))

    if (firstFence !== -1 && (earliestJsonChar === -1 || firstFence < earliestJsonChar)) {
      const lastFence = text.lastIndexOf('```')
      if (lastFence > firstFence + 2) {
        let inner = text.slice(firstFence + 3, lastFence).trim()
        if (inner.toLowerCase().startsWith('json')) {
          inner = inner.slice(4).trim()
        }
        text = inner
      }
    }
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

  return text.trim()
}

/**
 * String-aware JSON repair for LLM outputs containing Markdown, URLs, comments,
 * raw newlines/tabs inside strings, invalid backslash escapes (e.g. `\|`, `\[`, `\*`),
 * and trailing commas.
 */
export function repairJsonLiteralsAndComments(input: string): string {
  if (!input)
    return ''

  let out = ''
  let inString = false
  let i = 0
  const len = input.length

  while (i < len) {
    const ch = input[i]

    if (!inString) {
      // Strip single-line // comments outside strings
      if (ch === '/' && input[i + 1] === '/') {
        i += 2
        while (i < len && input[i] !== '\n') {
          i++
        }
        continue
      }

      // Strip multi-line /* ... */ comments outside strings
      if (ch === '/' && input[i + 1] === '*') {
        i += 2
        while (i < len && !(input[i] === '*' && input[i + 1] === '/')) {
          i++
        }
        i += 2
        continue
      }

      // Strip trailing commas before } or ] (skipping whitespace and comments)
      if (ch === ',') {
        let lookahead = i + 1
        while (lookahead < len) {
          const la = input[lookahead]
          if (la === ' ' || la === '\t' || la === '\r' || la === '\n') {
            lookahead++
            continue
          }
          if (la === '/' && input[lookahead + 1] === '/') {
            lookahead += 2
            while (lookahead < len && input[lookahead] !== '\n') lookahead++
            continue
          }
          if (la === '/' && input[lookahead + 1] === '*') {
            lookahead += 2
            while (lookahead < len && !(input[lookahead] === '*' && input[lookahead + 1] === '/')) lookahead++
            lookahead += 2
            continue
          }
          break
        }
        if (lookahead < len && (input[lookahead] === '}' || input[lookahead] === ']')) {
          i++
          continue
        }
      }

      if (ch === '"') {
        inString = true
      }

      out += ch
      i++
      continue
    }

    // Inside a JSON string literal
    if (ch === '\\') {
      const next = input[i + 1]
      if (next === undefined) {
        out += '\\\\'
        i++
        continue
      }

      if (VALID_JSON_ESCAPE_CHARS.has(next)) {
        out += ch + next
        i += 2
        continue
      }

      if (next === 'u') {
        const hex = input.slice(i + 2, i + 6)
        if (HEX_DIGIT_REGEX.test(hex)) {
          out += `\\u${hex}`
          i += 6
          continue
        }
        // Invalid \u escape (e.g. "\users") -> escape the backslash
        out += '\\\\'
        i++
        continue
      }

      // Raw escaped newline inside string -> \n
      if (next === '\n') {
        out += '\\n'
        i += 2
        continue
      }
      if (next === '\r') {
        if (input[i + 2] === '\n')
          i += 3
        else
          i += 2
        out += '\\n'
        continue
      }

      // Invalid escape sequence like \|, \[, \], \*, \_ in Markdown -> preserve literal backslash
      out += `\\\\${next}`
      i += 2
      continue
    }

    if (ch === '"') {
      inString = false
      out += ch
      i++
      continue
    }

    // Escape raw unescaped control characters inside strings
    const code = ch.charCodeAt(0)
    if (code < 0x20) {
      if (ch === '\n') {
        out += '\\n'
      }
      else if (ch === '\r') {
        // Normalize \r\n or \r inside string
        if (input[i + 1] === '\n')
          i++
        out += '\\n'
      }
      else if (ch === '\t') {
        out += '\\t'
      }
      else {
        out += `\\u${code.toString(16).padStart(4, '0')}`
      }
      i++
      continue
    }

    out += ch
    i++
  }

  return out.trim()
}

/**
 * Extracts and sanitizes a JSON string from raw LLM output.
 * Handles markdown code fences, leading/trailing commentary, comments,
 * raw control characters, invalid Markdown escapes, and trailing commas.
 */
export function sanitizeJsonString(raw: string): string {
  const candidate = extractOuterJsonCandidate(raw)
  return repairJsonLiteralsAndComments(candidate)
}

/**
 * Attempts to safely parse JSON.
 */
export function tryParseJson<T = any>(raw: string): { success: true, data: T } | { success: false, error: Error } {
  // 1. Direct attempt
  try {
    const data = JSON.parse(raw)
    return { success: true, data }
  }
  catch {
    // Fall through to sanitized parse
  }

  // 2. Outer candidate extraction attempt (before string-level rewriting)
  const candidate = extractOuterJsonCandidate(raw)
  if (candidate && candidate !== raw) {
    try {
      const data = JSON.parse(candidate)
      return { success: true, data }
    }
    catch {
      // Fall through to full string-aware repair
    }
  }

  // 3. String-aware repaired attempt
  const repaired = repairJsonLiteralsAndComments(candidate)
  try {
    const data = JSON.parse(repaired)
    return { success: true, data }
  }
  catch (error: any) {
    return { success: false, error }
  }
}

/**
 * Parses JSON response from LLM, and if invalid (syntax or schema validation),
 * triggers an agentic AI repair request loop to fix the JSON and adhere to the schema.
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
    maxTokens,
    customInstructions,
    validate,
    schema,
    validateWithErrors,
    transformOnSuccess,
  } = options

  // 1. Initial parse attempt
  const initialResult = tryParseJson<any>(rawResponse)
  let validationIssues: string[] = []

  if (initialResult.success) {
    const validation = validateParsedData<T>(initialResult.data, { schema, validate, validateWithErrors })
    if (validation.success && validation.data !== undefined) {
      return transformOnSuccess ? transformOnSuccess(validation.data) : validation.data
    }
    validationIssues = validation.errors || ['Структура данных не прошла валидацию.']
  }
  else {
    validationIssues = [initialResult.error.message]
  }

  let lastError = new Error(validationIssues.join('; '))
  let currentContent = rawResponse

  console.warn(
    `[AI JSON Parser] Первичная валидация JSON не удалась (${lastError.message}). Запуск агента исправления (попыток: ${maxRetries})...`,
  )

  // 2. Agentic Repair Loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (userId) {
        await quotaService.checkLlmCreditQuota(userId)
      }

      console.warn(`[AI JSON Parser] Попытка исправления JSON ${attempt}/${maxRetries}...`)

      const errorDetails = validationIssues.length > 0
        ? `The previous JSON output failed validation with the following error(s):\n${validationIssues.map((e, idx) => `  ${idx + 1}. ${e}`).join('\n')}`
        : `The previous JSON output failed parsing with error: "${lastError.message}".`

      const repairPrompts = {
        system: `You are an expert JSON and Schema validation repair agent.
Your task is to take the provided malformed text or invalid JSON and fix all syntax errors, unescaped characters/newlines, missing or mismatched brackets/quotes, and schema validation violations.
Return ONLY valid RFC 8259 compliant JSON that strictly adheres to the schema and instructions.
DO NOT wrap the response in markdown code blocks (\`\`\`json).
DO NOT include any commentary, markdown, or text other than the JSON object/array.`,
        user: `${errorDetails}
${customInstructions ? `\nRequired Structure & Schema Rules:\n${customInstructions}\n` : ''}
Fix all JSON syntax and schema validation errors, ensuring every field strictly conforms to the schema rules. Return ONLY the valid JSON:

--- MALFORMED / INVALID CONTENT ---
${currentContent}`,
      }

      const repairCompletion = await createAiChatRequest(repairPrompts, {
        model,
        temperature: 0.1,
        max_tokens: maxTokens,
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

      const repairResult = tryParseJson<any>(repairedRaw)
      if (repairResult.success) {
        const validation = validateParsedData<T>(repairResult.data, { schema, validate, validateWithErrors })
        if (validation.success && validation.data !== undefined) {
          console.warn(`[AI JSON Parser] JSON успешно исправлен ИИ на попытке ${attempt}!`)
          return transformOnSuccess ? transformOnSuccess(validation.data) : validation.data
        }
        validationIssues = validation.errors || ['Валидация исправленных данных не прошла проверку структуры.']
        lastError = new Error(validationIssues.join('; '))
      }
      else {
        validationIssues = [repairResult.error.message]
        lastError = repairResult.error
      }

      currentContent = repairedRaw
    }
    catch (attemptErr: any) {
      console.error(`[AI JSON Parser] Ошибка на шаге исправления ${attempt}:`, attemptErr)
      lastError = attemptErr
    }
  }

  console.error('[AI JSON Parser] Все попытки исправления JSON исчерпаны. Исходный ответ:', rawResponse.slice(0, 1500))
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: `ИИ вернул данные, не соответствующие схеме (${lastError.message}), и попытка автоматического исправления агентом не удалась.`,
    cause: lastError,
  })
}
