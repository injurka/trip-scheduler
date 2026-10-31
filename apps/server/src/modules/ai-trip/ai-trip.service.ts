import type {
  AiTripConceptProposal,
  AiTripUserPin,
  ApprovedAiTripConcept,
  GenerateAiTripInput,
  GeneratedFile,
  ProposeAiTripConceptInput,
} from './ai-trip.schemas'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  importTripFolderCore,
  parseActivitiesFromMarkdown,
  parseTripFrontmatter,
} from '@limiteddissolve/obsidian-importer'
import { TRPCError } from '@trpc/server'
import { AI_MODELS, createAiChatRequest, DEFAULT_AI_MODEL, parseJsonWithAiRepair } from '~/lib/llm'
import { geoService } from '~/modules/geo/geo.service'
import { geoRepository } from '~/repositories/geo.repository'
import { llmUsageRepository } from '~/repositories/llm-usage.repository'
import { quotaService } from '~/services/quota.service'
import {
  AiTripConceptProposalSchema,
  GeneratedFilesChunkSchema,
} from './ai-trip.schemas'
import { createInProcessTransport } from './in-process.transport'

export * from './ai-trip.schemas'

export type AiTripJobStatus = 'pending' | 'generating' | 'importing' | 'done' | 'needs_input' | 'error'

export interface AiTripJob {
  id: string
  userId: string
  status: AiTripJobStatus
  stage: string
  logs: string[]
  tripId: string | null
  error: string | null
  createdAt: number
  progress: number | null
  attempt: number
  attemptsTotal: number
}

interface TokenUsage {
  promptTokens: number
  completionTokens: number
  model: string
}

const jobs = new Map<string, AiTripJob>()
const skillFileCache = new Map<string, string>()

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SKILLS_SOURCE_DIR = join(__dirname, '../../../../../tools/skills-installer/source/skills')

const MAX_CHUNK_ATTEMPTS = 3
const DAILY_BATCH_SIZE = 3

/** Структурные папки верхнего уровня вольта — обёрткой считаться не должны. */
const KNOWN_TOP_LEVEL_DIRS = new Set([
  '02 - Маршрутный план',
  '03 - Бронирования',
  '04 - Финансы',
  '05 - Полезная информация',
  '06 - Чек лист',
  '_',
  'attachments',
])

function setJob(id: string, patch: Partial<AiTripJob>) {
  const job = jobs.get(id)
  if (job) {
    Object.assign(job, patch)
  }
}

function getJob(jobId: string, userId: string): AiTripJob | null {
  const job = jobs.get(jobId)
  if (!job || job.userId !== userId)
    return null
  return job
}

function readSkillFile(...segments: string[]): string {
  const key = segments.join('/')
  if (skillFileCache.has(key))
    return skillFileCache.get(key)!

  const path = join(SKILLS_SOURCE_DIR, ...segments)
  const content = existsSync(path) ? readFileSync(path, 'utf-8') : ''
  skillFileCache.set(key, content)
  return content
}

function resolveModelName(rawModel?: string): string {
  if (!rawModel)
    return DEFAULT_AI_MODEL
  return (AI_MODELS as readonly string[]).find(m => rawModel.includes(m) || m.includes(rawModel)) || DEFAULT_AI_MODEL
}

async function recordUsage(userId: string, usage: TokenUsage | null, operation: string) {
  if (!usage || (usage.promptTokens <= 0 && usage.completionTokens <= 0))
    return

  await quotaService.deductLlmCredits(
    userId,
    usage.model,
    usage.promptTokens,
    usage.completionTokens,
  )
  await llmUsageRepository.create({
    userId,
    model: usage.model,
    operation,
    inputTokens: usage.promptTokens,
    outputTokens: usage.completionTokens,
  })
}

function formatDateIso(dateInput: Date | string): string {
  return new Date(dateInput).toISOString().split('T')[0]
}

function addDaysIso(startIso: string, offsetDays: number): { iso: string, weekdayShort: string } {
  const base = new Date(`${startIso}T00:00:00.000Z`)
  base.setUTCDate(base.getUTCDate() + offsetDays)
  const iso = base.toISOString().split('T')[0]
  const weekdayShort = base.toLocaleDateString('ru-RU', { weekday: 'short', timeZone: 'UTC' })
  return { iso, weekdayShort }
}

function formatPinnedItemsBlock(pins?: AiTripUserPin[]): string {
  if (!pins || pins.length === 0)
    return ''

  const grouped = {
    hotel: pins.filter(p => p.type === 'hotel'),
    place: pins.filter(p => p.type === 'place'),
    logistics: pins.filter(p => p.type === 'logistics'),
  }

  const lines: string[] = ['## 📌 ЖЁСТКИЕ ПРИВЯЗКИ ОТ ПОЛЬЗОВАТЕЛЯ (ОБЯЗАТЕЛЬНО ВКЛЮЧИТЬ В МАРШРУТ)']
  if (grouped.hotel.length > 0) {
    lines.push('### Желаемые / забронированные отели:')
    for (const h of grouped.hotel) {
      lines.push(`- ${h.title}${h.note ? ` (${h.note})` : ''}`)
    }
  }
  if (grouped.place.length > 0) {
    lines.push('### Обязательные места и активности:')
    for (const p of grouped.place) {
      lines.push(`- ${p.title}${p.note ? ` (${p.note})` : ''}`)
    }
  }
  if (grouped.logistics.length > 0) {
    lines.push('### Известные рейсы / переезды / логистика:')
    for (const l of grouped.logistics) {
      lines.push(`- ${l.title}${l.note ? ` (${l.note})` : ''}`)
    }
  }

  return lines.join('\n')
}

// ─── 1. ПРОЕКТИРОВАНИЕ КОНЦЕПЦИИ (ИНТЕРАКТИВНЫЙ CO-PILOT) ───────────────────

function buildConceptSystemPrompt(input: ProposeAiTripConceptInput, feedback?: string): string {
  const startIso = formatDateIso(input.startDate)
  const { weekdayShort } = addDaysIso(startIso, 0)
  const endInfo = addDaysIso(startIso, input.days - 1)
  const pinsBlock = formatPinnedItemsBlock(input.pinnedItems)

  const refinementBlock: string[] = []
  if (input.previousConcept) {
    refinementBlock.push(
      '## 🔄 РЕЖИМ ДОРАБОТКИ ПРЕДЫДУЩЕЙ КОНЦЕПЦИИ',
      `Предыдущее название: ${input.previousConcept.title}`,
      `Предыдущие города: ${input.previousConcept.cities.map(c => `${c.name} (${c.nights} н.)`).join(' → ')}`,
      `Уже одобренные места (сохрани подходящие): ${input.previousConcept.places.map(p => p.name).join(', ')}`,
      `Уже одобренные отели (сохрани подходящие): ${input.previousConcept.hotels.map(h => `${h.name} (${h.city})`).join(', ')}`,
    )
  }
  if (input.excludedPlaceNames && input.excludedPlaceNames.length > 0) {
    refinementBlock.push(
      '## 🚫 ЧЁРНЫЙ СПИСОК МЕСТ (СТРОГО ИСКЛЮЧИТЬ — ПОЛЬЗОВАТЕЛЬ ОТКЛОНИЛ ИХ)',
      ...input.excludedPlaceNames.map(name => `- НЕ предлагать и НЕ включать: ${name}`),
    )
  }
  if (input.refinementFeedback) {
    refinementBlock.push(
      '## 💬 ПРАВКИ ПОЛЬЗОВАТЕЛЯ К КОНЦЕПЦИИ (ВЫПОЛНИ В ПЕРВУЮ ОЧЕРЕДЬ)',
      input.refinementFeedback,
    )
  }

  const targetPlacesCount = Math.min(16, Math.max(6, input.days * 2))

  return [
    'Ты — ведущий тревел-архитектор. Спроектируй продуманную, реалистичную концепцию путешествия для согласования с путешественником перед детальной генерацией.',
    '',
    '## ВХОДНЫЕ ПАРАМЕТРЫ',
    `- Направление: ${input.country}`,
    `- Даты: ${startIso} (${weekdayShort}) — ${endInfo.iso} (${endInfo.weekdayShort}), длительность: РОВНО ${input.days} дн.`,
    input.wishes ? `- Пожелания путешественника: ${input.wishes}` : '- Пожелания: сбалансированный классический маршрут без спешки.',
    pinsBlock ? `\n${pinsBlock}` : '',
    refinementBlock.length > 0 ? `\n${refinementBlock.join('\n')}` : '',
    '',
    '## ПРАВИЛА ПРОЕКТИРОВАНИЯ',
    '1. Маршрут по городам (`cities`) должен быть географически логичным, без лишних челночных переездов. Названия городов указывай реальными населёнными пунктами на русском языке (например: "Токио", "Киото", "Стамбул").',
    `2. Предложи около ${targetPlacesCount} ярких, проверенных мест/впечатлений (\`places\`) по маршруту (достопримечательности, природа, гастрономия, культура, отдых). Если пользователь указал свои места — обязательно включи их с \`"isUserPinned": true\`.`,
    '3. Для каждого базового города предложи по 2 реальных, хорошо расположенных отеля (`hotels`) разных уровней (например, comfort и budget/boutique) с адекватной ценой за ночь в рублях (`pricePerNightRub`). Если пользователь указал свои отели — обязательно включи их с `"isUserPinned": true`.',
    `4. В \`daysOutline\` распиши РОВНО ${input.days} дней (с \`dayNumber\` от 1 до ${input.days} без пропусков): укажи основной город дня, ёмкий заголовок дня и 3–4 ключевых хайлайта.`,
    '5. Оцени реалистичный ориентировочный бюджет поездки на 1 человека в рублях (`estimatedBudgetRub`).',
    '',
    '## СТРОГАЯ JSON-СХЕМА ОТВЕТА',
    'Верни ТОЛЬКО валидный JSON-объект без markdown-ограждений:',
    JSON.stringify({
      title: 'Название путешествия',
      summary: 'Краткое описание концепции маршрута (2-3 предложения)',
      estimatedBudgetRub: 145000,
      cities: [
        { name: 'Город', nights: 3, role: 'Роль города в маршруте' },
      ],
      places: [
        {
          id: 'p1',
          name: 'Название места или гастро-локации',
          city: 'Город',
          category: 'attraction',
          whyVisit: 'Почему стоит посетить (1 короткое предложение)',
          isUserPinned: false,
        },
      ],
      hotels: [
        {
          id: 'h1',
          name: 'Название отеля',
          city: 'Город',
          area: 'Район',
          pricePerNightRub: 9500,
          tier: 'comfort',
          whyStay: 'Чем удобен район и отель',
          isUserPinned: false,
        },
      ],
      daysOutline: [
        {
          dayNumber: 1,
          city: 'Город',
          title: 'Тема дня',
          highlights: ['Хайлайт 1', 'Хайлайт 2', 'Хайлайт 3'],
        },
      ],
    }, null, 2),
    'Допустимые значения `category`: "attraction" | "nature" | "food" | "culture" | "relax".',
    'Допустимые значения `tier`: "budget" | "comfort" | "boutique".',
    feedback ? `\n## ⚠️ ИСПРАВЬ ОШИБКИ ПРЕДЫДУЩЕЙ ПОПЫТКИ:\n${feedback}` : '',
  ].filter(Boolean).join('\n')
}

function normalizeAndEnsureConceptPins(
  concept: AiTripConceptProposal,
  input: ProposeAiTripConceptInput,
): AiTripConceptProposal {
  const defaultCity = concept.cities[0]?.name || input.country
  const places = [...concept.places]
  const hotels = [...concept.hotels]

  for (const pin of input.pinnedItems ?? []) {
    if (pin.type === 'place') {
      const existing = places.find(p => p.name.toLowerCase().includes(pin.title.toLowerCase()) || pin.title.toLowerCase().includes(p.name.toLowerCase()))
      if (existing) {
        existing.isUserPinned = true
      }
      else {
        places.unshift({
          id: `pin-place-${places.length + 1}`,
          name: pin.title,
          city: defaultCity,
          category: 'attraction',
          whyVisit: pin.note || 'Добавлено вами в обязательные места',
          isUserPinned: true,
        })
      }
    }
    else if (pin.type === 'hotel') {
      const existing = hotels.find(h => h.name.toLowerCase().includes(pin.title.toLowerCase()) || pin.title.toLowerCase().includes(h.name.toLowerCase()))
      if (existing) {
        existing.isUserPinned = true
      }
      else {
        hotels.unshift({
          id: `pin-hotel-${hotels.length + 1}`,
          name: pin.title,
          city: defaultCity,
          area: pin.note || '',
          pricePerNightRub: 0,
          tier: 'comfort',
          whyStay: pin.note || 'Указанный вами вариант размещения',
          isUserPinned: true,
        })
      }
    }
  }

  // Ensure unique IDs and strictly excluded places filtered out
  const excludedSet = new Set((input.excludedPlaceNames ?? []).map(n => n.trim().toLowerCase()).filter(Boolean))
  const filteredPlaces = places
    .filter(p => p.isUserPinned || !excludedSet.has(p.name.trim().toLowerCase()))
    .map((p, idx) => ({ ...p, id: p.id || `place-${idx + 1}` }))

  const normalizedHotels = hotels.map((h, idx) => ({ ...h, id: h.id || `hotel-${idx + 1}` }))

  const sortedDays = [...concept.daysOutline]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .slice(0, input.days)
    .map((d, idx) => ({
      ...d,
      dayNumber: idx + 1,
    }))

  return {
    ...concept,
    places: filteredPlaces,
    hotels: normalizedHotels,
    daysOutline: sortedDays,
  }
}

function validateConceptProposal(
  data: AiTripConceptProposal,
  input: ProposeAiTripConceptInput,
): { success: true, data: AiTripConceptProposal } | { success: false, errors: string[] } {
  const errors: string[] = []

  if (data.daysOutline.length !== input.days) {
    errors.push(`В массиве "daysOutline" ожидалось РОВНО ${input.days} дней, получено ${data.daysOutline.length}.`)
  }

  if (data.places.length < 3) {
    errors.push('В массиве "places" должно быть минимум 3 предложенных места.')
  }

  if (errors.length > 0)
    return { success: false, errors }

  return {
    success: true,
    data: normalizeAndEnsureConceptPins(data, input),
  }
}

async function generateConceptWithRetry(
  userId: string,
  input: ProposeAiTripConceptInput,
  onLog?: (msg: string) => void,
): Promise<AiTripConceptProposal> {
  let feedback: string | undefined
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt++) {
    await quotaService.checkLlmCreditQuota(userId)

    try {
      const completion = await createAiChatRequest(
        {
          system: buildConceptSystemPrompt(input, feedback),
          user: 'Спроектируй концепцию путешествия по входным параметрам. Верни строго JSON.',
        },
        {
          model: DEFAULT_AI_MODEL,
          response_format: { type: 'json_object' },
          temperature: 0.5,
          max_tokens: 8000,
        },
      )

      const modelUsed = resolveModelName(completion.model)
      if (completion.usage) {
        await recordUsage(userId, {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          model: modelUsed,
        }, 'aiTripConceptProposal')
      }

      const raw = completion.choices[0]?.message?.content
      if (!raw) {
        throw new Error('ИИ вернул пустой ответ при проектировании концепции.')
      }

      const parsed = await parseJsonWithAiRepair<AiTripConceptProposal>(raw, {
        userId,
        model: modelUsed as any,
        operation: 'aiTripConceptProposal',
        maxRetries: 2,
        maxTokens: 8000,
        schema: AiTripConceptProposalSchema,
        validateWithErrors: data => validateConceptProposal(data, input),
        customInstructions: `Root JSON object with "title", "summary", "estimatedBudgetRub", "cities" (non-empty), "places" (>=3 items), "hotels", and "daysOutline" (EXACTLY ${input.days} items for days 1..${input.days}).`,
      })

      return parsed
    }
    catch (err: any) {
      lastError = err
      const reason = err?.message || String(err)
      onLog?.(`⚠ Концепция (попытка ${attempt}/${MAX_CHUNK_ATTEMPTS}): повтор из-за ошибки валидации (${reason.slice(0, 140)})`)
      feedback = reason
    }
  }

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: `Не удалось спроектировать концепцию маршрута после нескольких попыток: ${(lastError as Error)?.message || 'неизвестная ошибка'}`,
  })
}

function conceptProposalToApproved(proposal: AiTripConceptProposal): ApprovedAiTripConcept {
  // По умолчанию выбираем 1 лучший отель на каждый город (или помеченные пользователем)
  const chosenCities = new Set<string>()
  const selectedHotels = proposal.hotels.filter((h) => {
    if (h.isUserPinned) {
      chosenCities.add(h.city.toLowerCase())
      return true
    }
    return false
  })
  for (const h of proposal.hotels) {
    const cityKey = h.city.toLowerCase()
    if (!chosenCities.has(cityKey)) {
      chosenCities.add(cityKey)
      selectedHotels.push(h)
    }
  }

  return {
    title: proposal.title,
    summary: proposal.summary,
    estimatedBudgetRub: proposal.estimatedBudgetRub,
    cities: proposal.cities,
    selectedPlaces: proposal.places.map(p => ({
      name: p.name,
      city: p.city,
      category: p.category,
      whyVisit: p.whyVisit,
    })),
    excludedPlaces: [],
    selectedHotels: selectedHotels.map(h => ({
      name: h.name,
      city: h.city,
      area: h.area,
      pricePerNightRub: h.pricePerNightRub,
      whyStay: h.whyStay,
    })),
    daysOutline: proposal.daysOutline,
  }
}

// ─── 2. МОДУЛЬНАЯ ГЕНЕРАЦИЯ ФАЙЛОВ ВОЛЬТА С САМОИСЦЕЛЕНИЕМ ───────────────────

function sanitizeFolderName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^--\s*/, '')
    .trim()
    .slice(0, 60)
}

function normalizeFilePath(raw: string): string {
  let path = raw.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')
  path = path
    .split('/')
    .map(seg => seg.trim())
    .filter(seg => seg && seg !== '.' && seg !== '..')
    .join('/')
  return path
}

export function stripTripWrapper(files: GeneratedFile[]): GeneratedFile[] {
  const firstSegments = new Set<string>()
  for (const file of files) {
    const idx = file.path.indexOf('/')
    if (idx > 0) {
      firstSegments.add(file.path.slice(0, idx))
    }
  }

  const candidates = [...firstSegments].filter(seg => !KNOWN_TOP_LEVEL_DIRS.has(seg))
  const wrapper = candidates.length === 1 && (candidates[0].startsWith('--') || !candidates[0].endsWith('.md'))
    ? candidates[0]
    : null

  return files.map((file) => {
    let path = normalizeFilePath(file.path)
    if (wrapper && !KNOWN_TOP_LEVEL_DIRS.has(wrapper) && (path === wrapper || path.startsWith(`${wrapper}/`))) {
      path = path.slice(wrapper.length).replace(/^\/+/, '')
    }
    path = path.split('/').map(seg => seg.replace(/^--\s+/, '')).join('/')
    return { path, content: file.content }
  })
}

function formatConceptContext(input: GenerateAiTripInput, concept: ApprovedAiTripConcept): string {
  const startIso = formatDateIso(input.startDate)
  const endInfo = addDaysIso(startIso, input.days - 1)
  const pinsBlock = formatPinnedItemsBlock(input.pinnedItems)

  const daysLines = concept.daysOutline.map((d) => {
    const dateInfo = addDaysIso(startIso, d.dayNumber - 1)
    return `- День ${String(d.dayNumber).padStart(2, '0')} (${dateInfo.iso}, ${dateInfo.weekdayShort}) — ${d.city}: **${d.title}** (${d.highlights.join(', ')})`
  })

  const hotelsLines = concept.selectedHotels.length > 0
    ? concept.selectedHotels.map(h => `- ${h.city}: **${h.name}**${h.area ? ` (${h.area})` : ''}${h.pricePerNightRub ? ` — ~${h.pricePerNightRub} ₽/ночь` : ''}${h.whyStay ? ` — ${h.whyStay}` : ''}`)
    : ['- Подбери оптимальные реальные отели по маршруту']

  const placesLines = concept.selectedPlaces.length > 0
    ? concept.selectedPlaces.map(p => `- [${p.city || input.country}] **${p.name}**${p.whyVisit ? ` — ${p.whyVisit}` : ''}`)
    : ['- Включи ключевые места по концепции маршрута']

  const excludedLines = concept.excludedPlaces.length > 0
    ? [
        '',
        '## 🚫 СТРОГО ИСКЛЮЧЁННЫЕ ПОЛЬЗОВАТЕЛЕМ МЕСТА (ЗАПРЕЩЕНО УПОМИНАТЬ И ВКЛЮЧАТЬ В МАРШРУТ)',
        ...concept.excludedPlaces.map(name => `- ❌ ${name}`),
      ]
    : []

  return [
    '## УТВЕРЖДЁННЫЙ МАСТЕР-ПЛАН ПУТЕШЕСТВИЯ (ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ)',
    `- Название путешествия: ${concept.title}`,
    `- Страна / регион: ${input.country}`,
    `- Даты поездки: ${startIso} — ${endInfo.iso} (${input.days} дн.)`,
    `- Концепция: ${concept.summary}`,
    concept.estimatedBudgetRub ? `- Целевой ориентир бюджета: ~${concept.estimatedBudgetRub} ₽` : '',
    input.wishes ? `- Пожелания путешественника: ${input.wishes}` : '',
    `- Города маршрута: ${concept.cities.map(c => `${c.name} (${c.nights} н.)`).join(' → ')}`,
    '',
    '### Выбранные отели (используй именно их в бронированиях, бюджете и днях):',
    ...hotelsLines,
    '',
    '### Выбранные места и впечатления (обязательно распредели по соответствующим дням):',
    ...placesLines,
    ...excludedLines,
    pinsBlock ? `\n${pinsBlock}` : '',
    '',
    '### Посуточная структура маршрута:',
    ...daysLines,
  ].filter(Boolean).join('\n')
}

async function generateFilesChunkWithRetry(params: {
  userId: string
  chunkLabel: string
  buildSystemPrompt: (feedback?: string) => string
  userPrompt: string
  customRepairInstructions: string
  validateChunk: (files: GeneratedFile[]) => { success: true, data: GeneratedFile[] } | { success: false, errors: string[] }
  maxTokens?: number
  onLog?: (msg: string) => void
  onRetryAttempt?: (attempt: number) => void
}): Promise<GeneratedFile[]> {
  const {
    userId,
    chunkLabel,
    buildSystemPrompt,
    userPrompt,
    customRepairInstructions,
    validateChunk,
    maxTokens = 24000,
    onLog,
    onRetryAttempt,
  } = params

  let feedback: string | undefined
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt++) {
    if (attempt > 1)
      onRetryAttempt?.(attempt)

    await quotaService.checkLlmCreditQuota(userId)

    try {
      const completion = await createAiChatRequest(
        {
          system: buildSystemPrompt(feedback),
          user: userPrompt,
        },
        {
          model: DEFAULT_AI_MODEL,
          response_format: { type: 'json_object' },
          temperature: attempt === 1 ? 0.55 : 0.35,
          max_tokens: maxTokens,
        },
      )

      const modelUsed = resolveModelName(completion.model)
      if (completion.usage) {
        await recordUsage(userId, {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          model: modelUsed,
        }, 'aiTripGeneration')
      }

      const choice = completion.choices[0]
      const raw = choice?.message?.content
      if (!raw) {
        throw new Error(`Пустой ответ модели на этапе «${chunkLabel}».`)
      }

      if (choice.finish_reason === 'length') {
        onLog?.(`⚠ Ответ ИИ на этапе «${chunkLabel}» достиг лимита длины, запуск восстановления JSON…`)
      }

      const parsedChunk = await parseJsonWithAiRepair<{ files: GeneratedFile[] }>(raw, {
        userId,
        model: modelUsed as any,
        operation: 'aiTripGeneration',
        maxRetries: 2,
        maxTokens,
        schema: GeneratedFilesChunkSchema,
        customInstructions: customRepairInstructions,
        validateWithErrors: (data) => {
          const stripped = stripTripWrapper(
            (data.files as GeneratedFile[])
              .filter(f => f.path.endsWith('.md'))
              .map(f => ({ path: normalizeFilePath(f.path), content: f.content })),
          )
          const check = validateChunk(stripped)
          if (!check.success)
            return { success: false, errors: check.errors }
          return { success: true, data: { files: check.data } }
        },
      })

      return parsedChunk.files
    }
    catch (err: any) {
      lastError = err
      const reason = err?.message || String(err)
      onLog?.(`⚠ Самопроверка «${chunkLabel}» (попытка ${attempt}/${MAX_CHUNK_ATTEMPTS}): исправление структуры…`)
      feedback = reason
    }
  }

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: `Не удалось сгенерировать корректный блок «${chunkLabel}»: ${(lastError as Error)?.message || 'ошибка генерации'}`,
  })
}

function buildOverviewChunkPrompt(
  input: GenerateAiTripInput,
  concept: ApprovedAiTripConcept,
  feedback?: string,
): string {
  const vaultArchitect = readSkillFile('travel-vault-architect', 'SKILL.md')
  const vaultTemplates = readSkillFile('travel-vault-architect', 'references', 'hub-and-master-plan-templates.md')
  const vaultStructure = readSkillFile('travel-vault-architect', 'references', 'structure-and-naming.md')
  const curator = readSkillFile('travel-cultural-curator', 'SKILL.md')
  const fines = readSkillFile('travel-cultural-curator', 'references', 'cultural-history-and-fines-template.md')
  const parserSpecs = readSkillFile('travel-importer-compatibility', 'references', 'importer-parser-specs.md')

  const hubFileName = `${sanitizeFolderName(concept.title || `${input.country} ${input.days}д`)}.md`

  return [
    'Ты — элитный тревел-архитектор. Твоя задача — сгенерировать БЛОК 1 (обзорные файлы путешествия) в формате JSON.',
    '',
    formatConceptContext(input, concept),
    '',
    '## ПРАВИЛА АРХИТЕКТУРЫ И КУЛЬТУРНОГО ДОСЬЕ',
    vaultArchitect,
    vaultTemplates,
    vaultStructure,
    curator,
    fines,
    parserSpecs,
    '',
    '## ФАЙЛЫ ЭТОГО БЛОКА (ВЕРНИ РОВНО ЭТИ 3 ФАЙЛА)',
    `1. "${hubFileName}" — главный хаб В КОРНЕ (БЕЗ слэша в path!):`,
    '   - YAML frontmatter (`slug`, `descriptionShort`, `cities`, `tags`, `startDate`, `endDate`)',
    `   - Заголовок \`# ${concept.title}\``,
    '   - Раздел `## 📝 Краткое описание` (2–4 ёмких предложения)',
    '   - Концепция, навигация по разделам и сводка маршрута.',
    '2. "02 - Маршрутный план/Маршрутный план.md" — сводный мастер-план по всем дням с таблицей и ссылками на дни.',
    '3. "05 - Полезная информация/Полезная информация.md" — виза/въезд, транспортные карты, связь, безопасность, таможенные правила и культурный этикет.',
    '',
    '## ФОРМАТ ОТВЕТА',
    'Верни СТРОГО валидный JSON-объект без markdown-ограждений:',
    '{"files": [{"path": "...", "content": "..."}]}',
    feedback ? `\n## ⚠️ ИСПРАВЬ ОШИБКИ ПРЕДЫДУЩЕЙ ПОПЫТКИ:\n${feedback}` : '',
  ].filter(Boolean).join('\n')
}

export function validateOverviewFiles(
  files: GeneratedFile[],
): { success: true, data: GeneratedFile[] } | { success: false, errors: string[] } {
  const errors: string[] = []
  const rootFiles = files.filter(f => !f.path.includes('/'))
  const hub = rootFiles.find((f) => {
    const base = f.path.replace(/\.md$/i, '').toLowerCase()
    return base !== 'маршрутный план' && base !== 'plan' && !/^\d{1,2}[.\s]/.test(base)
  })

  if (!hub) {
    errors.push('Отсутствует корневой хаб-файл `<Название>.md` (path без слэша `/`).')
  }
  else if (!/^#\s+\S+/m.test(hub.content)) {
    errors.push(`В корневом файле "${hub.path}" отсутствует заголовок первого уровня "# <Название>".`)
  }

  const hasMasterPlan = files.some(f => f.path.toLowerCase() === '02 - маршрутный план/маршрутный план.md')
  if (!hasMasterPlan) {
    errors.push('Отсутствует файл "02 - Маршрутный план/Маршрутный план.md".')
  }

  const hasUsefulInfo = files.some(f => f.path.startsWith('05 - Полезная информация/'))
  if (!hasUsefulInfo) {
    errors.push('Отсутствует файл "05 - Полезная информация/Полезная информация.md".')
  }

  if (errors.length > 0)
    return { success: false, errors }
  return { success: true, data: files }
}

function buildSectionsChunkPrompt(
  input: GenerateAiTripInput,
  concept: ApprovedAiTripConcept,
  feedback?: string,
): string {
  const logistics = readSkillFile('travel-logistics-and-budget', 'SKILL.md')
  const budgetTemplate = readSkillFile('travel-logistics-and-budget', 'references', 'budgeting-and-piechart-template.md')
  const bookingStandards = readSkillFile('travel-logistics-and-budget', 'references', 'booking-catalog-standards.md')
  const mustTry = readSkillFile('travel-cultural-curator', 'references', 'must-try-must-buy-template.md')
  const parserSpecs = readSkillFile('travel-importer-compatibility', 'references', 'importer-parser-specs.md')

  return [
    'Ты — элитный тревел-архитектор. Твоя задача — сгенерировать БЛОК 2 (бронирования, финансы и чек-листы) в формате JSON.',
    '',
    formatConceptContext(input, concept),
    '',
    '## ПРАВИЛА ЛОГИСТИКИ, БЮДЖЕТА И ЧЕК-ЛИСТОВ',
    logistics,
    budgetTemplate,
    bookingStandards,
    mustTry,
    parserSpecs,
    '',
    '## ФАЙЛЫ ЭТОГО БЛОКА (ВЕРНИ ВСЕ 7 ФАЙЛОВ)',
    '1. "03 - Бронирования/Отели.md" — таблица отелей строго с выбранными отелями маршрута (`| Ночи | Локация | [Отель](URL) | Ночей | Цена / ночь | Итого |`) и описанием районов.',
    '2. "03 - Бронирования/Транспорт.md" — поезда, автобусы, паромы, проездные между городами маршрута.',
    '3. "03 - Бронирования/Авиаперелеты.md" — таблица перелётов с реальными городами вылета и прилёта.',
    '4. "04 - Финансы/Финансы.md" — калиброванная смета в рублях (₽), сводные таблицы расходов `| Статья | Сумма ₽ | Примечание |` и диаграмма `mermaid pie`.',
    '5. "06 - Чек лист/Чек лист.md" — навигационный индекс чек-листов.',
    '6. "06 - Чек лист/Чек-лист подготовки и сборов.md" — подробный чек-лист `- [ ] пункт` по группам `## 🪪 Документы`, `## 💳 Финансы`, `## 📱 Связь и софт`, `## 💊 Аптечка`, `## 🎒 Сборы`.',
    '7. "06 - Чек лист/Что попробовать и купить (Must-Try & Must-Buy).md" — гастрономический и сувенирный чек-лист `- [ ] блюдо/сувенир (💰 ~N ₽)` по городам поездки.',
    '',
    '## ФОРМАТ ОТВЕТА',
    'Верни СТРОГО валидный JSON-объект без markdown-ограждений:',
    '{"files": [{"path": "...", "content": "..."}]}',
    'ВАЖНО: Внутри JSON-строк экранируй двойные кавычки как `\\"` и переносы строк как `\\n`. Не используй обратный слэш перед символами `|` или `[` в Markdown.',
    feedback ? `\n## ⚠️ ИСПРАВЬ ОШИБКИ ПРЕДЫДУЩЕЙ ПОПЫТКИ:\n${feedback}` : '',
  ].filter(Boolean).join('\n')
}

export function validateSectionsFiles(
  files: GeneratedFile[],
): { success: true, data: GeneratedFile[] } | { success: false, errors: string[] } {
  const errors: string[] = []

  if (!files.some(f => f.path === '03 - Бронирования/Отели.md')) {
    errors.push('Отсутствует файл "03 - Бронирования/Отели.md".')
  }
  if (!files.some(f => f.path === '04 - Финансы/Финансы.md')) {
    errors.push('Отсутствует файл "04 - Финансы/Финансы.md".')
  }
  const checklistFiles = files.filter(f => f.path.startsWith('06 - Чек лист/') && /- \[[ x]\]/i.test(f.content))
  if (checklistFiles.length === 0) {
    errors.push('В папке "06 - Чек лист/" должен быть хотя бы один чек-лист с задачами в формате `- [ ] пункт`.')
  }

  if (errors.length > 0)
    return { success: false, errors }
  return { success: true, data: files }
}

function buildDailyBatchPrompt(
  input: GenerateAiTripInput,
  concept: ApprovedAiTripConcept,
  startDay: number,
  endDay: number,
  feedback?: string,
): string {
  const enricher = readSkillFile('travel-itinerary-enricher', 'SKILL.md')
  const dailySample = readSkillFile('travel-itinerary-enricher', 'examples', 'daily-note-sample.md')
  const enricherChecklist = readSkillFile('travel-itinerary-enricher', 'references', 'daily-note-enrichment-checklist.md')
  const compatibility = readSkillFile('travel-importer-compatibility', 'SKILL.md')
  const parserSpecs = readSkillFile('travel-importer-compatibility', 'references', 'importer-parser-specs.md')
  const compatibilitySample = readSkillFile('travel-importer-compatibility', 'examples', 'importer-compatible-sample.md')

  const startIso = formatDateIso(input.startDate)
  const targetDaysLines: string[] = []
  for (let d = startDay; d <= endDay; d++) {
    const outline = concept.daysOutline.find(o => o.dayNumber === d) || {
      dayNumber: d,
      city: concept.cities[0]?.name || input.country,
      title: `День ${d}`,
      highlights: [],
    }
    const dateInfo = addDaysIso(startIso, d - 1)
    const padNum = String(d).padStart(2, '0')
    targetDaysLines.push(
      `- День ${padNum} (${dateInfo.iso}, ${dateInfo.weekdayShort}): локация «${outline.city}», тема «${outline.title}», ключевые точки: ${outline.highlights.join(', ') || 'по концепции'}. Путь файла: \`02 - Маршрутный план/${padNum} ${outline.city} (${dateInfo.weekdayShort}) — ${outline.title}.md\``,
    )
  }

  const count = endDay - startDay + 1

  return [
    `Ты — элитный тревел-архитектор. Сгенерируй детальные, насыщенные дневные заметки ТОЛЬКО для дней с ${startDay} по ${endDay} (всего РОВНО ${count} ${count === 1 ? 'файл' : 'файла/файлов'}).`,
    '',
    formatConceptContext(input, concept),
    '',
    `## 🎯 ЦЕЛЕВЫЕ ДНИ ЭТОГО ПАКЕТА (СГЕНЕРИРУЙ РОВНО ${count} ФАЙЛ(А))`,
    ...targetDaysLines,
    '',
    '## ПРАВИЛА ОБОГАЩЕНИЯ ДНЕЙ И СОВМЕСТИМОСТИ С ПАРСЕРОМ',
    enricher,
    dailySample,
    enricherChecklist,
    compatibility,
    parserSpecs,
    compatibilitySample,
    '',
    '## КРИТИЧЕСКИЕ ТРЕБОВАНИЯ ПАРСЕРА ДНЯ',
    '1. Каждый файл ОБЯЗАН лежать по пути `02 - Маршрутный план/<NN> <Город> (<день недели>) ... .md` (где `<NN>` — двузначный номер дня: `01`, `02` и т.д.).',
    '2. До первой активности добавь 1–2 полезных коллаута `> [!INFO]` / `> [!TIP]` (парсятся в мета-бейджи дня).',
    '3. КАЖДАЯ активность таймлайна ОБЯЗАНА начинаться со строки формата:',
    '   `* **09:00 - 11:30** — Название локации или события`',
    '   В каждом дне должно быть минимум 4–6 продуманных активностей по времени с логистикой, советами, локальной едой и ориентиром цен в ₽.',
    '4. НЕ включай никакие места из списка исключённых пользователем!',
    '',
    '## ФОРМАТ ОТВЕТА',
    'Верни СТРОГО валидный JSON-объект без markdown-ограждений:',
    '{"files": [{"path": "02 - Маршрутный план/...", "content": "..."}]}',
    feedback ? `\n## ⚠️ ИСПРАВЬ ОШИБКИ ПРЕДЫДУЩЕЙ ПОПЫТКИ:\n${feedback}` : '',
  ].filter(Boolean).join('\n')
}

function extractDayNumberFromPath(path: string): number | null {
  const base = path.split('/').pop()?.replace(/\.md$/i, '') ?? ''
  const match = base.match(/^0?(\d{1,2})(?:\D|$)/)
  if (!match)
    return null
  const num = Number.parseInt(match[1], 10)
  return num >= 1 && num <= 30 ? num : null
}

export function validateDailyBatchFiles(
  files: GeneratedFile[],
  startDay: number,
  endDay: number,
  excludedPlaces: string[],
): { success: true, data: GeneratedFile[] } | { success: false, errors: string[] } {
  const errors: string[] = []
  const normalized: GeneratedFile[] = files.map((file) => {
    let path = file.path
    if (!path.includes('/')) {
      path = `02 - Маршрутный план/${path}`
    }
    else if (!path.startsWith('02 - Маршрутный план/')) {
      const base = path.split('/').pop()!
      path = `02 - Маршрутный план/${base}`
    }
    return { path, content: file.content }
  })

  const byDay = new Map<number, GeneratedFile>()
  for (const file of normalized) {
    const base = file.path.split('/').pop()!.replace(/\.md$/i, '').toLowerCase()
    if (base === 'маршрутный план' || base === 'plan')
      continue

    const dayNum = extractDayNumberFromPath(file.path)
    if (dayNum !== null) {
      byDay.set(dayNum, file)
    }
  }

  const excludedLower = excludedPlaces
    .map(p => p.trim().toLowerCase())
    .filter(p => p.length >= 4)

  for (let d = startDay; d <= endDay; d++) {
    const dayFile = byDay.get(d)
    const pad = String(d).padStart(2, '0')
    if (!dayFile) {
      errors.push(`Отсутствует файл для Дня ${pad} в папке "02 - Маршрутный план/" (имя файла должно начинаться с "${pad} ").`)
      continue
    }

    const parsedActivities = parseActivitiesFromMarkdown(dayFile.content)
    if (parsedActivities.length < 2) {
      errors.push(
        `В файле "${dayFile.path}" парсер распознал только ${parsedActivities.length} активностей (нужно минимум 3–5). Каждая активность ОБЯЗАНА оформляться строкой списка: \`* **09:00 - 11:00** — Название\`.`,
      )
    }

    for (const act of parsedActivities) {
      const titleLower = act.title.toLowerCase()
      const hitExcluded = excludedLower.find(ex => titleLower.includes(ex))
      if (hitExcluded) {
        errors.push(`В файле "${dayFile.path}" использовано отклонённое пользователем место «${hitExcluded}». Замени его на другую локацию.`)
      }
    }
  }

  if (errors.length > 0)
    return { success: false, errors }

  const validBatchFiles: GeneratedFile[] = []
  for (let d = startDay; d <= endDay; d++) {
    const f = byDay.get(d)
    if (f)
      validBatchFiles.push(f)
  }

  return { success: true, data: validBatchFiles }
}

// ─── 3. ГЕО-БЕЗОПАСНАЯ ПРИВЯЗКА ГОРОДОВ ПЕРЕД ИМПОРТОМ ───────────────────────

export function rewriteHubFrontmatterCities(markdown: string, canonicalCities: string[]): string {
  const citiesYaml = `cities: [${canonicalCities.map(c => `"${c.replace(/"/g, '\\"')}"`).join(', ')}]`
  const allLines = markdown.split(/\r?\n/)

  if (allLines[0]?.trim() !== '---') {
    return `---\n${citiesYaml}\n---\n\n${markdown}`
  }

  let closingIdx = -1
  for (let i = 1; i < allLines.length; i++) {
    if (allLines[i].trim() === '---') {
      closingIdx = i
      break
    }
  }

  if (closingIdx === -1) {
    return `---\n${citiesYaml}\n---\n\n${markdown}`
  }

  const fmLines = allLines.slice(1, closingIdx)
  const nextLines: string[] = []
  let replaced = false

  for (let i = 0; i < fmLines.length; i++) {
    if (/^cities:\s*/.test(fmLines[i])) {
      nextLines.push(citiesYaml)
      replaced = true
      while (i + 1 < fmLines.length && /^\s+-\s+/.test(fmLines[i + 1])) {
        i++
      }
      continue
    }
    nextLines.push(fmLines[i])
  }

  if (!replaced) {
    nextLines.push(citiesYaml)
  }

  const rest = allLines.slice(closingIdx + 1).join('\n')
  return `---\n${nextLines.join('\n')}\n---\n${rest}`
}

async function resolveBestCityPlace(label: string, countryHint: string) {
  const cleanLabel = label.trim()
  if (cleanLabel.length < 2)
    return null

  const countryLower = countryHint.trim().toLowerCase()
  const pickBest = async (candidates: Array<{ id: string, name: string, countryName: string, retired: boolean }>) => {
    const active = candidates.filter(c => !c.retired)
    if (active.length === 0)
      return null

    const selectableIds = new Set(await geoRepository.getSelectableIds(active.map(c => c.id)))
    const selectable = active.filter(c => selectableIds.has(c.id))
    if (selectable.length === 0)
      return null

    const matchingCountry = selectable.find(
      c => c.countryName.toLowerCase().includes(countryLower) || countryLower.includes(c.countryName.toLowerCase()),
    )
    return matchingCountry ?? selectable[0]
  }

  try {
    const exact = await geoService.resolveExact({ label: cleanLabel })
    if (exact.status === 'resolved' && exact.place && !exact.place.retired) {
      const best = await pickBest([exact.place])
      if (best)
        return best
    }

    const fromExactCandidates = (exact.candidates ?? []).map(c => c.place)
    if (fromExactCandidates.length > 0) {
      const best = await pickBest(fromExactCandidates)
      if (best)
        return best
    }

    const searched = await geoService.search({ query: cleanLabel, locale: 'ru', limit: 10 })
    if (searched.length > 0) {
      return await pickBest(searched)
    }
  }
  catch {
    return null
  }

  return null
}

async function prepareSafeCitiesAndHub(
  files: GeneratedFile[],
  concept: ApprovedAiTripConcept,
  countryHint: string,
  log: (msg: string) => void,
): Promise<{ cityMappings: Record<string, string> }> {
  const rootHub = files.find(f => !f.path.includes('/'))
  const fm = rootHub ? parseTripFrontmatter(rootHub.content) : {}

  const rawCandidates = [
    ...(fm.cities ?? []),
    ...concept.cities.map(c => c.name),
  ]

  const seenLabels = new Set<string>()
  const uniqueLabels: string[] = []
  for (const raw of rawCandidates) {
    const trimmed = raw.trim()
    const key = trimmed.toLowerCase()
    if (trimmed && !seenLabels.has(key)) {
      seenLabels.add(key)
      uniqueLabels.push(trimmed)
    }
  }

  const cityMappings: Record<string, string> = {}
  const resolvedPlaceIds = new Set<string>()
  const canonicalLabels: string[] = []

  for (const label of uniqueLabels) {
    const place = await resolveBestCityPlace(label, countryHint)
    if (!place) {
      log(`ℹ Локация «${label}» пропущена в гео-каталоге городов (останется в тексте маршрута).`)
      continue
    }
    if (resolvedPlaceIds.has(place.id)) {
      continue
    }
    resolvedPlaceIds.add(place.id)
    canonicalLabels.push(place.name)
    cityMappings[place.name] = place.id
  }

  if (rootHub) {
    rootHub.content = rewriteHubFrontmatterCities(rootHub.content, canonicalLabels)
  }

  return { cityMappings }
}

// ─── 4. ФОНОВЫЙ ПАЙПЛАЙН ПОЛНОЙ ГЕНЕРАЦИИ И ИМПОРТА ──────────────────────────

interface ImportProgressStage {
  stage: string
  progress: number
}

const IMPORT_PROGRESS: ImportProgressStage[] = [
  { stage: 'parsing', progress: 80 },
  { stage: 'trip', progress: 84 },
  { stage: 'sections', progress: 88 },
  { stage: 'days', progress: 92 },
  { stage: 'notes', progress: 95 },
  { stage: 'activities', progress: 98 },
]

function progressForImportStage(stage: string): number {
  return IMPORT_PROGRESS.find(s => s.stage === (stage || '').split(':')[0])?.progress ?? 85
}

async function runJob(jobId: string, userId: string, input: GenerateAiTripInput): Promise<void> {
  const log = (message: string) => {
    const job = jobs.get(jobId)
    if (job) {
      job.logs.push(message)
      if (job.logs.length > 120)
        job.logs.splice(0, job.logs.length - 120)
    }
  }

  let tempDir: string | null = null
  try {
    // Шаг 1: Концепция маршрута (берём утверждённую пользователем либо строим автоматически)
    let concept: ApprovedAiTripConcept
    if (input.approvedConcept) {
      concept = input.approvedConcept
      setJob(jobId, {
        status: 'generating',
        stage: 'Подготовка утверждённого плана маршрута',
        progress: 10,
        attempt: 1,
        attemptsTotal: MAX_CHUNK_ATTEMPTS,
      })
      log(`Концепция утверждена: «${concept.title}» (${concept.cities.map(c => c.name).join(' → ')})`)
    }
    else {
      setJob(jobId, {
        status: 'generating',
        stage: 'Проектирование концепции и подбор мест',
        progress: 6,
        attempt: 1,
        attemptsTotal: MAX_CHUNK_ATTEMPTS,
      })
      log('Этап 1: проектирование концепции маршрута…')
      const proposal = await generateConceptWithRetry(userId, {
        country: input.country,
        startDate: input.startDate,
        days: input.days,
        wishes: input.wishes,
        pinnedItems: input.pinnedItems,
      }, log)
      concept = conceptProposalToApproved(proposal)
      log(`Сформирована концепция: «${concept.title}» (${concept.cities.map(c => c.name).join(' → ')})`)
    }

    // Шаг 2: Генерация обзорных файлов и разделов (параллельно 2 компактных блока)
    setJob(jobId, {
      status: 'generating',
      stage: 'Генерация хаба, бронирований, бюджета и чек-листов',
      progress: 18,
      attempt: 1,
    })
    log('Этап 2: создание обзора, таблиц отелей, логистики, бюджета и чек-листов…')

    const [overviewFiles, sectionsFiles] = await Promise.all([
      generateFilesChunkWithRetry({
        userId,
        chunkLabel: 'Обзор и мастер-план',
        buildSystemPrompt: feedback => buildOverviewChunkPrompt(input, concept, feedback),
        userPrompt: 'Сгенерируй 3 обзорных файла путешествия (хаб, маршрутный план и полезную информацию). Верни только JSON.',
        customRepairInstructions: 'JSON object {"files": [{"path": "...", "content": "..."}]} containing root hub .md (no slash in path), "02 - Маршрутный план/Маршрутный план.md", and "05 - Полезная информация/Полезная информация.md".',
        validateChunk: validateOverviewFiles,
        maxTokens: 18000,
        onLog: log,
        onRetryAttempt: attempt => setJob(jobId, { attempt }),
      }),
      generateFilesChunkWithRetry({
        userId,
        chunkLabel: 'Бронирования, финансы и чек-листы',
        buildSystemPrompt: feedback => buildSectionsChunkPrompt(input, concept, feedback),
        userPrompt: 'Сгенерируй 7 файлов разделов (отели, транспорт, перелёты, финансы и 3 чек-листа). Верни только JSON.',
        customRepairInstructions: 'JSON object {"files": [{"path": "...", "content": "..."}]} containing "03 - Бронирования/Отели.md", "04 - Финансы/Финансы.md", and checklist files in "06 - Чек лист/" with "- [ ] " items.',
        validateChunk: validateSectionsFiles,
        maxTokens: 20000,
        onLog: log,
        onRetryAttempt: attempt => setJob(jobId, { attempt }),
      }),
    ])

    log(`Разделы готовы: обзор (${overviewFiles.length} ф.) + логистика, финансы и чек-листы (${sectionsFiles.length} ф.)`)

    // Шаг 3: Генерация дневных файлов компактными пакетами по 3 дня
    const allDailyFiles: GeneratedFile[] = []
    const totalBatches = Math.ceil(input.days / DAILY_BATCH_SIZE)

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const startDay = batchIdx * DAILY_BATCH_SIZE + 1
      const endDay = Math.min(input.days, startDay + DAILY_BATCH_SIZE - 1)
      const batchProgress = Math.round(35 + (batchIdx / totalBatches) * 38)
      const rangeLabel = startDay === endDay ? `день ${startDay}` : `дни ${startDay}–${endDay}`

      setJob(jobId, {
        status: 'generating',
        stage: `Проработка расписания (${rangeLabel} из ${input.days})`,
        progress: batchProgress,
        attempt: 1,
      })
      log(`Этап 3.${batchIdx + 1}: детальная проработка таймлайна (${rangeLabel} из ${input.days})…`)

      const batchFiles = await generateFilesChunkWithRetry({
        userId,
        chunkLabel: `Маршрут (${rangeLabel})`,
        buildSystemPrompt: feedback => buildDailyBatchPrompt(input, concept, startDay, endDay, feedback),
        userPrompt: `Сгенерируй подробные дневные файлы маршрута для диапазона: ${rangeLabel}. Верни только JSON.`,
        customRepairInstructions: `JSON object {"files": [{"path": "02 - Маршрутный план/...", "content": "..."}]} with files for each day from ${startDay} to ${endDay}. Every day file MUST contain timed activities formatted as "* **09:00 - 11:00** — Activity title".`,
        validateChunk: files => validateDailyBatchFiles(files, startDay, endDay, concept.excludedPlaces),
        maxTokens: 22000,
        onLog: log,
        onRetryAttempt: attempt => setJob(jobId, { attempt }),
      })

      allDailyFiles.push(...batchFiles)
      log(`✓ Проработаны ${rangeLabel}: проверен таймлайн и совместимость с парсером`)
    }

    const files: GeneratedFile[] = [
      ...overviewFiles,
      ...sectionsFiles,
      ...allDailyFiles,
    ]

    // Шаг 4: Гео-привязка городов и подготовка временного вольта
    setJob(jobId, {
      status: 'importing',
      stage: 'Проверка гео-каталога и сборка структуры',
      progress: 76,
    })

    const { cityMappings } = await prepareSafeCitiesAndHub(files, concept, input.country, log)

    const folderName = sanitizeFolderName(concept.title || `${input.country} ${input.days}д`)
    tempDir = mkdtempSync(join(tmpdir(), `-- ${folderName}-`))
    const parserFolderName = basename(tempDir).replace(/^--\s*/, '')

    const rootHub = files.find(f => !f.path.includes('/'))
    for (const file of files) {
      let relPath = file.path
      if (rootHub && file === rootHub)
        relPath = `${parserFolderName}.md`

      const dest = join(tempDir, relPath)
      if (!dest.startsWith(tempDir))
        continue
      mkdirSync(join(dest, '..'), { recursive: true })
      writeFileSync(dest, file.content, 'utf-8')
    }

    // Шаг 5: Импорт в БД Trip Scheduler
    setJob(jobId, { status: 'importing', stage: 'Импорт в путешествие', progress: 80 })

    const transport = createInProcessTransport(userId)
    const result = await importTripFolderCore(tempDir, transport, {
      startDate: formatDateIso(input.startDate),
      useLlm: true,
      uploadImages: false,
      geocode: true,
      status: 'planned',
      visibility: 'private',
      cityMappings,
      resolveCity: async (label, candidates) => {
        const best = await resolveBestCityPlace(label, input.country)
        if (best && candidates.some(c => c.id === best.id))
          return best.id
        return candidates.find(c => !c.retired)?.id
      },
      onLog: log,
      onProgress: (stage, detail) => {
        setJob(jobId, {
          stage: detail ? `${stage}: ${detail}` : stage,
          progress: progressForImportStage(stage),
        })
      },
    })

    log(`Импорт завершен: дней=${result.daysCreated}, активностей=${result.activitiesCreated}, заметок=${result.notesCreated}`)
    setJob(jobId, { status: 'done', stage: 'Готово', progress: 100, tripId: result.tripId })
  }
  catch (error: any) {
    console.error('[AI Trip] Ошибка генерации:', error)
    log(`Ошибка: ${error?.message || error}`)
    const message = error?.message || String(error)
    const needsInput = error?.name === 'GeoCityNeedsInputError'
      || /Город «.+» в авиасегменте (?:неоднозначен|не найден в справочнике)\./.test(message)
    setJob(jobId, {
      status: needsInput ? 'needs_input' : 'error',
      stage: needsInput ? 'Нужно уточнить города' : 'Ошибка',
      error: message,
    })
  }
  finally {
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true })
      }
      catch {
        // ignore cleanup errors
      }
    }
  }
}

export const aiTripService = {
  async proposeConcept(userId: string, input: ProposeAiTripConceptInput): Promise<AiTripConceptProposal> {
    await quotaService.checkTripCreationQuota(userId)
    await quotaService.checkLlmCreditQuota(userId)
    return generateConceptWithRetry(userId, input)
  },

  async startGeneration(userId: string, input: GenerateAiTripInput): Promise<{ jobId: string }> {
    await quotaService.checkTripCreationQuota(userId)
    await quotaService.checkLlmCreditQuota(userId)

    const jobId = crypto.randomUUID()
    jobs.set(jobId, {
      id: jobId,
      userId,
      status: 'pending',
      stage: 'В очереди',
      logs: [],
      tripId: null,
      error: null,
      createdAt: Date.now(),
      progress: 2,
      attempt: 1,
      attemptsTotal: MAX_CHUNK_ATTEMPTS,
    })

    void runJob(jobId, userId, input).catch(() => {})

    const hourAgo = Date.now() - 60 * 60 * 1000
    for (const [id, job] of jobs) {
      if (job.createdAt < hourAgo)
        jobs.delete(id)
    }

    return { jobId }
  },

  getStatus(jobId: string, userId: string): Omit<AiTripJob, 'userId'> {
    const job = getJob(jobId, userId)
    if (!job)
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Задача не найдена.' })
    const { userId: _, ...rest } = job
    return rest
  },
}
