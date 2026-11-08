import type { AiRequestPrompts } from '~/lib/llm'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { AI_MODELS, createAiChatRequest, DEFAULT_AI_MODEL, parseJsonWithAiRepair } from '~/lib/llm'
import { MemoryProposalSchema } from '~/modules/memory/memory.schemas'
import { llmUsageRepository } from '~/repositories/llm-usage.repository'
import { quotaService } from '~/services/quota.service'

export interface TranscribeMemoryVoiceParams {
  userId: string
  fileBuffer: Buffer
  mimeType?: string
  context?: string
}

function getSystemPrompt(): string {
  return `Ты помогаешь составить и структурировать воспоминания о прошедшем дне путешествия на основе рассказа пользователя (письменного или надиктованного голосом). Верни только JSON {"blocks":[...]}.
Раздели рассказ на осмысленные активности (посещения мест, обеды, события, прогулки) и отдельные заметки (мысли, впечатления, лайфхаки, покупки).
Исправь грамматику, речевые ошибки диктовки, убери повторы и слова-паразиты, сохрани живой голос автора и подлинные факты.

КОНТЕКСТ ДНЯ И МАРШРУТА:
Используй переданный контекст дня (название поездки, запланированные активности, известные названия мест, храмов, кафе, районов и существующие воспоминания), чтобы:
- Правильно распознать и написать названия локаций, достопримечательностей, храмов и блюд, которые упомянул автор.
- Оценить правдоподобное время событий, если автор говорит «утром», «после обеда», «вечером», ориентируясь на таймлайн дня.
- Не дублировать существующие воспоминания. Если пользователь дополняет или исправляет ранее записанное воспоминание, используй type=description с его targetId и верни полное итоговое описание с сохранением фактов.

КРИТИЧЕСКИ ВАЖНОЕ ПРАВИЛО:
НЕ ВЫДУМЫВАЙ событий, покупок, мест или впечатлений, которых автор НЕ упоминал в своём рассказе! Запланированные активности из контекста — это только ориентир маршрута. Если автор НЕ рассказал о посещении какого-то запланированного места, НЕ создавай о нём блок!

Новые блоки:
- type: 'activity' (событие/активность) или 'note' (мысль, впечатление, список вещей)
- targetId: null для новых блоков (ID воспоминания только для type='description')
- title: ёмкое название для активности (пустая строка у заметки)
- comment: непустой связный готовый текст блока
- time: время (HH:mm)
- timeEstimated: true, если точное время не было названо автором
- tag: activity | transport | walk | food | attraction | relax

Неизвестное время оцени для логического порядка событий и пометь timeEstimated=true.
Описание существующего блока (type=description) сохраняет его время.
Максимум 30 блоков. Пиши на языке рассказа пользователя.`
}

export const memoryGenerationService = {
  async generate(userId: string, text: string, context: string) {
    await quotaService.checkLlmCreditQuota(userId)

    const prompts: AiRequestPrompts = {
      system: getSystemPrompt(),
      user: `Контекст дня и маршрута:\n${context}\n\nРассказ путешественника:\n${text}`,
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
        operation: 'memoryGeneration',
        inputTokens: completion.usage.prompt_tokens,
        outputTokens: completion.usage.completion_tokens,
      })
    }

    const jsonResponse = completion.choices[0]?.message?.content
    if (!jsonResponse) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ не вернул результат.' })
    }

    const parsedData = await parseJsonWithAiRepair(jsonResponse, {
      userId,
      model: modelId,
      operation: 'memoryGeneration',
      customInstructions: 'Верни JSON с массивом blocks по схеме воспоминаний.',
      schema: MemoryProposalSchema,
    })

    return parsedData
  },

  async transcribeVoiceNote({
    userId,
    fileBuffer,
    mimeType,
    context,
  }: TranscribeMemoryVoiceParams): Promise<{ text: string }> {
    await quotaService.checkLlmCreditQuota(userId)

    const resolvedMime = mimeType || 'audio/webm'
    const contextPrompt = context
      ? `Контекст поездки и дня: ${context}. Учитывай географические названия, имена храмов, станций и блюд этого региона.\n`
      : ''

    const prompts: AiRequestPrompts = {
      system: `Ты — точный ассистент распознавания устной речи в путешествиях. ${contextPrompt}Расшифруй аудиозапись пользователя дословно на языке рассказа (в основном русский, с возможными иностранными названиями достопримечательностей, улиц, кафе и блюд). Не добавляй комментариев от себя. Ответь ТОЛЬКО в формате JSON: { "text": "расшифрованный текст" }.`,
      user: [
        {
          type: 'text',
          text: 'Расшифруй это аудиосообщение о дне поездки в текст. Верни JSON: { "text": "..." }',
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:${resolvedMime};base64,${fileBuffer.toString('base64')}`,
          },
        },
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
        operation: 'memoryVoiceTranscribe',
        inputTokens: completion.usage.prompt_tokens,
        outputTokens: completion.usage.completion_tokens,
      })
    }

    const raw = completion.choices[0]?.message?.content || '{}'
    const parsed = await parseJsonWithAiRepair<{ text: string }>(raw, {
      userId,
      model: modelId,
      operation: 'memoryVoiceTranscribe',
      schema: z.object({ text: z.string() }),
    })

    return { text: parsed.text.trim() }
  },
}
