import type { AiRequestPrompts } from '~/lib/llm'
import { TRPCError } from '@trpc/server'
import { createAiChatRequest } from '~/lib/llm'
import { llmUsageRepository } from '~/repositories/llm-usage.repository'
import { quotaService } from '~/services/quota.service'

function getSystemPrompt(): string {
  return `
You are an expert travel planner API. 
The user wants to modify their daily schedule. 
You will receive the CURRENT state of the schedule as a JSON array of "activities".
You will also receive the USER'S PROMPT describing what they want to change, add, or analyze.
Your task is to return the completely UPDATED state of the schedule.
Keep the same JSON structure. Do not invent new fields. Keep the exact IDs for existing items so the system can diff them. 
If you add a new activity, generate a new UUID for its "id".

CRITICAL: The activities MUST adhere to the following JSON structure:
{
  "id": "uuid string",
  "startTime": "HH:mm",
  "endTime": "HH:mm",
  "title": "Activity title",
  "tag": "transport" | "walk" | "food" | "attraction" | "relax" | "activity",
  "dayId": "uuid string",
  "explanation": "Short string explaining why the AI made this change or created this activity",
  "sections": [
    {
      "id": "uuid string",
      "type": "description",
      "text": "Detailed text or description",
      "isAttached": boolean (optional),
      "title": "Title for this block" (optional)
    }
  ]
}

If the user asks to add an "attached-pill titled-pin", you can do so by adding a section to the activity with "isAttached": true, "title": "...", "type": "description", "text": "...".
For every changed or newly created activity, you MUST provide an "explanation" string in Russian explaining the reasoning (e.g. "Сдвинул на 30 минут позже, так как музей открывается в 10:00"). If you didn't change the activity, you can leave it empty or omit it.

You MUST return ONLY a valid JSON object with a single key "activities", which contains the updated array of activity objects.
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


    const modelId = 'gemini-3.5-flash'
    const completion = await createAiChatRequest(prompts, {
      model: modelId,
      response_format: { type: 'json_object' },
    })

    if (completion.usage) {
      await quotaService.deductLlmCredits(
        userId,
        modelId,
        completion.usage.prompt_tokens,
        completion.usage.completion_tokens,
      )

      await llmUsageRepository.create({
        userId,
        model: modelId,
        operation: 'templateGeneration',
        inputTokens: completion.usage.prompt_tokens,
        outputTokens: completion.usage.completion_tokens,
      })
    }

    const jsonResponse = completion.choices[0].message.content
    if (!jsonResponse) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ не вернул результат.' })
    }

    try {
      const parsedData = JSON.parse(jsonResponse)
      return parsedData.activities || parsedData
    }
    catch (e) {
      console.error('Failed to parse JSON from AI:', jsonResponse, e)
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ вернул невалидный JSON.' })
    }
  },
}
