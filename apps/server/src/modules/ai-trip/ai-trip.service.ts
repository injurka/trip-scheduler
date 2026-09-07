import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { importTripFolderCore } from '@limiteddissolve/obsidian-importer'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { AI_MODELS, createAiChatRequest, DEFAULT_AI_MODEL } from '~/lib/llm'
import { llmUsageRepository } from '~/repositories/llm-usage.repository'
import { quotaService } from '~/services/quota.service'
import { createInProcessTransport } from './in-process.transport'

export const GenerateAiTripInputSchema = z.object({
  country: z.string().min(2).max(80),
  startDate: z.union([z.date(), z.string()]),
  days: z.number().int().min(1).max(15),
  wishes: z.string().max(4000).optional(),
})

export type GenerateAiTripInput = z.infer<typeof GenerateAiTripInputSchema>

export type AiTripJobStatus = 'pending' | 'generating' | 'importing' | 'done' | 'error'

export interface AiTripJob {
  id: string
  userId: string
  status: AiTripJobStatus
  stage: string
  logs: string[]
  tripId: string | null
  error: string | null
  createdAt: number
}

// In-memory реестр задач: генерация одноразовая и недолговечная,
// персистентность не требуется (перезапуск сервера = потеря статуса).
const jobs = new Map<string, AiTripJob>()

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

// ─── Промпт из скилов skills-installer ───────────────────────────────────────

const __dirname = fileURLToPath(new URL('.', import.meta.url))
// apps/server/src/modules/ai-trip/ -> tools/skills-installer/source/skills
const SKILLS_SOURCE_DIR = join(__dirname, '../../../../../tools/skills-installer/source/skills')

function readSkillFile(...segments: string[]): string {
  const path = join(SKILLS_SOURCE_DIR, ...segments)
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

function buildSystemPrompt(input: GenerateAiTripInput): string {
  const vaultArchitect = readSkillFile('travel-vault-architect', 'SKILL.md')
  const vaultTemplates = readSkillFile('travel-vault-architect', 'references', 'hub-and-master-plan-templates.md')
  const vaultStructure = readSkillFile('travel-vault-architect', 'references', 'structure-and-naming.md')
  const enricher = readSkillFile('travel-itinerary-enricher', 'SKILL.md')
  const dailySample = readSkillFile('travel-itinerary-enricher', 'examples', 'daily-note-sample.md')
  const enricherChecklist = readSkillFile('travel-itinerary-enricher', 'references', 'daily-note-enrichment-checklist.md')
  const logistics = readSkillFile('travel-logistics-and-budget', 'SKILL.md')
  const budgetTemplate = readSkillFile('travel-logistics-and-budget', 'references', 'budgeting-and-piechart-template.md')
  const bookingStandards = readSkillFile('travel-logistics-and-budget', 'references', 'booking-catalog-standards.md')
  const curator = readSkillFile('travel-cultural-curator', 'SKILL.md')
  const fines = readSkillFile('travel-cultural-curator', 'references', 'cultural-history-and-fines-template.md')
  const mustTry = readSkillFile('travel-cultural-curator', 'references', 'must-try-must-buy-template.md')
  const compatibility = readSkillFile('travel-importer-compatibility', 'SKILL.md')
  const parserSpecs = readSkillFile('travel-importer-compatibility', 'references', 'importer-parser-specs.md')
  const compatibilitySample = readSkillFile('travel-importer-compatibility', 'examples', 'importer-compatible-sample.md')

  const startDate = new Date(input.startDate)
  const weekday = startDate.toLocaleDateString('ru-RU', { weekday: 'short' })

  return [
    'Ты — элитный тревел-архитектор. Твоя задача: сгенерировать ПОЛНЫЙ комплект заметок путешествия в формате markdown, строго совместимый с парсером Trip Scheduler Importer.',
    '',
    '## ВХОДНЫЕ ДАННЫЕ',
    `Страна: ${input.country}`,
    `Дата начала: ${startDate.toISOString().split('T')[0]} (${weekday})`,
    `Длительность: ${input.days} дней`,
    input.wishes ? `Пожелания путешественника (учти их в первую очередь): ${input.wishes}` : 'Пожелания: не указаны — предложи классический насыщенный маршрут.',
    '',
    '## ПРАВИЛА АРХИТЕКТУРЫ ПРОЕКТА (travel-vault-architect)',
    vaultArchitect,
    '',
    '### Шаблоны хаба и мастер-плана',
    vaultTemplates,
    '',
    '### Структура и именование файлов',
    vaultStructure,
    '',
    '## ПРАВИЛА ДНЕВНЫХ ЗАМЕТОК (travel-itinerary-enricher)',
    enricher,
    '',
    '### Пример дневного файла (эталон формата)',
    dailySample,
    '',
    '### Чек-лист обогащения дня',
    enricherChecklist,
    '',
    '## ПРАВИЛА ЛОГИСТИКИ И БЮДЖЕТА (travel-logistics-and-budget)',
    logistics,
    '',
    '### Шаблон бюджета',
    budgetTemplate,
    '',
    '### Стандарты каталога бронирований',
    bookingStandards,
    '',
    '## ПРАВИЛА КУЛЬТУРНОГО ДОСЬЕ (travel-cultural-curator)',
    curator,
    '',
    '### Шаблон истории и штрафов',
    fines,
    '',
    '### Шаблон Must-Try & Must-Buy',
    mustTry,
    '',
    '## ТРЕБОВАНИЯ СОВМЕСТИМОСТИ С ПАРСЕРОМ (travel-importer-compatibility) — КРИТИЧНО',
    compatibility,
    '',
    parserSpecs,
    '',
    '### Пример файла, совместимого с парсером',
    compatibilitySample,
    '',
    '## ФОРМАТ ОТВЕТА — СТРОГО СОБЛЮДАЙ',
    'Верни JSON-объект (без markdown-ограждений) вида:',
    '{"files": [{"path": "<относительный путь внутри папки путешествия>", "content": "<полное содержимое .md файла>"}]}',
    'Обязательные файлы:',
    `- "<Страна>.md" — главный хаб (в корне папки)`,
    `- "02 - Маршрутный план/Маршрутный план.md" — сводный план`,
    `- "02 - Маршрутный план/<NN> <Локация> (<день недели>) <эмодзи> <хайлайты>.md" — РОВНО ${input.days} дневных файлов, имена с 01 по ${String(input.days).padStart(2, '0')}`,
    `- "03 - Бронирования/Отели.md", "03 - Бронирования/Транспорт.md", "03 - Бронирования/Авиаперелеты.md"`,
    `- "04 - Финансы/Финансы.md"`,
    `- "05 - Полезная информация/05 - Полезная информация.md"`,
    `- "06 - Чек лист/06 - Чек лист.md", "06 - Чек лист/Чек-лист подготовки и сборов.md", "06 - Чек лист/Что попробовать и купить (Must-Try & Must-Buy).md"`,
    'Каждый дневной файл обязан содержать таймлайн активностей в формате `* **HH:MM - HH:MM** — Название` (парсер активностей), коллауты `> [!TYPE]` до первой активности (парсятся в бейджи дня), таблицы бронирований с колонками `| Ночи | Локация | [Отель](URL) | Ночей | Цена / ночь | Итого |`, секции финансов с суммами в ₽ в формате таблиц `| Статья | N ₽ | Примечание |`, чек-листы `- [ ] пункт (💰 ~N ₽)`.',
  ].join('\n')
}

// ─── Генерация и импорт ──────────────────────────────────────────────────────

async function generateTripFiles(userId: string, input: GenerateAiTripInput): Promise<Array<{ path: string, content: string }>> {
  const completion = await createAiChatRequest(
    { system: buildSystemPrompt(input), user: 'Сгенерируй полный комплект заметок путешествия по правилам выше. Верни только JSON.' },
    { model: DEFAULT_AI_MODEL, response_format: { type: 'json_object' }, temperature: 0.6 },
  )

  if (completion.usage) {
    const actualModelId = (AI_MODELS as readonly string[]).find(m => completion.model?.includes(m) || m.includes(completion.model)) || DEFAULT_AI_MODEL
    await quotaService.deductLlmCredits(
      userId,
      actualModelId,
      completion.usage.prompt_tokens,
      completion.usage.completion_tokens,
    )

    await llmUsageRepository.create({
      userId,
      model: actualModelId,
      operation: 'aiTripGeneration',
      inputTokens: completion.usage.prompt_tokens,
      outputTokens: completion.usage.completion_tokens,
    })
  }

  const raw = completion.choices[0]?.message?.content
  if (!raw)
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ не вернул результат.' })

  let clean = raw.trim()
  if (clean.startsWith('```'))
    clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')

  const parsed = JSON.parse(clean) as { files?: Array<{ path?: string, content?: string }> }
  if (!Array.isArray(parsed.files) || parsed.files.length === 0)
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ вернул некорректную структуру файлов.' })

  const files = parsed.files
    .filter(f => typeof f.path === 'string' && typeof f.content === 'string' && f.path.endsWith('.md'))
    .map(f => ({ path: f.path!.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\.\./g, ''), content: f.content! }))

  if (files.length === 0)
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ не вернул ни одного markdown-файла.' })

  return files
}

async function runJob(jobId: string, userId: string, input: GenerateAiTripInput): Promise<void> {
  const log = (message: string) => {
    const job = jobs.get(jobId)
    if (job) {
      job.logs.push(message)
      // держим лог компактным
      if (job.logs.length > 100)
        job.logs.splice(0, job.logs.length - 100)
    }
  }

  let tempDir: string | null = null
  try {
    setJob(jobId, { status: 'generating', stage: 'Генерация заметок через ИИ' })
    const files = await generateTripFiles(userId, input)
    log(`Сгенерировано файлов: ${files.length}`)

    setJob(jobId, { status: 'importing', stage: 'Импорт в путешествие' })

    // Раскладываем файлы во временную папку, которую ожидает парсер
    tempDir = mkdtempSync(join(tmpdir(), 'ai-trip-'))
    for (const file of files) {
      const dest = join(tempDir, file.path)
      const normalized = dest.replace(/[\\/]$/, '')
      if (!normalized.startsWith(tempDir))
        continue
      const { mkdirSync } = await import('node:fs')
      mkdirSync(join(normalized, '..'), { recursive: true })
      writeFileSync(normalized, file.content, 'utf-8')
    }

    const transport = createInProcessTransport(userId)
    const result = await importTripFolderCore(tempDir, transport, {
      startDate: new Date(input.startDate).toISOString().split('T')[0],
      useLlm: true,
      uploadImages: false,
      geocode: true,
      status: 'planned',
      visibility: 'private',
      onLog: log,
      onProgress: (stage, detail) => setJob(jobId, { stage: detail ? `${stage}: ${detail}` : stage }),
    })

    log(`Импорт завершен: tripId=${result.tripId}, дней=${result.daysCreated}, активностей=${result.activitiesCreated}, заметок=${result.notesCreated}`)
    setJob(jobId, { status: 'done', stage: 'Готово', tripId: result.tripId })
  }
  catch (error: any) {
    console.error('[AI Trip] Ошибка генерации:', error)
    log(`Ошибка: ${error?.message || error}`)
    setJob(jobId, { status: 'error', stage: 'Ошибка', error: error?.message || String(error) })
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
    })

    // Запускаем в фоне, не блокируя ответ tRPC
    void runJob(jobId, userId, input).catch(() => { })

    // Чистим старые задачи этого пользователя (более 1 часа)
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
