import type { AiRequestPrompts } from '~/lib/llm'
import { TRPCError } from '@trpc/server'
import { createAiChatRequest } from '~/lib/llm'
import { llmUsageRepository } from '~/repositories/llm-usage.repository'
import { quotaService } from '~/services/quota.service'

function getSystemPrompt(): string {
  return `
You are an expert travel planner and assistant.
Your task is to help the user write their travel plan in Markdown format for a specific day.
The user will give you a prompt with their request.
You might also receive the context of other days of the trip to avoid repetitions or to keep the flow.
Please generate ONLY the markdown text for the day's plan based on the prompt.
Use engaging language, emojis, and clear markdown formatting (lists, headers, bold text).
DO NOT wrap the entire response in markdown code blocks (\`\`\`markdown ... \`\`\`), just output the raw markdown text.
`
}

export const canvasGenerationService = {
  async generateDayNote(userId: string, prompt: string, context?: string) {
    await quotaService.checkLlmCreditQuota(userId)

    const userMessage = context 
      ? `Контекст поездки (другие дни):\n${context}\n\nЗапрос пользователя:\n${prompt}`
      : `Запрос пользователя:\n${prompt}`

    const prompts: AiRequestPrompts = {
      system: getSystemPrompt(),
      user: userMessage,
    }

    const modelId = 'gemini-3.5-flash'
    const completion = await createAiChatRequest(prompts, {
      model: modelId,
      response_format: { type: 'text' },
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
        operation: 'canvasGeneration',
        inputTokens: completion.usage.prompt_tokens,
        outputTokens: completion.usage.completion_tokens,
      })
    }

    const textResponse = completion.choices[0].message.content
    if (!textResponse) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ не вернул результат.' })
    }

    return textResponse.trim()
  },
}
