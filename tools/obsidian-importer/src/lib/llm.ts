import type { ActivityPayload } from '../types'
import process from 'node:process'
import { DEFAULT_AIHUBMIX_MODEL } from '../config/constants'
import { dedentText } from '../parsers/activity'

export function mergeLlmActivitiesWithRawMarkdown(
  llmActs: ActivityPayload[],
  rawActs: ActivityPayload[],
): ActivityPayload[] {
  const merged: ActivityPayload[] = []

  for (let i = 0; i < rawActs.length; i++) {
    const raw = rawActs[i]
    const matchedLlm = llmActs.find((llm) => {
      if (llm.startTime === raw.startTime)
        return true
      const rawNorm = raw.title.toLowerCase()
      const llmNorm = llm.title.toLowerCase()
      return rawNorm.includes(llmNorm.slice(0, 10)) || llmNorm.includes(rawNorm.slice(0, 10))
    }) || llmActs[i]

    if (matchedLlm) {
      merged.push({
        ...raw,
        tag: matchedLlm.tag || raw.tag,
        sections: raw.sections && raw.sections.length > 0 ? raw.sections : matchedLlm.sections,
      })
    }
    else {
      merged.push(raw)
    }
  }

  for (const llm of llmActs) {
    const isAlreadyMatched = merged.some(m => m.startTime === llm.startTime || (m.title.toLowerCase().includes(llm.title.toLowerCase().slice(0, 10))))
    if (!isAlreadyMatched) {
      merged.push(llm)
    }
  }

  return merged.sort((a, b) => a.startTime.localeCompare(b.startTime))
}

export async function generateActivitiesViaDirectLlm(
  canvasNote: string,
  modelName: string = DEFAULT_AIHUBMIX_MODEL,
): Promise<ActivityPayload[] | null> {
  const apiKey = process.env.AI_HUBMIX_KEY || process.env.OPENAI_API_KEY
  if (!apiKey)
    return null

  const isHubMix = !!process.env.AI_HUBMIX_KEY
  const baseUrl = isHubMix
    ? 'https://aihubmix.com/v1/chat/completions'
    : (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions')

  const targetModel = modelName || DEFAULT_AIHUBMIX_MODEL

  const systemPrompt = `You are an expert travel planner assistant.
Your task is to parse a detailed day markdown schedule for a trip into a structured JSON array of activity objects.

Requirements for the output JSON schema:
Return a JSON array of objects with the following schema:
[
  {
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "title": "Clear concise activity title",
    "tag": "transport" | "walk" | "food" | "attraction" | "relax" | "activity",
    "sections": [
      {
        "type": "description",
        "text": "Detailed description in Russian. Preserve all important logistics, tips, instructions, and context."
      }
    ]
  }
]

IMPORTANT Guidelines:
1. Every activity MUST have valid startTime and endTime in 24-hour "HH:MM" format.
2. If time in source is "10:00 - 12:30", startTime is "10:00", endTime is "12:30".
3. Assign appropriate tag:
   - "transport" for flights, trains, subway, metro, taxi, transfers, car rides.
   - "food" for breakfast, lunch, dinner, night markets, snacks, cafes, tasting.
   - "walk" for walking tours, hiking, strolling parks, trails.
   - "attraction" for sightseeing, temples, museums, observation decks, landmarks.
   - "relax" for hotel check-in, onsen, swimming, rest, chill.
   - "activity" for workshops, experiences, shows.
4. Keep the output ONLY as pure JSON array without markdown backticks or commentary.`

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: targetModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Day note content:\n\n${canvasNote}` },
      ],
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`LLM Error ${response.status}: ${errText}`)
  }

  const result = (await response.json()) as any
  const content = result.choices?.[0]?.message?.content
  if (!content)
    return null

  let cleanJson = content.trim()
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.replace(/^```json\n?/, '').replace(/\n?```$/, '')
  }
  else if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```\n?/, '').replace(/\n?```$/, '')
  }

  try {
    const parsed = JSON.parse(cleanJson)
    if (Array.isArray(parsed)) {
      return parsed.map(item => ({
        id: crypto.randomUUID(),
        startTime: item.startTime || '09:00',
        endTime: item.endTime || '10:00',
        title: item.title || 'Активность',
        tag: ['transport', 'walk', 'food', 'attraction', 'relax', 'activity'].includes(item.tag) ? item.tag : 'activity',
        sections: Array.isArray(item.sections)
          ? item.sections.map((s: any) => ({
              id: crypto.randomUUID(),
              type: s.type || 'description',
              text: typeof s.text === 'string' ? dedentText(s.text) : '',
            }))
          : (item.text ? [{ id: crypto.randomUUID(), type: 'description', text: dedentText(item.text) }] : []),
      }))
    }
  }
  catch {
    // JSON parse error
  }

  return null
}
