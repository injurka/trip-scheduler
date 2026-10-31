import type { AiRequestPrompts } from '~/lib/llm'
import { TRPCError } from '@trpc/server'
import { AI_MODELS, createAiChatRequest, DEFAULT_AI_MODEL, parseJsonWithAiRepair } from '~/lib/llm'
import { llmUsageRepository } from '~/repositories/llm-usage.repository'
import { quotaService } from '~/services/quota.service'

export interface ChecklistContextSubtask {
  id: string
  text: string
  completed: boolean
}

export interface ChecklistContextItem {
  id: string
  text: string
  completed: boolean
  tabName?: string
  groupName?: string
  description?: string
  cost?: string
  location?: string
  tags?: string[]
  subtasks?: ChecklistContextSubtask[]
}

export interface ChecklistMatchItemResult {
  itemId: string
  confidence: 'exact' | 'high' | 'possible'
  reason: string
  matchedSubtaskIds?: string[]
}

export interface ChecklistMatchResponse {
  placeInfo?: string
  summary: string
  matches: ChecklistMatchItemResult[]
}

interface MatchChecklistParams {
  userId: string
  fileBuffer?: Buffer
  fileName?: string
  mimeType?: string
  query?: string | null
  checklistItems: ChecklistContextItem[]
}

interface TranscribeVoiceParams {
  userId: string
  fileBuffer: Buffer
  mimeType?: string
}

function getSystemPrompt(): string {
  return `
You are an intelligent travel assistant helping a traveler quickly check if a place, store, restaurant, menu, or shelf in front of them matches any items in their travel checklist (such as Must-Try food, Must-Buy shopping, Must-Do experiences, or preparation tasks).

YOUR GOAL:
1. Analyze the user's question/context and/or the attached photo (e.g., store sign, restaurant menu, product shelf, street view, map screenshot).
2. Translate and understand any foreign text on the photo (Japanese, Chinese, Korean, English, Thai, etc.).
3. Compare the detected place, dishes, products, or activities with the user's CHECKLIST ITEMS provided in the prompt.
4. Identify both:
   - Direct/Exact matches ("exact"): The specific dish, product, brand, or place from the checklist is visible in the photo or explicitly mentioned.
   - Category/Store matches ("high" or "possible"): The user is at a store/place (e.g., 7-Eleven, Watsons, Don Quijote, night market, pharmacy, bakery, tea shop) where items from their checklist can typically be bought, tried, or completed.

RULES:
1. **Respond ONLY with a valid JSON object.** Do not include markdown fences or extra text outside the JSON.
2. All human-readable text (\`placeInfo\`, \`summary\`, \`reason\`) MUST be in Russian.
3. Only reference \`itemId\` and \`matchedSubtaskIds\` that actually exist in the provided CHECKLIST ITEMS. Never invent IDs.
4. Sort \`matches\` from highest relevance (\`exact\`) to lowest (\`possible\`).
5. If nothing in the checklist relates to the place/photo/query, return an empty \`matches: []\` array and explain clearly in \`summary\` what the place/photo is and that nothing from the checklist is needed here.

REQUIRED JSON STRUCTURE:
{
  "placeInfo": "string (optional, brief description of what place, store, or menu was recognized, e.g. 'Магазин Don Quijote' or 'Меню пельменной Din Tai Fung')",
  "summary": "string (concise, helpful summary in Russian answering the user's question and highlighting what they can do/buy/try here from their checklist)",
  "matches": [
    {
      "itemId": "string (exact id from CHECKLIST ITEMS)",
      "confidence": "exact" | "high" | "possible",
      "reason": "string (in Russian: clear explanation of why this item matches, e.g., where it is on the menu/photo or why this store has it)",
      "matchedSubtaskIds": ["string (optional array of matching subtask IDs from this item)"]
    }
  ]
}
`
}

function getUserPrompt(query: string | null | undefined, checklistItems: ChecklistContextItem[]): AiRequestPrompts['user'] {
  const parts: AiRequestPrompts['user'] = []

  let textPrompt = 'Check if the provided place, question, or image covers any items in my travel checklist.\n\n'

  if (query && query.trim()) {
    textPrompt += `USER QUESTION / CONTEXT:\n---\n${query.trim()}\n---\n\n`
  }
  else {
    textPrompt += `USER QUESTION / CONTEXT:\n---\nПосмотри на фото и подскажи, есть ли здесь что-то из моего чек-листа, что мне нужно купить, попробовать или сделать.\n---\n\n`
  }

  textPrompt += `CHECKLIST ITEMS (JSON):\n---\n${JSON.stringify(checklistItems, null, 2)}\n---\n\n`
  textPrompt += 'Provide the JSON object response strictly following the system instructions.'

  parts.push({ type: 'text', text: textPrompt })

  return parts
}

async function matchChecklistFromData({
  userId,
  fileBuffer,
  fileName,
  mimeType,
  query,
  checklistItems,
}: MatchChecklistParams): Promise<ChecklistMatchResponse> {
  await quotaService.checkLlmCreditQuota(userId)

  const hasImage = Boolean(
    fileBuffer
    && (
      (mimeType && mimeType.startsWith('image/'))
      || (fileName && /\.(?:png|jpg|jpeg|webp|gif)$/i.test(fileName))
    ),
  )

  if (!hasImage && (!query || !query.trim())) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Пожалуйста, добавьте фото или напишите/надиктуйте вопрос.',
    })
  }

  if (!checklistItems || checklistItems.length === 0) {
    return {
      summary: 'В выбранном списке пока нет задач для проверки.',
      matches: [],
    }
  }

  const prompts: AiRequestPrompts = {
    system: getSystemPrompt(),
    user: getUserPrompt(query, checklistItems),
  }

  if (hasImage && fileBuffer) {
    const resolvedMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg'
    if (!Array.isArray(prompts.user)) {
      prompts.user = [{ type: 'text', text: prompts.user as string }]
    }
    ;(prompts.user as any[]).push({
      type: 'image_url',
      image_url: {
        url: `data:${resolvedMime};base64,${fileBuffer.toString('base64')}`,
      },
    })
  }

  const modelId = DEFAULT_AI_MODEL
  const completion = await createAiChatRequest(prompts, {
    model: modelId,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  if (completion.usage) {
    const actualModelId = (AI_MODELS as readonly string[]).find(
      m => completion.model?.includes(m) || m.includes(completion.model),
    ) || modelId

    await quotaService.deductLlmCredits(
      userId,
      actualModelId,
      completion.usage.prompt_tokens,
      completion.usage.completion_tokens,
    )

    await llmUsageRepository.create({
      userId,
      model: actualModelId,
      operation: 'checklistMatch',
      inputTokens: completion.usage.prompt_tokens,
      outputTokens: completion.usage.completion_tokens,
    })
  }

  const jsonResponse = completion.choices[0]?.message?.content
  if (!jsonResponse) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ не вернул результат.' })
  }

  const validItemsMap = new Map(checklistItems.map(item => [item.id, item]))

  const parsedData = await parseJsonWithAiRepair<ChecklistMatchResponse>(jsonResponse, {
    userId,
    model: modelId,
    operation: 'checklistMatch',
    customInstructions: 'The output must be a valid JSON object with fields: "placeInfo" (optional string), "summary" (string), and "matches" (array of objects with "itemId", "confidence", "reason", and optional "matchedSubtaskIds").',
    validate: data => Boolean(
      data
      && typeof data === 'object'
      && typeof data.summary === 'string'
      && Array.isArray(data.matches),
    ),
  })

  const sanitizedMatches: ChecklistMatchItemResult[] = (parsedData.matches || [])
    .filter(m => m && typeof m.itemId === 'string' && validItemsMap.has(m.itemId))
    .map((m) => {
      const sourceItem = validItemsMap.get(m.itemId)!
      const validSubtaskIds = new Set((sourceItem.subtasks || []).map(s => s.id))
      const confidence: 'exact' | 'high' | 'possible' = ['exact', 'high', 'possible'].includes(m.confidence)
        ? m.confidence
        : 'possible'

      return {
        itemId: m.itemId,
        confidence,
        reason: typeof m.reason === 'string' ? m.reason : '',
        matchedSubtaskIds: Array.isArray(m.matchedSubtaskIds)
          ? m.matchedSubtaskIds.filter(id => validSubtaskIds.has(id))
          : [],
      }
    })

  return {
    placeInfo: typeof parsedData.placeInfo === 'string' && parsedData.placeInfo.trim()
      ? parsedData.placeInfo.trim()
      : undefined,
    summary: parsedData.summary,
    matches: sanitizedMatches,
  }
}

async function transcribeVoiceNote({
  userId,
  fileBuffer,
  mimeType,
}: TranscribeVoiceParams): Promise<{ text: string }> {
  await quotaService.checkLlmCreditQuota(userId)

  const resolvedMime = mimeType || 'audio/webm'
  const prompts: AiRequestPrompts = {
    system: 'You are an accurate speech-to-text transcription assistant. Transcribe the user audio recording verbatim in the language spoken (primarily Russian, with possible foreign place/brand/food names). Respond ONLY with a JSON object: { "text": "transcribed text" }.',
    user: [
      {
        type: 'text',
        text: 'Transcribe this audio recording into text. Return JSON: { "text": "..." }',
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:${resolvedMime};base64,${fileBuffer.toString('base64')}`,
        },
      } as any,
    ],
  }

  const modelId = DEFAULT_AI_MODEL
  const completion = await createAiChatRequest(prompts, {
    model: modelId,
    temperature: 0.1,
    response_format: { type: 'json_object' },
  })

  if (completion.usage) {
    const actualModelId = (AI_MODELS as readonly string[]).find(
      m => completion.model?.includes(m) || m.includes(completion.model),
    ) || modelId

    await quotaService.deductLlmCredits(
      userId,
      actualModelId,
      completion.usage.prompt_tokens,
      completion.usage.completion_tokens,
    )

    await llmUsageRepository.create({
      userId,
      model: actualModelId,
      operation: 'checklistVoiceTranscribe',
      inputTokens: completion.usage.prompt_tokens,
      outputTokens: completion.usage.completion_tokens,
    })
  }

  const raw = completion.choices[0]?.message?.content || '{}'
  const parsed = await parseJsonWithAiRepair<{ text: string }>(raw, {
    userId,
    model: modelId,
    operation: 'checklistVoiceTranscribe',
    validate: data => Boolean(data && typeof data.text === 'string'),
  })

  return { text: parsed.text.trim() }
}

export const checklistMatchService = {
  matchChecklistFromData,
  transcribeVoiceNote,
}
