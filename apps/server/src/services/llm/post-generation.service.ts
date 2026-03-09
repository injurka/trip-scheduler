import type { AiRequestPrompts } from '~/lib/llm'
import { TRPCError } from '@trpc/server'
import { createAiChatRequest } from '~/lib/llm'
import { llmUsageRepository } from '~/repositories/llm-usage.repository'
import { quotaService } from '~/services/quota.service'

function getSystemPrompt(): string {
  return `
You are an expert travel blogger and an intelligent content assistant. 
Your task is to analyze a user's unstructured raw text about their trip/moment and generate a highly structured, engaging JSON object to prepopulate a travel post editor.

CRITICAL RULES:
1. Respond ONLY with a valid JSON object. Do not include any explanatory text or markdown formatting outside the JSON block.
2. DO NOT output \`null\` values. If a field's value is unknown or inapplicable, simply OMIT the key entirely from the JSON object.
3. Be creative: if the user provides brief text, expand it slightly into an engaging travel blog tone for 'title', 'insight', and 'description'.
4. Break down the user's narrative into logical chronological 'stages' (e.g., "Morning walk", "Lunch", "Museum visit", or specific days).
5. Extract ANY mentioned places into 'location' blocks, and ANY movements/transfers into 'route' blocks.
6. For 'transport' in route blocks, strictly use one of: "walk", "transit", "car".
7. Make approximate guesses for distance/duration if context allows, otherwise omit them.

EXACT JSON SCHEMA TO FOLLOW:
{
  "title": "Catchy, engaging title for the post (string)",
  "insight": "A short, valuable piece of advice or key takeaway from the trip (string)",
  "description": "General engaging intro for the post (string)",
  "country": "Country name in Russian (e.g., 'Россия', 'Италия') (string)",
  "tags": ["tag1", "tag2"], // Array of relevant strings (lowercase, without #)
  "stages": [
    {
      "title": "Stage title (e.g., 'Утро на набережной')",
      "day": 1, // Number of the trip day
      "time": "10:00", // Approximate time in HH:mm format (if possible)
      "blocks": [
        // Create an array of blocks representing the narrative. Valid block types:
        { "type": "text", "content": "Detailed engaging text about this part of the trip (markdown supported)" },
        { "type": "location", "name": "Place name (e.g., 'Эйфелева башня')", "address": "Address if known", "coords": { "lat": 48.858, "lng": 2.294 } },
        { "type": "route", "from": "Start point", "to": "End point", "transport": "walk", "distance": "approx distance (e.g. '2 км')", "duration": "approx duration (e.g. '30 мин')" }
      ]
    }
  ]
}
`
}

export const postGenerationService = {
  async generateFromText(userId: string, text: string) {
    await quotaService.checkLlmCreditQuota(userId)

    const prompts: AiRequestPrompts = {
      system: getSystemPrompt(),
      user: `Analyze the following trip description and generate the rich JSON structure:\n\n---\n${text}\n---`,
    }

    const modelId = 'gemini-2.5-pro'
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
        operation: 'postGeneration',
        inputTokens: completion.usage.prompt_tokens,
        outputTokens: completion.usage.completion_tokens,
      })
    }

    const jsonResponse = completion.choices[0].message.content
    if (!jsonResponse) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ не вернул результат.' })
    }

    try {
      // eslint-disable-next-line e18e/prefer-static-regex
      const cleanedResponse = jsonResponse.replace(/```json|```/g, '').trim()
      const parsedData = JSON.parse(cleanedResponse)
      return parsedData
    }
    catch (e) {
      console.error('Failed to parse JSON from AI:', jsonResponse, e)
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ вернул невалидный JSON.' })
    }
  },
}
