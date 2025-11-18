import type { AiRequestPrompts } from '~/lib/llm'
import { TRPCError } from '@trpc/server'
import { createAiChatRequest } from '~/lib/llm'
import { llmUsageRepository } from '~/repositories/llm-usage.repository'
import { quotaService } from '~/services/quota.service'

interface GenerateFinancesParams {
  userId: string
  fileBuffer?: Buffer
  fileName?: string
  text?: string | null
  notes?: string | null
}

interface GeneratedTransaction {
  title: string
  amount: number
  currency: string
  categorySuggestion?: string
  date?: string // YYYY-MM-DD
  notes?: string
}

function getSystemPrompt(): string {
  return `
You are an expert financial assistant. Your task is to extract transactions from user input (which can be text, an image of a receipt, or both) and return them as a structured JSON array.

RULES:
1.  **Respond ONLY with a valid JSON array.** Do not include any explanatory text, markdown formatting, or anything outside of the JSON array.
2.  The JSON response must be an array of transaction objects, even if only one transaction is found. An empty array \`[]\` should be returned if no transactions are found.
3.  If a value is not found, omit the key or set it to null. Do not invent data.
4.  \`amount\` must always be a positive number. Extract the total amount from receipts.
5.  Infer the \`currency\` from context (e.g., 'руб', 'р.', '$', 'долларов', 'EUR' -> 'RUB', 'USD', 'EUR'). If not specified, default to 'RUB'.
6.  \`title\` should be a concise description of the expense (e.g., "Обед в кафе", "Билеты в кино", "Продукты в супермаркете"). If analyzing a receipt, use the merchant's name as the title.
7.  If possible, suggest a \`categorySuggestion\` from this list: 'Еда и напитки', 'Транспорт', 'Авиабилеты', 'Жильё', 'Развлечения', 'Покупки', 'Прочее'.
8.  **Crucially, always include the 'date' field in 'YYYY-MM-DD' format if it can be determined from the text or receipt.** If the user mentions "вчера" or "сегодня", calculate it based on the current date: ${new Date().toISOString().split('T')[0]}. If no date information is available at all, you may omit the 'date' key.

Here is the required structure for each object in the array:
[
  {
    "title": "string",
    "amount": number,
    "currency": "string (e.g., RUB, USD, EUR)",
    "categorySuggestion": "string (optional)",
    "date": "YYYY-MM-DD",
    "notes": "string (optional, any extra details from the receipt like individual items)"
  }
]
`
}

function getUserPrompt(text: string | null, notes: string | null): AiRequestPrompts['user'] {
  const parts: AiRequestPrompts['user'] = []

  let mainInstruction = 'Analyze the provided data and extract all financial transactions.'
  if (text) {
    mainInstruction += `\n\nUSER TEXT:\n---\n${text}\n---`
  }
  if (notes) {
    mainInstruction += `\n\nADDITIONAL NOTES:\n---\n${notes}\n---`
  }
  mainInstruction += '\n\nNow, provide the JSON array response based on the system instructions.'

  parts.push({ type: 'text', text: mainInstruction })

  return parts
}

async function generateTransactionsFromData({ userId, fileBuffer, fileName, text, notes }: GenerateFinancesParams): Promise<GeneratedTransaction[]> {
  await quotaService.checkLlmCreditQuota(userId)

  const prompts: AiRequestPrompts = {
    system: getSystemPrompt(),
    user: getUserPrompt(text!, notes!),
  }

  const isImage = fileName && /\.(?:png|jpg|jpeg)$/i.test(fileName)

  if (isImage && fileBuffer) {
    if (!Array.isArray(prompts.user)) {
      prompts.user = [{ type: 'text', text: prompts.user as string }]
    }
    (prompts.user as any[]).push({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${fileBuffer.toString('base64')}`,
      },
    })
  }
  else if (!text) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'No text or valid image provided for analysis.' })
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
      operation: 'financesGeneration',
      inputTokens: completion.usage.prompt_tokens,
      outputTokens: completion.usage.completion_tokens,
    })
  }

  const jsonResponse = completion.choices[0].message.content
  if (!jsonResponse) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ не вернул результат.' })
  }

  try {
    const cleanedResponse = jsonResponse.replace(/```json|```/g, '').trim()
    const parsedData = JSON.parse(cleanedResponse)

    if (Array.isArray(parsedData)) {
      return parsedData
    }

    const arrayKey = Object.keys(parsedData).find(key => Array.isArray(parsedData[key]))
    if (arrayKey) {
      return parsedData[arrayKey]
    }

    throw new Error('The parsed JSON is not an array and does not contain an array.')
  }
  catch (e) {
    console.error('Failed to parse JSON array from AI response:', jsonResponse, e)
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ вернул невалидный JSON.' })
  }
}

export const financesGenerationService = {
  generateTransactionsFromData,
}
