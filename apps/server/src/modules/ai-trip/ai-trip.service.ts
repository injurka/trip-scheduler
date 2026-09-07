import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
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
  progress: number | null
  attempt: number
  attemptsTotal: number
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

const MAX_GENERATION_ATTEMPTS = 3

function buildSystemPrompt(input: GenerateAiTripInput, feedback?: string): string {
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
    '## ⚠️ ГЛАВНОЕ О ПУТЯХ ФАЙЛОВ — НАРУШЕНИЕ ЛОМАЕТ ИМПОРТ',
    'В поле "path" укажи ОТНОСИТЕЛЬНЫЙ путь БЕЗ какой-либо внешней папки-обёртки.',
    '- ЗАПРЕЩЕНО оборачивать всё в дополнительную папку вроде `-- Китай (Море и Пляжи)/`.',
    '- Хаб `<Название>.md` должен лежать В КОРНЕ (path без слэша).',
    '- Подпапки указываются как `02 - Маршрутный план/<файл>.md` и т.п. (без префикса `-- `).',
    `- Дневных файлов в папке «02 - Маршрутный план» должно быть РОВНО ${input.days}.`,
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
    '{"files": [{"path": "<относительный путь>", "content": "<полное содержимое .md файла>"}]}',
    'Обязательные файлы:',
    `- "<Название>.md" — главный хаб, В КОРНЕ (путь без слэша)`,
    `- "02 - Маршрутный план/Маршрутный план.md" — сводный план`,
    `- "02 - Маршрутный план/<NN> <Локация> (<день недели>) <эмодзи> <хайлайты>.md" — РОВНО ${input.days} дневных файлов, имена с 01 по ${String(input.days).padStart(2, '0')}`,
    `- "03 - Бронирования/Отели.md", "03 - Бронирования/Транспорт.md", "03 - Бронирования/Авиаперелеты.md"`,
    `- "04 - Финансы/Финансы.md"`,
    `- "05 - Полезная информация/05 - Полезная информация.md"`,
    `- "06 - Чек лист/06 - Чек лист.md", "06 - Чек лист/Чек-лист подготовки и сборов.md", "06 - Чек лист/Что попробовать и купить (Must-Try & Must-Buy).md"`,
    'Каждый дневной файл обязан содержать таймлайн активностей в формате `* **HH:MM - HH:MM** — Название` (парсер активностей), коллауты `> [!TYPE]` до первой активности (парсятся в бейджи дня), таблицы бронирований с колонками `| Ночи | Локация | [Отель](URL) | Ночей | Цена / ночь | Итого |`, секции финансов с суммами в ₽ в формате таблиц `| Статья | N ₽ | Примечание |`, чек-листы `- [ ] пункт (💰 ~N ₽)`.',
    feedback ? ['', '## ⚠️ ПРЕДЫДУЩАЯ ПОПЫТКА НЕ ПРОШЛА ВАЛИДАЦИЮ', 'Исправь следующие ошибки и верни ПОЛНЫЙ комплект файлов:', feedback].join('\n') : '',
  ].join('\n')
}

// ─── Генерация и импорт ──────────────────────────────────────────────────────

interface GeneratedFile {
  path: string
  content: string
}

/** Структурные папки верхнего уровня вольта — их обёрткой считаться не должны. */
const KNOWN_TOP_LEVEL_DIRS = new Set([
  '02 - Маршрутный план',
  '03 - Бронирования',
  '04 - Финансы',
  '05 - Полезная информация',
  '06 - Чек лист',
  '_',
  'attachments',
])

/** Название папки путешествия, которое ожидает парсер (без ведущего `-- `). */
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

/**
 * Срезает возможную папку-обёртку путешествия (например `-- Китай (Море и Пляжи)/…`).
 * Если все файлы имеют ОДИН общий первый сегмент, не являющийся структурной папкой —
 * этот сегмент считается обёрткой и убирается. Также убирает ведущий `-- ` из имён.
 */
function stripTripWrapper(files: GeneratedFile[]): GeneratedFile[] {
  const firstSegments = new Set<string>()
  for (const file of files) {
    const idx = file.path.indexOf('/')
    if (idx > 0) {
      firstSegments.add(file.path.slice(0, idx))
    }
  }

  const candidates = [...firstSegments].filter(seg => !KNOWN_TOP_LEVEL_DIRS.has(seg))
  const wrapper = candidates.length === 1 && candidates[0].startsWith('--')
    ? candidates[0]
    : null

  return files.map((file) => {
    let path = file.path
    if (wrapper && (path === wrapper || path.startsWith(`${wrapper}/`))) {
      path = path.slice(wrapper.length).replace(/^\/+/, '')
    }
    // Убираем ведущий `-- ` из относительных частей (хаб «-- Китай….md» → «Китай….md»)
    path = path.split('/').map(seg => seg.replace(/^--\s+/, '')).join('/')
    return { path, content: file.content }
  })
}

/**
 * Валидирует сгенерированный набор файлов по тем же правилам, что использует
 * парсер vault'а (чтобы не создавать импортом пустое путешествие).
 * Возвращает список проблем; пустой список = структура валидна.
 */
function validateGeneratedFiles(files: GeneratedFile[], input: GenerateAiTripInput): string[] {
  const problems: string[] = []
  const rootFiles = files.filter(f => !f.path.includes('/'))
  const hub = rootFiles[0]

  if (!hub) {
    problems.push('Нет главного хаба (`.md`-файла в корне).')
  }
  else {
    // хаб не может быть «Маршрутный план» или дневным файлом
    const hubBase = hub.path.replace(/\.md$/i, '').toLowerCase()
    if (hubBase === 'маршрутный план' || hubBase === 'plan' || /^\d{1,2}[.\s]/.test(hubBase)) {
      problems.push(`Корневой файл «${hub.path}» не похож на хаб путешествия.`)
    }
  }

  const dayFiles = files.filter(f => f.path.startsWith('02 - Маршрутный план/') && f.path.endsWith('.md'))
  const actualDayNotes = dayFiles.filter((f) => {
    const base = f.path.split('/').pop()!.replace(/\.md$/i, '')
    return base !== 'Маршрутный план' && base.toLowerCase() !== 'plan'
  })

  if (dayFiles.length === 0) {
    problems.push('Нет папки «02 - Маршрутный план/» с дневными файлами.')
  }
  else if (actualDayNotes.length !== input.days) {
    problems.push(`Ожидалось ${input.days} дневных файлов в «02 - Маршрутный план/», получено ${actualDayNotes.length}.`)
  }

  return problems
}

async function generateTripFiles(input: GenerateAiTripInput, feedback?: string): Promise<{
  files: GeneratedFile[]
  usage: { promptTokens: number, completionTokens: number, model: string } | null
}> {
  const completion = await createAiChatRequest(
    { system: buildSystemPrompt(input, feedback), user: 'Сгенерируй полный комплект заметок путешествия по правилам выше. Верни только JSON.' },
    { model: DEFAULT_AI_MODEL, response_format: { type: 'json_object' }, temperature: 0.6, max_tokens: 60000 },
  )

  const usage = completion.usage
    ? {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        model: (AI_MODELS as readonly string[]).find(m => completion.model?.includes(m) || m.includes(completion.model)) || DEFAULT_AI_MODEL,
      }
    : null

  const raw = completion.choices[0]?.message?.content
  if (!raw)
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ не вернул результат.' })

  let clean = raw.trim()
  if (clean.startsWith('```'))
    clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')

  let parsed: { files?: Array<{ path?: string, content?: string }> }
  try {
    parsed = JSON.parse(clean) as { files?: Array<{ path?: string, content?: string }> }
  }
  catch {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ вернул невалидный JSON.' })
  }

  const files = (parsed.files || [])
    .filter(f => typeof f.path === 'string' && typeof f.content === 'string' && f.path.endsWith('.md'))
    .map(f => ({ path: normalizeFilePath(f.path!), content: f.content! }))

  if (files.length === 0)
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ИИ не вернул ни одного markdown-файла.' })

  const result = stripTripWrapper(files)
  return { files: result, usage }
}

interface ImportProgressStage {
  stage: string
  progress: number
}

// Стадии импортёра и их прогресс (0–100), в порядке вызова importTripFolderCore
const IMPORT_PROGRESS: ImportProgressStage[] = [
  { stage: 'parsing', progress: 5 },
  { stage: 'trip', progress: 15 },
  { stage: 'sections', progress: 35 },
  { stage: 'days', progress: 55 },
  { stage: 'notes', progress: 75 },
  { stage: 'activities', progress: 95 },
]

function progressForStage(stage: string): number | null {
  return IMPORT_PROGRESS.find(s => s.stage === (stage || '').split(':')[0])?.progress ?? null
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
    const folderName = sanitizeFolderName(`${input.country} ${input.days}д`)
    const attemptsTotal = MAX_GENERATION_ATTEMPTS

    let files: GeneratedFile[] = []
    let lastUsage: { promptTokens: number, completionTokens: number, model: string } | null = null
    let validationProblems: string[] = []
    let previousProblems: string[] = []

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      setJob(jobId, {
        status: 'generating',
        stage: `Генерация заметок через ИИ — попытка ${attempt + 1} из ${MAX_GENERATION_ATTEMPTS}`,
        progress: null,
        attempt: attempt + 1,
        attemptsTotal,
      })

      const generated = await generateTripFiles(input, attempt > 0 ? previousProblems.join('; ') : undefined)
      files = generated.files
      if (generated.usage)
        lastUsage = generated.usage
      log(`Попытка ${attempt + 1}: сгенерировано файлов: ${files.length}`)

      validationProblems = validateGeneratedFiles(files, input)
      if (validationProblems.length === 0) {
        log('Структура файлов прошла валидацию.')
        break
      }
      log(`⚠ Валидация не прошла: ${validationProblems.join('; ')}`)
      previousProblems = validationProblems
    }

    if (validationProblems.length > 0) {
      const msg = `Не удалось сгенерировать корректную структуру путешествия: ${validationProblems.join('; ')}`
      log(msg)
      setJob(jobId, { status: 'error', error: msg, stage: 'Ошибка' })
      return
    }

    // Списываем кредиты и логируем usage только за успешную генерацию
    if (lastUsage) {
      await quotaService.deductLlmCredits(
        userId,
        lastUsage.model,
        lastUsage.promptTokens,
        lastUsage.completionTokens,
      )
      await llmUsageRepository.create({
        userId,
        model: lastUsage.model,
        operation: 'aiTripGeneration',
        inputTokens: lastUsage.promptTokens,
        outputTokens: lastUsage.completionTokens,
      })
    }

    // Раскладываем файлы во временную папку, которую ожидает парсер.
    // Папку создаём как `-- <name>-<suffix>` (соглашение вольта), а хаб кладём
    // под именем папки без `-- ` — так парсер гарантированно распознает его.
    const tripName = sanitizeFolderName(folderName)
    tempDir = mkdtempSync(join(tmpdir(), `-- ${tripName}-`))
    const parserFolderName = basename(tempDir).replace(/^--\s*/, '')

    const rootHub = files.find(f => !f.path.includes('/'))
    for (const file of files) {
      let relPath = file.path
      // Хаб кладём под именем папки (парсер матчит по folderName)
      if (rootHub && file === rootHub)
        relPath = `${parserFolderName}.md`

      const dest = join(tempDir, relPath)
      if (!dest.startsWith(tempDir))
        continue
      mkdirSync(join(dest, '..'), { recursive: true })
      writeFileSync(dest, file.content, 'utf-8')
    }

    setJob(jobId, { status: 'importing', stage: 'Импорт в путешествие', progress: 5 })

    const transport = createInProcessTransport(userId)
    const result = await importTripFolderCore(tempDir, transport, {
      startDate: new Date(input.startDate).toISOString().split('T')[0],
      useLlm: true,
      uploadImages: false,
      geocode: true,
      status: 'planned',
      visibility: 'private',
      onLog: log,
      onProgress: (stage, detail) => {
        setJob(jobId, {
          stage: detail ? `${stage}: ${detail}` : stage,
          progress: progressForStage(stage),
        })
      },
    })

    log(`Импорт завершен: tripId=${result.tripId}, дней=${result.daysCreated}, активностей=${result.activitiesCreated}, заметок=${result.notesCreated}`)
    setJob(jobId, { status: 'done', stage: 'Готово', progress: 100, tripId: result.tripId })
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
      progress: null,
      attempt: 0,
      attemptsTotal: MAX_GENERATION_ATTEMPTS,
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
