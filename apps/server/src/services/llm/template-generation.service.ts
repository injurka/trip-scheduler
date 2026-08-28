import type { AiRequestPrompts } from '~/lib/llm'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { AI_MODELS, createAiChatRequest, DEFAULT_AI_MODEL, parseJsonWithAiRepair } from '~/lib/llm'
import { llmUsageRepository } from '~/repositories/llm-usage.repository'
import { quotaService } from '~/services/quota.service'

export const VALID_ACTIVITY_TAGS = ['transport', 'walk', 'food', 'attraction', 'relax', 'activity'] as const
export type ActivityTag = (typeof VALID_ACTIVITY_TAGS)[number]

const TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export function normalizeTimeString(timeStr: any): string {
  if (!timeStr || typeof timeStr !== 'string') {
    return '00:00'
  }
  const trimmed = timeStr.trim()
  const singleDigitHourMatch = /^(\d):([0-5]\d)$/.exec(trimmed)
  if (singleDigitHourMatch) {
    return `0${singleDigitHourMatch[1]}:${singleDigitHourMatch[2]}`
  }
  if (TIME_REGEX.test(trimmed)) {
    return trimmed
  }
  return trimmed
}

const TagSynonymsMap: Record<string, ActivityTag> = {
  // Transport
  'transport': 'transport',
  'транспорт': 'transport',
  'дорога': 'transport',
  'переезд': 'transport',
  'поездка': 'transport',
  'трансфер': 'transport',
  'transfer': 'transport',
  'drive': 'transport',
  'flight': 'transport',
  'train': 'transport',
  'bus': 'transport',
  'taxi': 'transport',
  'снегоход': 'transport',
  'сани': 'transport',
  'катер': 'transport',
  'ferry': 'transport',

  // Walk
  'walk': 'walk',
  'walking': 'walk',
  'прогулка': 'walk',
  'пешком': 'walk',
  'хайкинг': 'walk',
  'треккинг': 'walk',
  'hiking': 'walk',
  'trekking': 'walk',
  'stroll': 'walk',

  // Food
  'food': 'food',
  'еда': 'food',
  'обед': 'food',
  'завтрак': 'food',
  'ужин': 'food',
  'кафе': 'food',
  'ресторан': 'food',
  'перекус': 'food',
  'дегустация': 'food',
  'restaurant': 'food',
  'lunch': 'food',
  'dinner': 'food',
  'breakfast': 'food',
  'cafe': 'food',
  'meal': 'food',
  'snack': 'food',

  // Attraction
  'attraction': 'attraction',
  'достопримечательность': 'attraction',
  'музей': 'attraction',
  'пляж': 'attraction',
  'водопад': 'attraction',
  'природа': 'attraction',
  'парк': 'attraction',
  'памятник': 'attraction',
  'каньон': 'attraction',
  'кладбище': 'attraction',
  'озеро': 'attraction',
  'храм': 'attraction',
  'собор': 'attraction',
  'nature': 'attraction',
  'sight': 'attraction',
  'sights': 'attraction',
  'sightseeing': 'attraction',
  'museum': 'attraction',
  'beach': 'attraction',
  'waterfall': 'attraction',
  'viewpoint': 'attraction',
  'photo': 'attraction',

  // Relax
  'relax': 'relax',
  'отдых': 'relax',
  'релакс': 'relax',
  'сон': 'relax',
  'спа': 'relax',
  'отель': 'relax',
  'гостиница': 'relax',
  'баня': 'relax',
  'сауна': 'relax',
  'hotel': 'relax',
  'spa': 'relax',
  'sleep': 'relax',
  'rest': 'relax',
  'leisure': 'relax',

  // Activity
  'activity': 'activity',
  'активность': 'activity',
  'экскурсия': 'activity',
  'спорт': 'activity',
  'тур': 'activity',
  'мастер-класс': 'activity',
  'дайвинг': 'activity',
  'лыжи': 'activity',
  'сноуборд': 'activity',
  'tour': 'activity',
  'excursion': 'activity',
  'sport': 'activity',
  'entertainment': 'activity',
  'workshop': 'activity',
  'event': 'activity',
}

export function sanitizeTag(tag: any): ActivityTag {
  if (typeof tag !== 'string') {
    return 'activity'
  }
  const normalized = tag.trim().toLowerCase()
  if (TagSynonymsMap[normalized]) {
    return TagSynonymsMap[normalized]
  }
  return 'activity'
}

export const AiSectionSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  type: z.string().default('description'),
  text: z.string().optional().default(''),
  isAttached: z.boolean().optional(),
  title: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
}).passthrough()

export const AiActivitySchema = z.object({
  id: z.string({ message: 'Поле "id" обязательно (UUID).' }),
  startTime: z.string().regex(TIME_REGEX, {
    message: 'startTime должно быть строго в 24-часовом формате HH:mm с двумя цифрами часа (например, "08:00", "00:30", "14:15")',
  }),
  endTime: z.string().regex(TIME_REGEX, {
    message: 'endTime должно быть строго в 24-часовом формате HH:mm с двумя цифрами часа (например, "09:30", "10:00", "18:00")',
  }),
  title: z.string().min(1, { message: 'Поле "title" не может быть пустым' }),
  tag: z.enum(VALID_ACTIVITY_TAGS, {
    message: 'Поле "tag" должно быть строго одним из: "transport" | "walk" | "food" | "attraction" | "relax" | "activity" (только латиница в нижнем регистре, без перевода и синонимов)',
  }),
  dayId: z.string().optional().nullable(),
  explanation: z.string().optional().nullable(),
  sections: z.array(AiSectionSchema).optional().default([]),
}).passthrough()

export const AiTemplateResponseSchema = z.union([
  z.object({
    activities: z.array(AiActivitySchema),
  }),
  z.array(AiActivitySchema),
])

export function normalizeActivities(raw: any, fallbackDayId?: string): any[] {
  const items = Array.isArray(raw) ? raw : (raw?.activities || [])
  if (!Array.isArray(items)) {
    return []
  }

  return items.map((item: any) => {
    const rawTag = item.tag
    const validTag = VALID_ACTIVITY_TAGS.includes(rawTag) ? rawTag : sanitizeTag(rawTag)
    const startTime = normalizeTimeString(item.startTime)
    const endTime = normalizeTimeString(item.endTime)
    const id = (typeof item.id === 'string' && item.id.trim()) ? item.id : crypto.randomUUID()
    const dayId = item.dayId || fallbackDayId || undefined

    const sections = Array.isArray(item.sections)
      ? item.sections.map((sec: any) => ({
          ...sec,
          id: (typeof sec.id === 'string' && sec.id.trim()) ? sec.id : crypto.randomUUID(),
          type: sec.type || 'description',
          text: typeof sec.text === 'string' ? sec.text : '',
        }))
      : []

    return {
      ...item,
      id,
      dayId,
      startTime,
      endTime,
      title: item.title || 'Активность',
      tag: validTag,
      explanation: item.explanation || undefined,
      sections,
    }
  })
}

function getSystemPrompt(): string {
  return `
You are an expert travel planner and itinerary optimization AI API.
The user wants to modify their daily travel schedule.
You will receive:
1. The CURRENT state of the daily schedule as a JSON array of "activities".
2. The USER'S PROMPT describing what they want to change, add, remove, or re-organize.
3. Optional references (canvas notes, other days context).

Your task is to return the completely UPDATED state of the schedule adhering strictly to the schema and rules below.

### GENERAL RULES:
1. Return ONLY a valid JSON object with the single key "activities", containing an array of activity objects.
2. Keep the exact "id" for existing activities and existing sections so the system can diff changes.
3. If you create a NEW activity or section, generate a standard UUID string for its "id".
4. For every changed or newly created activity, provide an "explanation" string in Russian explaining the reasoning (e.g. "Перенес выезд на 08:30, чтобы успеть к рассвету"). For unchanged activities, leave "explanation" omitted or null.
5. All times ("startTime", "endTime") MUST be strictly in 24-hour "HH:mm" format with 2 digits for hours (e.g. "08:00", "09:30", "00:30", "14:15"). NEVER use single digits for hours (e.g. "8:00" or "0:30" are INVALID, must be "08:00", "00:30").

### "tag" FIELD REQUIREMENTS (CRITICAL):
The "tag" field MUST be EXACTLY one of the following 6 string values in lowercase English:
- "transport" : Car/bus/train/flight transfers, snowmobiles, boats, taxis, highway drives.
- "walk" : Walking tours, hiking, trekking, strolls, park walks.
- "food" : Breakfast, lunch, dinner, cafe, restaurant, culinary tastings, coffee breaks.
- "attraction" : Sights, museums, monuments, waterfalls, beaches, canyons, viewpoints, natural parks, historical points.
- "relax" : Hotel rest, SPA, sauna, bathhouse, sleeping, leisure time.
- "activity" : Active sports, masterclasses, diving, skiing, workshops, tours, excursions.

CRITICAL:
- NEVER invent new tags (e.g. "nature", "photo", "sightseeing", "excursion", "hotel", "tour" are FORBIDDEN).
- NEVER translate tags to Russian (e.g. "достопримечательность", "еда", "транспорт" are FORBIDDEN).
- Use ONLY: "transport" | "walk" | "food" | "attraction" | "relax" | "activity".

### JSON STRUCTURE:
{
  "activities": [
    {
      "id": "uuid string",
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "title": "Activity title in Russian",
      "tag": "transport" | "walk" | "food" | "attraction" | "relax" | "activity",
      "dayId": "uuid string",
      "explanation": "Explanation in Russian",
      "sections": [
        {
          "id": "uuid string",
          "type": "description",
          "text": "Markdown formatted description",
          "isAttached": false,
          "title": "Optional section title"
        }
      ]
    }
  ]
}

If the user asks to add an attached banner/pill/callout to an activity, set "isAttached": true, "title": "...", "type": "description", "text": "...".
`
}

export const templateGenerationService = {
  async generateTemplate(
    userId: string,
    currentActivities: any[],
    prompt: string,
    canvasNote?: string | null,
    daysContext?: Array<{
      dayNumber: number
      date: string
      title: string
      description?: string | null
      activitiesSummary: Array<{ startTime: string, endTime: string, title: string, tag: string }>
    }> | null,
  ) {
    await quotaService.checkLlmCreditQuota(userId)

    let userMessage = `ТЕКУЩЕЕ РАСПИСАНИЕ (JSON):\n${JSON.stringify(currentActivities, null, 2)}\n\nПРОМПТ ПОЛЬЗОВАТЕЛЯ:\n${prompt}`

    if (canvasNote) {
      userMessage = `РЕФЕРЕНС (текст «Полотна» — свободное описание дня пользователем):\n${canvasNote}\n\n${userMessage}`
    }

    if (daysContext && daysContext.length > 0) {
      const contextLines = daysContext.map((d) => {
        const actsSummary = d.activitiesSummary.length > 0
          ? d.activitiesSummary.map(a => `    ${a.startTime}–${a.endTime} [${a.tag}] ${a.title}`).join('\n')
          : '    (пусто)'
        return `  День ${d.dayNumber} (${d.date})${d.title ? ` — «${d.title}»` : ''}:\n${actsSummary}`
      }).join('\n')
      userMessage = `КОНТЕКСТ ПОЕЗДКИ (другие дни, для связанности маршрута — не изменяй их):\n${contextLines}\n\n${userMessage}`
    }

    const prompts: AiRequestPrompts = {
      system: getSystemPrompt(),
      user: userMessage,
    }

    const modelId = DEFAULT_AI_MODEL
    const completion = await createAiChatRequest(prompts, {
      model: modelId,
      response_format: { type: 'json_object' },
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
        operation: 'templateGeneration',
        inputTokens: completion.usage.prompt_tokens,
        outputTokens: completion.usage.completion_tokens,
      })
    }

    const jsonResponse = completion.choices[0]?.message?.content
    if (!jsonResponse) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ не вернул результат.' })
    }

    const customInstructions = `Required Output Structure:
{
  "activities": [
    {
      "id": "uuid string",
      "startTime": "HH:mm (strict 24-hour with 2 digits for hour, e.g. 08:00, 00:30)",
      "endTime": "HH:mm (strict 24-hour with 2 digits for hour, e.g. 09:30, 14:00)",
      "title": "string",
      "tag": "transport" | "walk" | "food" | "attraction" | "relax" | "activity",
      "dayId": "uuid string",
      "explanation": "string in Russian",
      "sections": [
        {
          "id": "uuid string",
          "type": "description",
          "text": "string",
          "isAttached": boolean (optional),
          "title": "string" (optional)
        }
      ]
    }
  ]
}

CRITICAL RULES:
- "tag" MUST be strictly one of: "transport", "walk", "food", "attraction", "relax", "activity". No other words or translations are allowed.
- "startTime" and "endTime" MUST be "HH:mm" with 2 digits for hours (e.g. "08:00", "00:30").`

    const parsedData = await parseJsonWithAiRepair<any>(jsonResponse, {
      userId,
      model: modelId,
      operation: 'templateGeneration',
      maxRetries: 3,
      customInstructions,
      schema: AiTemplateResponseSchema,
      transformOnSuccess: data => normalizeActivities(data),
    })

    const activities = Array.isArray(parsedData) ? parsedData : (parsedData?.activities || [])
    return normalizeActivities(activities)
  },
}
