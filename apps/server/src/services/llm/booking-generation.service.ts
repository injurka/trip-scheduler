import type { AiRequestPrompts } from '~/lib/llm'
import { TRPCError } from '@trpc/server'
import { PDFParse } from 'pdf-parse'
import { createAiChatRequest } from '~/lib/llm'
import { llmUsageRepository } from '~/repositories/llm-usage.repository'
import { quotaService } from '~/services/quota.service'

interface GenerateBookingParams {
  userId: string
  fileBuffer: Buffer
  fileName: string
  bookingType: string
  notes: string | null
}

function getSystemPrompt(bookingType: string): string {
  const baseInstruction = `
You are an intelligent assistant that extracts structured data from travel documents.
Your task is to populate a JSON object based on the schema for the booking type: "${bookingType}".

RULES:
1. Respond ONLY with a valid JSON object. Do not include any explanatory text, markdown formatting, or anything else outside of the JSON.
2. If a value is not found in the text, omit the key or set it to null. Do not invent data.
3. Pay close attention to dates and times. Format dates as "YYYY-MM-DD" and datetimes as "YYYY-MM-DDTHH:mm:ss".
4. Timezone Inference: For "departureTimeZone" and "arrivalTimeZone", if the timezone is not explicitly stated in the document, you MUST infer it from the provided city or station names (e.g., "departureStation", "arrivalStation"). Determine the location and find its standard UTC offset. For all locations within mainland China, the timezone is UTC+8.
5. For flights, extract all segments if it's a multi-leg journey.

Here is the schema you must follow:
`

  let schema = ''
  switch (bookingType) {
    case 'flight':
      schema = `{
              "type": "flight",
              "title": "A short, descriptive title, e.g., 'Flight to Tokyo'",
              "data": {
                "bookingReference": "string",
                "notes": "string",
                "sourceUrl": "URL to the booking source, if available",
                "segments": [{
                  "departureCity": "string", "arrivalCity": "string",
                  "departureAirport": "IATA code", "arrivalAirport": "IATA code",
                  "departureDateTime": "YYYY-MM-DDTHH:mm:ss", "arrivalDateTime": "YYYY-MM-DDTHH:mm:ss",
                  "departureTimeZone": "+-HH:mm", "arrivalTimeZone": "+-HH:mm",
                  "flightNumber": "string", "airline": "string", "airlineIataCode": "string",
                  "aircraft": "string",
                  "terminalDeparture": "string",
                  "terminalArrival": "string"
                }]
              }
            }`
      break
    case 'hotel':
      schema = `{
              "type": "hotel",
              "title": "A short, descriptive title, e.g., 'Hotel in Paris'",
              "data": {
                "hotelName": "string", "address": "string",
                "checkInDate": "YYYY-MM-DD", "checkOutDate": "YYYY-MM-DD",
                "confirmationNumber": "string", "phone": "string", "email": "string",
                "roomType": "string",
                "guests": "string (e.g., '2 adults')",
                "website": "string (hotel's official website)",
                "notes": "string",
                "sourceUrl": "URL to the booking source, if available"
              }
            }`
      break
    case 'train':
      schema = `{
              "type": "train",
              "title": "A short, descriptive title, e.g., 'Train to Saint Petersburg'",
              "data": {
                "departureStation": "string", "arrivalStation": "string",
                "departureDateTime": "YYYY-MM-DDTHH:mm:ss", "arrivalDateTime": "YYYY-MM-DDTHH:mm:ss",
                "departureTimeZone": "+-HH:mm", "arrivalTimeZone": "+-HH:mm",
                "trainNumber": "string", "carriage": "string", "seat": "string",
                "departurePlatform": "string",
                "arrivalPlatform": "string",
                "bookingReference": "string",
                "notes": "string",
                "sourceUrl": "URL to the booking source, if available"
              }
            }`
      break
    case 'attraction':
      schema = `{
              "type": "attraction",
              "title": "A short, descriptive title, e.g., 'Louvre Museum Ticket'",
              "data": {
                "attractionName": "string", "address": "string",
                "dateTime": "YYYY-MM-DDTHH:mm:ss", "bookingReference": "string",
                "ticketType": "string (e.g., 'Adult', 'General Admission')",
                "guests": "string (e.g., '2 people')",
                "notes": "string",
                "sourceUrl": "URL to the booking source, if available"
              }
            }`
      break
    default:
      throw new Error('Unsupported booking type for prompt generation.')
  }

  return `${baseInstruction}\n${schema}`
}

function getUserPrompt(content: string, notes: string | null): string {
  return `
Analyze the provided text content extracted from a document and the user's notes.

DOCUMENT CONTENT:
---
${content}
---

USER NOTES:
---
${notes || 'No additional notes.'}
---

Now, provide the JSON response based on the system instructions.
`
}

async function generateBookingFromFile({ userId, fileBuffer, fileName, bookingType, notes }: GenerateBookingParams) {
  await quotaService.checkLlmCreditQuota(userId)

  const prompts: AiRequestPrompts = {
    system: getSystemPrompt(bookingType),
    user: '',
  }

  const isImage = /\.(?:png|jpg|jpeg)$/i.test(fileName)

  if (isImage) {
    const userText = getUserPrompt('Image data is provided. Analyze it.', notes)
    prompts.user = [
      { type: 'text', text: userText },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${fileBuffer.toString('base64')}`,
        },
      },
    ]
  }
  else if (fileName.toLowerCase().endsWith('.pdf')) {
    const parser = new PDFParse({ data: fileBuffer })
    try {
      const data = await parser.getText()
      prompts.user = getUserPrompt(data.text, notes)
    }
    catch (error) {
      console.error('PDF parsing failed:', error)
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to parse the PDF file.' })
    }
    finally {
      await parser.destroy()
    }
  }
  else {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Неподдерживаемый тип файла. Поддерживаются PDF, PNG, JPG.' })
  }

  const modelId = 'gemini-2.5-pro'
  const completion = await createAiChatRequest(prompts, {
    model: modelId,
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
      operation: 'bookingGeneration',
      inputTokens: completion.usage.prompt_tokens,
      outputTokens: completion.usage.completion_tokens,
    })
  }

  const jsonResponse = completion.choices[0].message.content
  if (!jsonResponse)
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ не вернул результат.' })

  try {
    const parsedData = JSON.parse(jsonResponse)
    return parsedData
  }
  catch (e) {
    console.error('Failed to parse JSON from AI:', jsonResponse, e)
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ вернул невалидный JSON.' })
  }
}

export const bookingGenerationService = {
  generateBookingFromFile,
}
