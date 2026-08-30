#!/usr/bin/env bun
/* eslint-disable no-console */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import process from 'node:process'
import prompts from 'prompts'

// Try reading environment variables from apps/server/.env if not present
function loadEnvIfAvailable() {
  const envPaths = [
    resolve(process.cwd(), 'apps/server/.env'),
    resolve(process.cwd(), '.env'),
  ]

  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, 'utf-8')
        for (const line of content.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#'))
            continue
          const eqIdx = trimmed.indexOf('=')
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim()
            let val = trimmed.slice(eqIdx + 1).trim()
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) {
              val = val.slice(1, -1)
            }
            if (!process.env[key]) {
              process.env[key] = val
            }
          }
        }
      }
      catch {
        // ignore
      }
    }
  }
}

loadEnvIfAvailable()

// ANSI color helpers
const colors = {
  reset: '\x1B[0m',
  bright: '\x1B[1m',
  dim: '\x1B[2m',
  green: '\x1B[32m',
  blue: '\x1B[34m',
  cyan: '\x1B[36m',
  yellow: '\x1B[33m',
  red: '\x1B[31m',
  magenta: '\x1B[35m',
}

export const DEFAULT_TRIP_SECTIONS = [
  {
    type: 'bookings',
    title: 'Бронирования',
    icon: 'mdi:book-multiple-outline',
  },
  {
    type: 'checklist',
    title: 'Чек-листы',
    icon: 'mdi:format-list-checks',
  },
  {
    type: 'finances',
    title: 'Финансы',
    icon: 'mdi:cash-multiple',
  },
  {
    type: 'memories',
    title: 'Галерея воспоминаний',
    icon: 'mdi:image-filter-hdr',
  },
  {
    type: 'notes',
    title: 'Заметки',
    icon: 'mdi:note-edit-outline',
  },
  {
    type: 'documents',
    title: 'Документы',
    icon: 'mdi:file-document-multiple-outline',
  },
] as const

interface ParsedDay {
  dayNumber: number
  fileName: string
  filePath: string
  title: string
  description: string
  rawContent: string
  date: string
}

interface ParsedNoteFile {
  title: string
  fileName: string
  filePath: string
  content: string
}

interface ParsedNoteFolder {
  folderName: string
  folderPath: string
  files: ParsedNoteFile[]
}

export interface ChecklistSubtask {
  id: string
  text: string
  completed: boolean
}

export interface ChecklistTabConfig {
  id: string
  name: string
  icon: string
  isCustom?: boolean
}

export interface ChecklistGroup {
  id: string
  name: string
  icon?: string
  type?: string
}

export type ChecklistPriority = 1 | 2 | 3 | 4 | 5

export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  type: string
  groupId?: string
  priority?: ChecklistPriority
  description?: string
  cost?: string
  location?: string
  link?: string
  tags?: string[]
  subtasks?: ChecklistSubtask[]
}

export interface ChecklistSectionContent {
  items?: ChecklistItem[]
  groups?: ChecklistGroup[]
  tabs?: ChecklistTabConfig[]
}

export interface FinanceTransaction {
  id: string
  title: string
  amount: number
  currency: string
  categoryId: string
  notes?: string
  date?: string
}

export interface FinanceCategory {
  id: string
  name: string
  icon: string
  isDefault: boolean
}

export interface FinancesSectionContent {
  settings: {
    mainCurrency: string
    exchangeRates: Record<string, number>
  }
  categories: FinanceCategory[]
  transactions: FinanceTransaction[]
}

interface ParsedTripData {
  title: string
  description: string
  descriptionShort: string
  cities: string[]
  tags: string[]
  startDate: string
  endDate: string
  days: ParsedDay[]
  sectionFolders: ParsedNoteFolder[]
  rootNotes: ParsedNoteFile[]
  checklistContent: ChecklistSectionContent
  checklistFilesCount: number
  financesContent: FinancesSectionContent
}

interface ActivitySection {
  id: string
  type: 'description'
  text: string
  title?: string
}

interface ActivityPayload {
  id?: string
  startTime: string
  endTime: string
  title: string
  tag: 'transport' | 'walk' | 'food' | 'attraction' | 'relax' | 'activity'
  sections?: ActivitySection[]
}

interface CliOptions {
  dir?: string
  apiUrl: string
  email?: string
  password?: string
  startDate?: string
  useLlm: boolean
  dryRun: boolean
  visibility: 'private' | 'public'
  status: 'planned' | 'draft' | 'completed'
  importTripMeta?: boolean
  importDays?: boolean
  importActivities?: boolean
  importChecklists?: boolean
  importNotes?: boolean
  importSections?: boolean
  nonInteractive?: boolean
}

// -----------------------------------------------------------------------------
// CLI Arguments Parser
// -----------------------------------------------------------------------------
function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2)
  const options: CliOptions = {
    apiUrl: process.env.API_URL || 'http://localhost:8080',
    useLlm: true,
    dryRun: false,
    visibility: 'private',
    status: 'planned',
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
    else if (arg === '--dir' || arg === '-d') {
      options.dir = args[++i]
    }
    else if (arg === '--api-url' || arg === '-u') {
      options.apiUrl = args[++i]
    }
    else if (arg === '--email' || arg === '-e') {
      options.email = args[++i]
    }
    else if (arg === '--password' || arg === '-p') {
      options.password = args[++i]
    }
    else if (arg === '--start-date' || arg === '-s') {
      options.startDate = args[++i]
    }
    else if (arg === '--no-llm') {
      options.useLlm = false
    }
    else if (arg === '--dry-run') {
      options.dryRun = true
    }
    else if (arg === '--public') {
      options.visibility = 'public'
    }
    else if (arg === '--status') {
      const val = args[++i]
      if (val === 'completed' || val === 'planned' || val === 'draft') {
        options.status = val
      }
    }
    else if (arg === '--yes' || arg === '-y') {
      options.nonInteractive = true
    }
    else if (arg === '--all') {
      options.importTripMeta = true
      options.importDays = true
      options.importActivities = true
      options.importChecklists = true
      options.importNotes = true
      options.importSections = true
    }
    else if (!arg.startsWith('-') && !options.dir) {
      options.dir = arg
    }
  }

  return options
}

function printHelp() {
  console.log(`
${colors.bright}Импорт путешествий из Obsidian в Trip Scheduler${colors.reset}

${colors.yellow}Использование:${colors.reset}
  bun run scripts/import-obsidian-trip.ts [путь_к_папке] [опции]

${colors.yellow}Опции:${colors.reset}
  -d, --dir <path>         Путь к папке путешествия в Obsidian
  -u, --api-url <url>      URL сервера API (по умолчанию: http://localhost:8080)
  -e, --email <email>      Email пользователя для входа
  -p, --password <pass>    Пароль пользователя для входа
  -s, --start-date <date>  Дата начала поездки (ГГГГ-ММ-ДД, по умолчанию: сегодня)
  --no-llm                 Не использовать LLM для генерации блоков (использовать встроенный парсер)
  --dry-run                Режим предпросмотра без отправки запросов на сервер
  --public                 Сделать путешествие публичным (по умолчанию: private)
  --status <status>        Статус: planned | completed | draft (по умолчанию: planned)
  --all                    Импортировать все разделы без дополнительных вопросов
  -y, --yes                Неинтерактивный режим
  -h, --help               Показать справку

${colors.yellow}Примеры:${colors.reset}
  bun run scripts/import-obsidian-trip.ts "/home/injurka/Documents/obsidian-mark/Personal Note/Travel/-- Taiwan"
  bun run scripts/import-obsidian-trip.ts --dir "./my-trip" --email "dev@dev.dev" --password "123456"
`)
}

// -----------------------------------------------------------------------------
// Helper: Discover Travel Folders in Default Obsidian Location
// -----------------------------------------------------------------------------
function discoverObsidianTravelFolders(): string[] {
  const defaultTravelPath = resolve(process.env.HOME || '', 'Documents/obsidian-mark/Personal Note/Travel')
  if (!existsSync(defaultTravelPath)) {
    return []
  }

  try {
    const entries = readdirSync(defaultTravelPath)
    return entries
      .map(entry => join(defaultTravelPath, entry))
      .filter((fullPath) => {
        try {
          return statSync(fullPath).isDirectory() && !basename(fullPath).startsWith('.')
        }
        catch {
          return false
        }
      })
  }
  catch {
    return []
  }
}

// -----------------------------------------------------------------------------
// Helper: Smart Heuristic Markdown Activity Parser
// -----------------------------------------------------------------------------
function inferActivityTag(title: string, content: string): ActivityPayload['tag'] {
  const text = `${title} ${content}`.toLowerCase()

  if (/перелет|аэропорт|авиа|вылет|прилет|klia|рейс|поезд|метро|mrt|thsr|tra|трансфер|экспресс|такси|grab|uber|автобус|паром|шаттл|канатная дорога|gondola|поездка|дорог/.test(text)) {
    return 'transport'
  }
  if (/завтрак|обед|ужин|стритфуд|еда|кулинар|лапша|рис|наси лемак|дамплинг|сяолонгбао|кофе|чай|дегустация|ресторан|кафе|бистро|рынок|на ночном рынке|ночной рынок|бар|коктейль|пиво|мороженое/.test(text)) {
    return 'food'
  }
  if (/прогулка|хайкинг|пешком|подъем|треккинг|набережная|аллея|переход|тропа|велопрогулка|велосипед/.test(text)) {
    return 'walk'
  }
  if (/храм|пещеры|башни|небоскреб|мемориал|площадь|музей|дворец|смотровая|парк|заповедник|водопад|ущелье|пагода|достопримечательность|форт|панора/i.test(text)) {
    return 'attraction'
  }
  if (/отель|заселение|бассейн|пляж|отдых|душ|переодевание|акклиматизация|релакс|купание|источники|спа/.test(text)) {
    return 'relax'
  }

  return 'activity'
}

export function parseActivitiesFromMarkdown(dayContent: string): ActivityPayload[] {
  const activities: ActivityPayload[] = []
  const lines = dayContent.split('\n')

  const timeRegex = /^[*-]\s*\*\*(\d{1,2}:\d{2})\s*(?:[-–—]\s*(\d{1,2}:\d{2}))?\*\*\s*[-–—:]?\s*(.*)$/

  let currentActivity: {
    startTime: string
    endTime: string
    title: string
    lines: string[]
  } | null = null

  function finishCurrentActivity() {
    if (!currentActivity)
      return

    const sectionText = currentActivity.lines.join('\n').trim()
    const cleanTitle = currentActivity.title
      .replace(/^[—–-]\s*/, '')
      .replace(/\s*[—–-]$/, '')
      .trim() || 'Активность'

    const tag = inferActivityTag(cleanTitle, sectionText)

    activities.push({
      startTime: currentActivity.startTime,
      endTime: currentActivity.endTime,
      title: cleanTitle,
      tag,
      sections: sectionText
        ? [
          {
            id: crypto.randomUUID(),
            type: 'description',
            text: sectionText,
          },
        ]
        : [],
    })

    currentActivity = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(timeRegex)

    if (match) {
      finishCurrentActivity()

      const startTime = match[1].padStart(5, '0')
      let endTime = match[2] ? match[2].padStart(5, '0') : ''

      if (!endTime) {
        const [h, m] = startTime.split(':').map(Number)
        const nextHour = (h + 1) % 24
        endTime = `${String(nextHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }

      const title = match[3]?.trim() || ''

      currentActivity = {
        startTime,
        endTime,
        title,
        lines: [],
      }
    }
    else if (currentActivity) {
      if (line.startsWith('## ') || line.startsWith('# ')) {
        finishCurrentActivity()
      }
      else if (line.trim() === '---') {
        finishCurrentActivity()
      }
      else if (line.startsWith('### ')) {
        finishCurrentActivity()
      }
      else {
        currentActivity.lines.push(line)
      }
    }
  }

  finishCurrentActivity()

  // Fallback: If no time-based activities found, check for ### Part sections
  if (activities.length === 0) {
    let partIndex = 0
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith('### ') && !line.includes('Важная подготовка')) {
        const title = line.replace(/^###\s*/, '').replace(/^[^\wА-Яа-яёЁ]+/, '').trim()
        const startH = 9 + partIndex * 3
        const endH = startH + 2
        const startTime = `${String(startH).padStart(2, '0')}:00`
        const endTime = `${String(endH).padStart(2, '0')}:00`
        partIndex++

        const subLines: string[] = []
        let j = i + 1
        while (j < lines.length && !lines[j].startsWith('### ') && !lines[j].startsWith('## ')) {
          subLines.push(lines[j])
          j++
        }

        const sectionText = subLines.join('\n').trim()
        activities.push({
          startTime,
          endTime,
          title,
          tag: inferActivityTag(title, sectionText),
          sections: sectionText
            ? [
              {
                id: crypto.randomUUID(),
                type: 'description',
                text: sectionText,
              },
            ]
            : [],
        })
      }
    }
  }

  return activities
}

// -----------------------------------------------------------------------------
// Direct LLM Call (as fallback if server endpoint has quota/pricing error)
// -----------------------------------------------------------------------------
async function generateActivitiesViaDirectLlm(canvasNote: string): Promise<ActivityPayload[] | null> {
  const apiKey = process.env.AI_HUBMIX_KEY || process.env.OPENAI_API_KEY
  if (!apiKey)
    return null

  const baseUrl = process.env.AI_HUBMIX_API_URL || (process.env.AI_HUBMIX_KEY ? 'https://aihubmix.com/v1' : 'https://api.openai.com/v1')
  const candidateModels = process.env.AI_HUBMIX_KEY
    ? ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'baidu-deepseek-v4-flash']
    : ['gpt-4o-mini', 'gpt-4o']

  const systemPrompt = `You are an expert travel planner API.
The user wants to generate daily schedule activities from their markdown notes.
You MUST return ONLY a valid JSON object with a single key "activities", which is an array of activity objects adhering to this structure:
{
  "activities": [
    {
      "id": "uuid string",
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "title": "Activity title",
      "tag": "transport" | "walk" | "food" | "attraction" | "relax" | "activity",
      "sections": [
        {
          "id": "uuid string",
          "type": "description",
          "text": "Detailed text or description"
        }
      ]
    }
  ]
}`

  for (const model of candidateModels) {
    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Вот заметка дня путешествия:\n\n${canvasNote}\n\nРазбей этот день на активности с точным временем начала и конца, тегами и подробными секциями описания.` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      })

      if (!res.ok)
        continue

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content
      if (!content)
        continue

      let text = content.trim()
      const firstFence = text.indexOf('```')
      const lastFence = text.lastIndexOf('```')
      if (firstFence !== -1 && lastFence > firstFence) {
        let inner = text.slice(firstFence + 3, lastFence).trim()
        if (inner.toLowerCase().startsWith('json')) {
          inner = inner.slice(4).trim()
        }
        text = inner
      }
      else {
        text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
      }

      const firstBrace = text.indexOf('{')
      const firstBracket = text.indexOf('[')
      let startIndex = -1
      let isArray = false
      if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        startIndex = firstBrace
        isArray = false
      }
      else if (firstBracket !== -1) {
        startIndex = firstBracket
        isArray = true
      }

      if (startIndex !== -1) {
        const endChar = isArray ? ']' : '}'
        const lastIndex = text.lastIndexOf(endChar)
        if (lastIndex > startIndex) {
          text = text.substring(startIndex, lastIndex + 1)
        }
      }
      text = text.replace(/,\s*([\]}])/g, '$1')

      const parsed = JSON.parse(text)
      const acts = parsed.activities || (Array.isArray(parsed) ? parsed : null)
      if (acts && Array.isArray(acts) && acts.length > 0) {
        return acts
      }
    }
    catch {
      // try next candidate model
    }
  }

  return null
}

// -----------------------------------------------------------------------------
// Helper: Smart Group Icon Picker based on Emojis & Keywords
// -----------------------------------------------------------------------------
function detectIconForGroup(groupName: string): string {
  const text = groupName.toLowerCase()

  if (/🪪|документ|паспорт|виз|страхов|въезд/.test(text))
    return 'mdi:card-account-details-outline'
  if (/💳|финанс|деньг|валют|карт|easycard|оплат/.test(text))
    return 'mdi:credit-card-outline'
  if (/💻|воркейшн|ноутбук|техник|it|электроник|гаджет/.test(text))
    return 'mdi:laptop'
  if (/📱|софт|приложен|приложени|esim|связь|vpn/.test(text))
    return 'mdi:cellphone-cog'
  if (/💊|аптечк|здоров|медицин|лекарств|таблетк/.test(text))
    return 'mdi:pill'
  if (/👕|гардероб|одежд|обув|слои|куртк|дождевик/.test(text))
    return 'mdi:tshirt-crew-outline'
  if (/🎒|снаряжен|багаж|рюкзак|чемодан|вещи/.test(text))
    return 'mdi:bag-personal-outline'
  if (/🚨|таможн|запрет|правил|штраф/.test(text))
    return 'mdi:alert-octagon-outline'
  if (/⏳|таймлайн|готовност|предполетн|срок/.test(text))
    return 'mdi:timeline-clock-outline'
  if (/🏮|стритфуд|ночной рынок|рынок|закуск/.test(text))
    return 'mdi:food'
  if (/🍲|специалитет|блюд|деликатес|утка|говядин|суп|лапша/.test(text))
    return 'mdi:pot-steam'
  if (/🍵|чай|чайная|напитк|boba|bubble tea|гунфу/.test(text))
    return 'mdi:tea'
  if (/🥭|фрукт|десерт|бингсу|морожен/.test(text))
    return 'mdi:fruit-cherries'
  if (/🌊|природ|остров|снорклинг|онсэн|термал|пляж/.test(text))
    return 'mdi:waves'
  if (/⛩️|культур|храм|традици|лотере|гадан|фич/.test(text))
    return 'mdi:torii-gate'
  if (/🍃|улун|коллекци|лишан|алишан/.test(text))
    return 'mdi:leaf'
  if (/🍍|выпечк|сладост|фэнлису|тайянбин|пирог/.test(text))
    return 'mdi:cake-variant'
  if (/🥃|виски|алкогол|kavalan|пиво/.test(text))
    return 'mdi:glass-cocktail'
  if (/🛍️|шопинг|покупк|подарк|сувенир/.test(text))
    return 'mdi:shopping-outline'
  if (/🧴|косметик|уход|маск/.test(text))
    return 'mdi:lotion-outline'

  return 'mdi:checkbox-marked-circle-outline'
}

// -----------------------------------------------------------------------------
// Helper: Extract Cost, Location, Link, Priority from task text
// -----------------------------------------------------------------------------
function extractCostFromText(text: string): string | undefined {
  const match = text.match(/\((?:💰|~)?\s*([~≈]?\s*(?:\d+[\s\d]*[–—\-]\s*\d+|\d+[\s\d]*)\s*(?:TWD|NT\$|₽|USD|\$|EUR|€|CNY|¥|KRW|₩)(?:\s*\/[^\)]+)?)\)/i)
  if (match)
    return match[1].trim()

  const plainMatch = text.match(/`(~?\s*\d+[\s\d]*(?:[–—\-]\d+[\s\d]*)?\s*(?:TWD|₽|\$|USD|EUR))`/)
  if (plainMatch)
    return plainMatch[1].trim()

  return undefined
}

function extractLocationFromText(text: string): string | undefined {
  const match = text.match(/\*(?:Где пробовать|Локация|Место|Где искать|Где купить):\*\s*([^;\n\)]+)/i)
  if (match) {
    return match[1].split('(`')[0].split('(`')[0].trim().replace(/\s*\(~.*$/, '')
  }
  return undefined
}

function extractLinkFromText(text: string): string | undefined {
  const mdMatch = text.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/i)
  if (mdMatch)
    return mdMatch[2]

  const urlMatch = text.match(/(?:https?:\/\/|www\.)[^\s\)]+/i)
  if (urlMatch) {
    let url = urlMatch[0].replace(/[`\*,;.]+$/, '')
    if (!url.startsWith('http'))
      url = `https://${url}`
    return url
  }

  const portalMatch = text.match(/`([a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s`]*)?)`/i)
  if (portalMatch) {
    return `https://${portalMatch[1]}`
  }

  return undefined
}

function detectPriorityFromText(text: string): ChecklistPriority {
  if (/🚨|❌|запрещен|штраф|критическ|обязательн|строго/i.test(text))
    return 5
  if (/⚡|важно|рекомендует|высок/i.test(text))
    return 4
  if (/\[P5\]/i.test(text))
    return 5
  if (/\[P4\]/i.test(text))
    return 4
  if (/\[P3\]/i.test(text))
    return 3
  if (/\[P2\]/i.test(text))
    return 2
  if (/\[P1\]/i.test(text))
    return 1

  return 1
}

// -----------------------------------------------------------------------------
// Advanced Obsidian Checklist Parser
// -----------------------------------------------------------------------------
export function parseObsidianChecklists(checklistDirOrFiles: string[] | string): ChecklistSectionContent {
  const filePaths: string[] = []

  if (typeof checklistDirOrFiles === 'string') {
    if (existsSync(checklistDirOrFiles)) {
      if (statSync(checklistDirOrFiles).isDirectory()) {
        const files = readdirSync(checklistDirOrFiles).filter(f => f.endsWith('.md'))
        for (const file of files) {
          filePaths.push(join(checklistDirOrFiles, file))
        }
      }
      else {
        filePaths.push(checklistDirOrFiles)
      }
    }
  }
  else if (Array.isArray(checklistDirOrFiles)) {
    filePaths.push(...checklistDirOrFiles.filter(f => existsSync(f)))
  }

  if (filePaths.length === 0) {
    return {
      tabs: [
        { id: 'preparation', name: 'Подготовка и сборы', icon: 'mdi:briefcase-check-outline', isCustom: false },
        { id: 'in-trip', name: 'В путешествии', icon: 'mdi:map-marker-path', isCustom: false },
      ],
      groups: [],
      items: [],
    }
  }

  const tabs: ChecklistTabConfig[] = []
  const groups: ChecklistGroup[] = []
  const items: ChecklistItem[] = []

  // Ensure default base tabs
  const defaultPrepTab: ChecklistTabConfig = {
    id: 'preparation',
    name: 'Подготовка и сборы',
    icon: 'mdi:briefcase-check-outline',
    isCustom: false,
  }
  tabs.push(defaultPrepTab)

  for (const filePath of filePaths) {
    const fileName = basename(filePath)
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    // Determine target tab based on filename
    let currentTabId = 'preparation'

    if (/must-try|что попробовать/i.test(fileName)) {
      currentTabId = 'must-try'
      if (!tabs.some(t => t.id === 'must-try')) {
        tabs.push({ id: 'must-try', name: 'Must-Try: Гастрономия', icon: 'mdi:noodles', isCustom: true })
      }
    }
    else if (/must-buy|шопинг|покупки/i.test(fileName)) {
      currentTabId = 'must-buy'
      if (!tabs.some(t => t.id === 'must-buy')) {
        tabs.push({ id: 'must-buy', name: 'Must-Buy: Шопинг', icon: 'mdi:shopping-outline', isCustom: true })
      }
    }
    else if (/активност|must-do|впечатлен/i.test(fileName)) {
      currentTabId = 'must-do'
      if (!tabs.some(t => t.id === 'must-do')) {
        tabs.push({ id: 'must-do', name: 'Must-Do: Впечатления', icon: 'mdi:compass-outline', isCustom: true })
      }
    }

    let currentH2GroupId: string | undefined
    let currentGroupId: string | undefined
    let currentItem: ChecklistItem | null = null

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const rawLine = lines[lineIndex]
      const trimmed = rawLine.trim()

      if (!trimmed)
        continue

      // H1 Header (e.g. # Must-Try or # Must-Buy)
      if (rawLine.startsWith('# ') && !rawLine.startsWith('## ')) {
        const title = rawLine.replace(/^#\s*/, '').replace(/^[^\wА-Яа-яёЁ]+/, '').trim()
        if (/must-try|гастрономи|что попробовать/i.test(title)) {
          currentTabId = 'must-try'
          currentH2GroupId = undefined
          currentGroupId = undefined
          if (!tabs.some(t => t.id === 'must-try')) {
            tabs.push({ id: 'must-try', name: 'Must-Try: Гастрономия', icon: 'mdi:noodles', isCustom: true })
          }
        }
        else if (/must-buy|шопинг|покупки/i.test(title)) {
          currentTabId = 'must-buy'
          currentH2GroupId = undefined
          currentGroupId = undefined
          if (!tabs.some(t => t.id === 'must-buy')) {
            tabs.push({ id: 'must-buy', name: 'Must-Buy: Шопинг', icon: 'mdi:shopping-outline', isCustom: true })
          }
        }
        else if (/must-do|активност|впечатлен/i.test(title)) {
          currentTabId = 'must-do'
          currentH2GroupId = undefined
          currentGroupId = undefined
          if (!tabs.some(t => t.id === 'must-do')) {
            tabs.push({ id: 'must-do', name: 'Must-Do: Впечатления', icon: 'mdi:compass-outline', isCustom: true })
          }
        }
        continue
      }

      // H2 Header (e.g. ## I. Must-Try, ## 1. Документы, ## 💊 3. Аптечка)
      if (rawLine.startsWith('## ') && !rawLine.startsWith('### ')) {
        const cleanH2 = rawLine.replace(/^##\s*/, '').trim()

        if (/I\.\s*Must-Try|гастрономический гид/i.test(cleanH2)) {
          currentTabId = 'must-try'
          currentH2GroupId = undefined
          currentGroupId = undefined
          if (!tabs.some(t => t.id === 'must-try')) {
            tabs.push({ id: 'must-try', name: 'Must-Try: Гастрономия', icon: 'mdi:noodles', isCustom: true })
          }
          continue
        }
        else if (/II\.\s*Must-Do|активностей|опыта/i.test(cleanH2)) {
          currentTabId = 'must-do'
          currentH2GroupId = undefined
          currentGroupId = undefined
          if (!tabs.some(t => t.id === 'must-do')) {
            tabs.push({ id: 'must-do', name: 'Must-Do: Впечатления', icon: 'mdi:compass-outline', isCustom: true })
          }
          continue
        }
        else if (/III\.\s*Must-Buy|шопинг|подарки/i.test(cleanH2)) {
          currentTabId = 'must-buy'
          currentH2GroupId = undefined
          currentGroupId = undefined
          if (!tabs.some(t => t.id === 'must-buy')) {
            tabs.push({ id: 'must-buy', name: 'Must-Buy: Шопинг', icon: 'mdi:shopping-outline', isCustom: true })
          }
          continue
        }

        // Create Group from H2
        const icon = detectIconForGroup(cleanH2)
        const groupTitle = cleanH2
          .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Symbol}\s\uFE00-\uFE0F\u200D\d.)\-]+/gu, '')
          .trim() || cleanH2
        const groupId = crypto.randomUUID()

        groups.push({
          id: groupId,
          name: groupTitle,
          icon,
          type: currentTabId,
        })
        currentH2GroupId = groupId
        currentGroupId = groupId
        currentItem = null
        continue
      }

      // H3 Header (e.g. ### 🏮 1. Легендарный стритфуд, ### 🤢 Укачивание)
      if (rawLine.startsWith('### ')) {
        const rawH3 = rawLine.replace(/^###\s*/, '').trim()

        // If in Must-Try, Must-Buy, Must-Do, or outside any H2 group -> H3 creates a new group
        if (currentTabId === 'must-try' || currentTabId === 'must-buy' || currentTabId === 'must-do' || !currentH2GroupId) {
          const icon = detectIconForGroup(rawH3)
          const groupTitle = rawH3
            .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Symbol}\s\uFE00-\uFE0F\u200D\d.)\-]+/gu, '')
            .trim() || rawH3
          const groupId = crypto.randomUUID()

          groups.push({
            id: groupId,
            name: groupTitle,
            icon,
            type: currentTabId,
          })
          currentGroupId = groupId
        }
        else {
          // If inside a preparation H2 group (like 💊 3. Аптечка or 👕 4. Гардероб), assign items directly to that parent H2 group!
          currentGroupId = currentH2GroupId
        }
        currentItem = null
        continue
      }

      // Checkbox line: `- [ ]` or `- [x]`
      const taskMatch = rawLine.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+([^\s].*)$/)
      if (taskMatch) {
        const indent = taskMatch[1].length
        const isChecked = taskMatch[2].toLowerCase() === 'x'
        const taskText = taskMatch[3].trim()

        // Subtask (indented 2+ spaces under current item)
        if (indent >= 2 && currentItem) {
          if (!currentItem.subtasks)
            currentItem.subtasks = []

          currentItem.subtasks.push({
            id: crypto.randomUUID(),
            text: taskText.replace(/^[*_`]+|[*_`]+$/g, '').trim(),
            completed: isChecked,
          })
          continue
        }

        // Main Item
        const priority = detectPriorityFromText(taskText)
        const cost = extractCostFromText(taskText)
        const location = extractLocationFromText(taskText)
        const link = extractLinkFromText(taskText)

        let cleanText = taskText.replace(/\[P[1-5]\]/gi, '').trim()
        let description: string | undefined

        const colonMatch = cleanText.match(/^(\*\*[^*]+\*\*:?)\s*([^\s].*)$/)
        if (colonMatch && colonMatch[2].trim()) {
          cleanText = colonMatch[1]
          description = colonMatch[2].trim()
        }

        const newItem: ChecklistItem = {
          id: crypto.randomUUID(),
          text: cleanText,
          completed: isChecked,
          type: currentTabId,
          groupId: currentGroupId,
          priority,
          description,
          cost,
          location,
          link,
          subtasks: [],
        }

        items.push(newItem)
        currentItem = newItem
        continue
      }

      // Indented description bullet: e.g. `  - *Что это:* ...`
      if (currentItem && /^(\s{2,}|\t)[-*+]\s+/.test(rawLine)) {
        const descText = rawLine.replace(/^(\s{2,}|\t)[-*+]\s+/, '').trim()

        // Check if cost/location/link are inside this description bullet
        const costInDesc = extractCostFromText(descText)
        if (costInDesc && !currentItem.cost)
          currentItem.cost = costInDesc

        const locInDesc = extractLocationFromText(descText)
        if (locInDesc && !currentItem.location)
          currentItem.location = locInDesc

        const linkInDesc = extractLinkFromText(descText)
        if (linkInDesc && !currentItem.link)
          currentItem.link = linkInDesc

        if (currentItem.description) {
          currentItem.description += `\n${descText}`
        }
        else {
          currentItem.description = descText
        }
      }
    }
  }

  // Filter out any empty groups that contain no tasks
  const populatedGroups = groups.filter(g => items.some(i => i.groupId === g.id))

  // Only retain tabs that actually have items
  const populatedTabs = tabs.filter(t => items.some(i => i.type === t.id))
  if (populatedTabs.length === 0) {
    populatedTabs.push({ id: 'preparation', name: 'Подготовка и сборы', icon: 'mdi:briefcase-check-outline', isCustom: false })
  }

  return {
    tabs: populatedTabs,
    groups: populatedGroups,
    items,
  }
}

// -----------------------------------------------------------------------------
// Helper: Parse Finances from Obsidian "04 - Финансы/Финансы.md"
// -----------------------------------------------------------------------------
export function parseObsidianFinances(financesFilePath?: string): FinancesSectionContent {
  const defaultCategories: FinanceCategory[] = [
    { id: 'cat-housing', name: 'Жильё', icon: 'mdi:bed', isDefault: true },
    { id: 'cat-transport', name: 'Транспорт', icon: 'mdi:train-car', isDefault: true },
    { id: 'cat-flights', name: 'Авиабилеты', icon: 'mdi:airplane', isDefault: true },
    { id: 'cat-food', name: 'Еда и напитки', icon: 'mdi:food-fork-drink', isDefault: true },
    { id: 'cat-entertainment', name: 'Развлечения', icon: 'mdi:party-popper', isDefault: true },
    { id: 'cat-shopping', name: 'Покупки', icon: 'mdi:shopping-outline', isDefault: true },
    { id: 'cat-other', name: 'Прочее', icon: 'mdi:dots-horizontal-circle-outline', isDefault: true },
  ]

  const settings = {
    mainCurrency: 'RUB',
    exchangeRates: { TWD: 2.8, USD: 90, EUR: 100, CNY: 12.5 },
  }

  if (!financesFilePath || !existsSync(financesFilePath)) {
    return {
      settings,
      categories: defaultCategories,
      transactions: [],
    }
  }

  const content = readFileSync(financesFilePath, 'utf-8')
  const transactions: FinanceTransaction[] = []
  const lines = content.split('\n')
  let currentCategory = 'cat-other'

  for (const line of lines) {
    const trimmed = line.trim()

    // Detect section category from headers
    if (/###\s*\d*\.?\s*✈️|авиаперелет/i.test(trimmed)) {
      currentCategory = 'cat-flights'
    }
    else if (/###\s*\d*\.?\s*🚗|🚄|поезд|транспорт|логистик/i.test(trimmed)) {
      currentCategory = 'cat-transport'
    }
    else if (/###\s*\d*\.?\s*🏨|проживани|отел|гостиниц/i.test(trimmed)) {
      currentCategory = 'cat-housing'
    }
    else if (/###\s*\d*\.?\s*🍜|питани|еда|ресторан|ночной рынок/i.test(trimmed)) {
      currentCategory = 'cat-food'
    }
    else if (/###\s*\d*\.?\s*🎟️|входн|билет|активност|экскурси/i.test(trimmed)) {
      currentCategory = 'cat-entertainment'
    }
    else if (/###\s*\d*\.?\s*🎁|сувенир|шопинг|покупк|чай/i.test(trimmed)) {
      currentCategory = 'cat-shopping'
    }

    // Markdown Table Row parser
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && !trimmed.includes('---') && !/подитог|итого/i.test(trimmed)) {
      const cols = trimmed.slice(1, -1).split('|').map(c => c.trim())
      if (cols.length >= 2) {
        const titleCol = cols[0]
        const amountCol = cols.find(c => /`?[\d\s]+[–—\-]?[\d\s]*\s*(?:₽|RUB|TWD|\$|EUR)/i.test(c))
        const notesCol = cols.length >= 3 ? cols.slice(2).join('; ') : undefined

        if (amountCol && titleCol && !/статья|маршрут|тип поезда|сегмент|направление/i.test(titleCol)) {
          const numMatch = amountCol.replace(/\s+/g, '').match(/(\d+)/)
          if (numMatch) {
            const amount = Number.parseInt(numMatch[1], 10)
            if (amount > 0) {
              const cleanTitle = titleCol.replace(/[*_`]/g, '').trim()
              let cat = currentCategory
              if (/авиа|перелет/i.test(cleanTitle))
                cat = 'cat-flights'
              else if (/thsr|tra|поезд|паром|автобус|байк|такси|трансфер|машин|easycard/i.test(cleanTitle))
                cat = 'cat-transport'
              else if (/отел|проживан|b&b|номер|ноч/i.test(cleanTitle))
                cat = 'cat-housing'

              transactions.push({
                id: crypto.randomUUID(),
                title: cleanTitle,
                amount,
                currency: 'RUB',
                categoryId: cat,
                notes: notesCol ? notesCol.replace(/[*_`]/g, '').trim() : undefined,
              })
            }
          }
        }
      }
    }

    // Parse bullets for Hotels if not in tables (e.g. `* *Тайбэй (Morwing Hotel, 4н):* 12 732 ₽`)
    if (/^\s*[-*]\s*\*(?:[^*]+)\*:\s*`?([\d\s]+)\s*₽/i.test(trimmed)) {
      const match = trimmed.match(/^\s*[-*]\s*\*([^*]+)\*:\s*`?([\d\s]+)\s*₽/i)
      if (match) {
        const title = match[1].trim()
        const amount = Number.parseInt(match[2].replace(/\s+/g, ''), 10)
        if (amount > 0) {
          transactions.push({
            id: crypto.randomUUID(),
            title: `Отель: ${title}`,
            amount,
            currency: 'RUB',
            categoryId: 'cat-housing',
          })
        }
      }
    }
    // Parse bullets for food/activities/souvenirs (e.g. `* **Завтраки в 7-Eleven (22 дня):** ... ➔ ~4 400 ₽`)
    else if (/^\s*[-*]\s*\*\*([^*]+)\*\*:[^➔\n]+➔\s*`?~?([\d\s]+)\s*₽/i.test(trimmed)) {
      const match = trimmed.match(/^\s*[-*]\s*\*\*([^*]+)\*\*:[^➔\n]+➔\s*`?~?([\d\s]+)\s*₽/i)
      if (match) {
        const title = match[1].trim()
        const amount = Number.parseInt(match[2].replace(/\s+/g, ''), 10)
        if (amount > 0) {
          let cat = currentCategory
          if (/завтрак|обед|ужин|питани|стритфуд/i.test(title))
            cat = 'cat-food'
          else if (/билет|парк|тур|снорклинг|музе/i.test(title))
            cat = 'cat-entertainment'
          else if (/чай|пирожн|сувенир/i.test(title))
            cat = 'cat-shopping'

          transactions.push({
            id: crypto.randomUUID(),
            title,
            amount,
            currency: 'RUB',
            categoryId: cat,
          })
        }
      }
    }
  }

  // Fallback: If no granular transactions were parsed from tables, parse high-level summary from > [!summary]
  if (transactions.length === 0) {
    const summaryMatch = content.match(/>\s*-\s*([^\n:]+):\s*`?~?([\d\s]+)\s*₽`?/g)
    if (summaryMatch) {
      for (const item of summaryMatch) {
        const parsed = item.match(/>\s*-\s*([^\n:]+):\s*`?~?([\d\s]+)\s*₽/i)
        if (parsed) {
          const title = parsed[1].replace(/[*_`]/g, '').trim()
          const amount = Number.parseInt(parsed[2].replace(/\s+/g, ''), 10)
          let cat = 'cat-other'
          if (/авиа/i.test(title))
            cat = 'cat-flights'
          else if (/проживан|отел/i.test(title))
            cat = 'cat-housing'
          else if (/транспорт|поезд|паром/i.test(title))
            cat = 'cat-transport'
          else if (/питани|еда/i.test(title))
            cat = 'cat-food'
          else if (/билет|активност/i.test(title))
            cat = 'cat-entertainment'
          else if (/сувенир|подарк/i.test(title))
            cat = 'cat-shopping'

          transactions.push({
            id: crypto.randomUUID(),
            title,
            amount,
            currency: 'RUB',
            categoryId: cat,
          })
        }
      }
    }
  }

  return {
    settings,
    categories: defaultCategories,
    transactions,
  }
}

// -----------------------------------------------------------------------------
// Obsidian Full Vault Parser
// -----------------------------------------------------------------------------
export function parseObsidianTripFolder(tripPath: string, startDateStr?: string): ParsedTripData {
  const resolvedPath = resolve(tripPath)
  if (!existsSync(resolvedPath)) {
    throw new Error(`Папка путешествия не найдена: ${resolvedPath}`)
  }

  const folderName = basename(resolvedPath).replace(/^--\s*/, '').trim()
  const entries = readdirSync(resolvedPath, { withFileTypes: true })

  let conceptContent = ''
  let summaryContent = ''
  let extractedTitle = folderName
  const rootNotes: ParsedNoteFile[] = []

  // 1. Scan root directory files
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const filePath = join(resolvedPath, entry.name)
      const content = readFileSync(filePath, 'utf-8')
      const fileNameWithoutExt = entry.name.replace(/\.md$/, '')

      if (entry.name.toLowerCase().includes(folderName.toLowerCase()) || fileNameWithoutExt === folderName || entries.length <= 6) {
        if (!conceptContent) {
          conceptContent = content
        }
      }

      rootNotes.push({
        title: fileNameWithoutExt,
        fileName: entry.name,
        filePath,
        content,
      })
    }
  }

  // 2. Discover day files in "02 - Маршрутный план" or subdirectories
  const planDirNames = ['02 - Маршрутный план', 'Маршрутный план', '02 - Plan', 'Plan', 'Days', '02 - Дни']
  let daysDirPath = ''

  for (const name of planDirNames) {
    const checkPath = join(resolvedPath, name)
    if (existsSync(checkPath) && statSync(checkPath).isDirectory()) {
      daysDirPath = checkPath
      break
    }
  }

  if (!daysDirPath) {
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDirPath = join(resolvedPath, entry.name)
        const subFiles = readdirSync(subDirPath)
        if (subFiles.some(f => /^(?:\d{1,2}|day|день)/i.test(f) && f.endsWith('.md'))) {
          daysDirPath = subDirPath
          break
        }
      }
    }
  }

  const parsedDays: ParsedDay[] = []
  const startDate = startDateStr ? new Date(startDateStr) : new Date()

  if (daysDirPath) {
    const dayFiles = readdirSync(daysDirPath).filter(f => f.endsWith('.md'))

    for (const fileName of dayFiles) {
      const filePath = join(daysDirPath, fileName)
      const content = readFileSync(filePath, 'utf-8')
      const fileNameWithoutExt = fileName.replace(/\.md$/, '')

      if (fileNameWithoutExt === 'Маршрутный план' || fileNameWithoutExt.toLowerCase() === 'plan') {
        summaryContent = content
        continue
      }

      const dayNumberMatch = fileName.match(/^(?:0*(\d{1,2}))|(?:[дd](\d{1,2}))|(?:day\s*(\d{1,2}))/i)
      const dayNumber = dayNumberMatch
        ? Number.parseInt(dayNumberMatch[1] || dayNumberMatch[2] || dayNumberMatch[3], 10)
        : (parsedDays.length + 1)

      let title = fileNameWithoutExt.replace(/^\d{1,2}\s*/, '').trim()
      if (!title) {
        title = `День ${dayNumber}`
      }

      let dayDescription = ''
      const expectMatch = content.match(/##\s*[^\n]*Чего ожидать от дня\s*\n+([^#\n]+)/i)
      if (expectMatch) {
        dayDescription = expectMatch[1].trim()
      }
      else {
        const firstPara = content.split('\n').find(l => l.trim() && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('-') && !l.startsWith('*'))
        if (firstPara) {
          dayDescription = firstPara.trim().slice(0, 150)
        }
      }

      const dayDate = new Date(startDate)
      dayDate.setDate(dayDate.getDate() + (dayNumber - 1))
      const dateStr = dayDate.toISOString().split('T')[0]

      parsedDays.push({
        dayNumber,
        fileName,
        filePath,
        title,
        description: dayDescription,
        rawContent: content,
        date: dateStr,
      })
    }
  }

  parsedDays.sort((a, b) => a.dayNumber - b.dayNumber)

  // 3. Scan Section Folders ("01 - Заметки", "03 - Бронирования", "04 - Финансы", "05 - Полезная информация", "06 - Чек лист")
  const sectionFolders: ParsedNoteFolder[] = []
  const checklistFiles: string[] = []
  let financesFilePath: string | undefined

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === basename(daysDirPath) || entry.name.startsWith('.') || entry.name === '_' || entry.name === 'attachments') {
        continue
      }

      const folderPath = join(resolvedPath, entry.name)
      const filesInFolder = readdirSync(folderPath).filter(f => f.endsWith('.md'))
      const folderNotes: ParsedNoteFile[] = []

      for (const fileName of filesInFolder) {
        const filePath = join(folderPath, fileName)
        const content = readFileSync(filePath, 'utf-8')
        folderNotes.push({
          title: fileName.replace(/\.md$/, ''),
          fileName,
          filePath,
          content,
        })

        // Collect checklist files for rich checklist section
        if (/06|чек|checklist|сборы|must-try|must-buy/i.test(entry.name) || /чек|checklist|сборы|must-try|must-buy/i.test(fileName)) {
          checklistFiles.push(filePath)
        }

        // Collect finances file
        if (/04|финанс|finance|budget|бюджет/i.test(entry.name) || /финанс|finance|budget|бюджет/i.test(fileName)) {
          financesFilePath = filePath
        }
      }

      sectionFolders.push({
        folderName: entry.name,
        folderPath,
        files: folderNotes,
      })
    }
  }

  // Sort sectionFolders numerically/alphabetically (01 - Заметки, 03 - Бронирования, 04 - Финансы, 05 - Полезная информация, 06 - Чек лист)
  sectionFolders.sort((a, b) => a.folderName.localeCompare(b.folderName, undefined, { numeric: true }))

  // 4. Parse Checklists & Finances into Rich Structures
  const checklistContent = parseObsidianChecklists(checklistFiles)
  const financesContent = parseObsidianFinances(financesFilePath)

  // 5. Extract title, short description, cities, tags from concept/summary
  const mainText = conceptContent || summaryContent || ''

  const titleMatch = mainText.match(/^#\s*(?:Концепция маршрута:\s*)?[«"']?([^»"'\n(]+)[»"']?/m)
  if (titleMatch && titleMatch[1].trim()) {
    extractedTitle = titleMatch[1].trim()
  }

  // Extract cities
  const citiesSet = new Set<string>()
  const cityRegex = /(?:Куала-Лумпур|Тайбэй|Цзюфэнь|Пинси|Тайчжун|Жиюэтань|Тайнань|Гаосюн|Хуалянь|Тароко|Сингапур|Сеул|Пусан|Чеджу|Шанхай|Пекин|Чжанцзяцзе|Гуанчжоу|Гонконг|Токио|Киото|Осака|Бангкок|Пхукет|Алтай|Мурманск)/gi
  const foundCities = mainText.match(cityRegex) || []
  for (const city of foundCities) {
    citiesSet.add(city.trim())
  }
  const cities = Array.from(citiesSet).slice(0, 10)

  // Extract tags
  const tagsSet = new Set<string>()
  if (/малайзи/i.test(mainText))
    tagsSet.add('Малайзия')
  if (/тайван/i.test(mainText))
    tagsSet.add('Тайвань')
  if (/сингапур/i.test(mainText))
    tagsSet.add('Сингапур')
  if (/коре/i.test(mainText))
    tagsSet.add('Корея')
  if (/кита/i.test(mainText))
    tagsSet.add('Китай')
  if (/япони/i.test(mainText))
    tagsSet.add('Япония')
  if (/таиланд|тайланд/i.test(mainText))
    tagsSet.add('Таиланд')
  if (/росси/i.test(mainText))
    tagsSet.add('Россия')
  if (/ази/i.test(mainText))
    tagsSet.add('Азия')
  if (/природ|горы|озеро|ущель/i.test(mainText))
    tagsSet.add('Природа')
  if (/мегаполис|небоскреб/i.test(mainText))
    tagsSet.add('Мегаполисы')
  tagsSet.add('Путешествие')

  const tags = Array.from(tagsSet)

  // Extract short description
  let descriptionShort = `${parsedDays.length}-дневное путешествие`
  if (cities.length > 0) {
    descriptionShort += `: ${cities.slice(0, 4).join(', ')}.`
  }

  const descMatch = mainText.match(/>\s*\*\*Концепция:\*\*\s*([^\n]+)/i)
  if (descMatch) {
    descriptionShort = descMatch[1].trim()
  }

  const lastDayDate = new Date(startDate)
  lastDayDate.setDate(lastDayDate.getDate() + Math.max(0, parsedDays.length - 1))
  const endDateStr = lastDayDate.toISOString().split('T')[0]

  return {
    title: extractedTitle,
    description: mainText || `# ${extractedTitle}`,
    descriptionShort,
    cities,
    tags,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDateStr,
    days: parsedDays,
    sectionFolders,
    rootNotes,
    checklistContent,
    checklistFilesCount: checklistFiles.length,
    financesContent,
  }
}

// -----------------------------------------------------------------------------
// API Client (REST & tRPC)
// -----------------------------------------------------------------------------
class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(apiUrl: string) {
    this.baseUrl = apiUrl.replace(/\/+$/, '')
  }

  public setToken(token: string) {
    this.token = token
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    const text = await response.text()
    let data: any
    try {
      data = JSON.parse(text)
    }
    catch {
      data = text
    }

    if (!response.ok) {
      const errorMsg = typeof data === 'object' && data?.message
        ? data.message
        : (typeof data === 'object' && data?.error ? JSON.stringify(data.error) : `HTTP ${response.status}: ${text}`)
      throw new Error(errorMsg)
    }

    return data as T
  }

  // 1. Auth: SignIn
  async signIn(email: string, password: string): Promise<{ accessToken: string, user: any }> {
    try {
      const res = await this.request<any>('/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      if (res?.token?.accessToken) {
        this.setToken(res.token.accessToken)
        return { accessToken: res.token.accessToken, user: res.user }
      }
    }
    catch (err: any) {
      try {
        const trpcRes = await this.request<any>('/trpc/user.signIn', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        const result = trpcRes?.result?.data || trpcRes
        if (result?.token?.accessToken) {
          this.setToken(result.token.accessToken)
          return { accessToken: result.token.accessToken, user: result.user }
        }
      }
      catch {
        // ignore
      }
      throw new Error(`Ошибка авторизации: ${err.message}`)
    }

    throw new Error('Не удалось получить accessToken при входе')
  }

  // 2. Trip Endpoints
  async createTrip(payload: {
    title: string
    description?: string
    startDate?: string
    endDate?: string
  }): Promise<{ id: string, title: string, startDate: string, endDate: string }> {
    return await this.request<any>('/trips', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateTrip(id: string, details: {
    title?: string
    description?: string
    descriptionShort?: string
    cities?: string[]
    tags?: string[]
    status?: 'planned' | 'draft' | 'completed'
    visibility?: 'private' | 'public'
    startDate?: string
    endDate?: string
  }): Promise<any> {
    return await this.request<any>(`/trips/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ id, details }),
    })
  }

  // 3. Trip Sections (Tabs: Bookings, Checklist, Finances, Memories, Notes, Documents)
  async createTripSection(payload: {
    tripId: string
    type: 'bookings' | 'checklist' | 'finances' | 'memories' | 'notes' | 'documents'
    title: string
    icon?: string | null
    content?: any
  }): Promise<any> {
    try {
      return await this.request<any>('/trip-sections', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    }
    catch {
      return await this.request<any>('/trpc/tripSection.create', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    }
  }

  async getDaysByTripId(tripId: string): Promise<Array<{ id: string, date: string, title: string }>> {
    return await this.request<any>(`/days/by-trip/${tripId}`, {
      method: 'GET',
    })
  }

  // 4. Day Endpoints
  async createDay(payload: {
    tripId: string
    title: string
    description?: string | null
    date: string
  }): Promise<{ id: string, title: string }> {
    return await this.request<any>('/days', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateDay(id: string, details: {
    title?: string
    description?: string | null
    note?: string | null
    date?: string
  }): Promise<any> {
    return await this.request<any>(`/days/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ id, details }),
    })
  }

  async generateDayTemplate(dayId: string, payload: {
    prompt: string
    currentActivities: any[]
    canvasNote: string
    daysContext?: any
  }): Promise<ActivityPayload[]> {
    return await this.request<ActivityPayload[]>(`/days/${dayId}/generate-template`, {
      method: 'POST',
      body: JSON.stringify({
        dayId,
        prompt: payload.prompt,
        currentActivities: payload.currentActivities,
        canvasNote: payload.canvasNote,
        daysContext: payload.daysContext,
      }),
    })
  }

  // 5. Activity Endpoints
  async createActivity(payload: {
    dayId: string
    title: string
    startTime: string
    endTime: string
    tag?: string
    sections?: any[]
  }): Promise<any> {
    return await this.request<any>('/activities', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  // 6. Note Endpoints
  async createNote(payload: {
    tripId: string
    parentId?: string | null
    type: 'folder' | 'markdown' | 'excalidraw'
    title: string
    order?: number
    color?: string | null
  }): Promise<{ id: string, title: string, type: string }> {
    return await this.request<any>('/notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateNote(id: string, payload: {
    title?: string
    content?: string | null
    parentId?: string | null
    order?: number
    color?: string | null
  }): Promise<any> {
    return await this.request<any>(`/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ id, ...payload }),
    })
  }
}

// -----------------------------------------------------------------------------
// Main Import Logic
// -----------------------------------------------------------------------------
async function runImport() {
  const cliOptions = parseCliArgs()

  console.log(`\n${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}    🛫 Obsidian ➔ Trip Scheduler Import Tool (Advanced)${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════${colors.reset}\n`)

  // Step 1: Select or enter directory
  let targetDir = cliOptions.dir
  if (!targetDir) {
    const discovered = discoverObsidianTravelFolders()
    if (discovered.length > 0) {
      const choices = [
        ...discovered.map(p => ({
          title: `${basename(p).replace(/^--\s*/, '')} (${p})`,
          value: p,
        })),
        { title: '✍️  Ввести свой путь вручную...', value: '__manual__' },
      ]

      const response = await prompts({
        type: 'select',
        name: 'dir',
        message: 'Выберите папку путешествия для импорта:',
        choices,
      })

      if (response.dir === '__manual__') {
        const manualResponse = await prompts({
          type: 'text',
          name: 'dir',
          message: 'Введите абсолютный путь к папке в Obsidian:',
          validate: value => existsSync(resolve(value)) || 'Папка не существует',
        })
        targetDir = manualResponse.dir
      }
      else {
        targetDir = response.dir
      }
    }
    else {
      const manualResponse = await prompts({
        type: 'text',
        name: 'dir',
        message: 'Введите абсолютный путь к папке в Obsidian:',
        validate: value => existsSync(resolve(value)) || 'Папка не существует',
      })
      targetDir = manualResponse.dir
    }
  }

  if (!targetDir || !existsSync(resolve(targetDir))) {
    console.error(`${colors.red}❌ Указанная папка не найдена: ${targetDir}${colors.reset}`)
    process.exit(1)
  }

  console.log(`${colors.dim}📂 Анализ структуры Obsidian: ${targetDir}...${colors.reset}`)
  const tripData = parseObsidianTripFolder(targetDir, cliOptions.startDate)

  console.log(`\n${colors.bright}📋 Сводка обнаруженного путешествия:${colors.reset}`)
  console.log(`  ${colors.green}•${colors.reset} Название:         ${colors.bright}${tripData.title}${colors.reset}`)
  console.log(`  ${colors.green}•${colors.reset} Города:           ${tripData.cities.join(', ') || '(не определены)'}`)
  console.log(`  ${colors.green}•${colors.reset} Теги:             ${tripData.tags.join(', ')}`)
  console.log(`  ${colors.green}•${colors.reset} Период:           ${tripData.startDate} ➔ ${tripData.endDate} (${tripData.days.length} дн.)`)
  console.log(`  ${colors.green}•${colors.reset} Дней найдено:     ${colors.yellow}${tripData.days.length}${colors.reset}`)
  console.log(`  ${colors.green}•${colors.reset} Чек-листы:        ${colors.yellow}${tripData.checklistContent.items?.length || 0} задач в ${tripData.checklistContent.groups?.length || 0} группах (${tripData.checklistContent.tabs?.length || 0} вкладок)${colors.reset}`)
  console.log(`  ${colors.green}•${colors.reset} Секций заметок:   ${colors.yellow}${tripData.sectionFolders.length}${colors.reset} (${tripData.sectionFolders.map(s => `${s.folderName} [${s.files.length} ф.]`).join(', ')})`)
  console.log(`  ${colors.green}•${colors.reset} Корневых заметок: ${colors.yellow}${tripData.rootNotes.length}${colors.reset}`)

  // Step 2: Interactive Prompt to Select Modules to Import
  let importTripMeta = cliOptions.importTripMeta ?? true
  let importDays = cliOptions.importDays ?? true
  let importActivities = cliOptions.importActivities ?? true
  let importChecklists = cliOptions.importChecklists ?? true
  let importNotes = cliOptions.importNotes ?? true
  let importSections = cliOptions.importSections ?? true
  let useLlm = cliOptions.useLlm

  if (!cliOptions.nonInteractive && cliOptions.importTripMeta === undefined) {
    const modulesResponse = await prompts({
      type: 'multiselect',
      name: 'modules',
      message: 'Выберите, что вы хотите импортировать в Trip Scheduler:',
      choices: [
        { title: '🚀 Путешествие (Название, описание, даты, города, теги)', value: 'tripMeta', selected: true },
        { title: `📅 Дни маршрута (${tripData.days.length} дн. из «02 - Маршрутный план»)`, value: 'days', selected: true },
        { title: '🧩 Блоки активностей (расписание по часам, теги, секции)', value: 'activities', selected: true },
        { title: `✅ Интерактивные Чек-листы (${tripData.checklistContent.items?.length || 0} задач: Сборы, Must-Try, Must-Buy)`, value: 'checklists', selected: true },
        { title: `📚 База знаний и заметки (01 - Заметки, 05 - Полезная информация, концепция)`, value: 'notes', selected: true },
        { title: '📑 Дополнительные вкладки (Бронирования, Финансы, Документы, Воспоминания)', value: 'sections', selected: true },
      ],
      hint: '- Пробел для выбора, Enter для подтверждения',
    })

    if (!modulesResponse.modules || modulesResponse.modules.length === 0) {
      console.log(`${colors.yellow}Ни один модуль не выбран для импорта. Завершение.${colors.reset}`)
      return
    }

    const selectedModules = new Set(modulesResponse.modules)
    importTripMeta = selectedModules.has('tripMeta')
    importDays = selectedModules.has('days')
    importActivities = selectedModules.has('activities')
    importChecklists = selectedModules.has('checklists')
    importNotes = selectedModules.has('notes')
    importSections = selectedModules.has('sections')

    // If activities are selected, ask about LLM vs Local Parser
    if (importActivities) {
      const modeResponse = await prompts({
        type: 'select',
        name: 'generationMode',
        message: 'Способ генерации активностей для дней маршрута:',
        choices: [
          { title: '🤖 Умный LLM (AI расписание по часам, теги и секции) [OpenAI / HubMix / Сервер]', value: 'llm' },
          { title: '⚡ Быстрый локальный парсер (по таймлайну и секциям Markdown)', value: 'parser' },
        ],
      })
      useLlm = modeResponse.generationMode === 'llm'
    }
  }

  if (cliOptions.dryRun) {
    console.log(`\n${colors.yellow}🔍 [DRY-RUN] Режим предпросмотра включен. Запросы к API отправляться не будут.${colors.reset}`)
    console.log(`\n${colors.bright}Выбранные модули:${colors.reset}`)
    console.log(`  • Путешествие:    ${importTripMeta ? colors.green + 'Да' : colors.red + 'Нет'}${colors.reset}`)
    console.log(`  • Дни маршрута:   ${importDays ? colors.green + 'Да' : colors.red + 'Нет'}${colors.reset}`)
    console.log(`  • Активности:     ${importActivities ? colors.green + `Да (${useLlm ? 'LLM' : 'Парсер'})` : colors.red + 'Нет'}${colors.reset}`)
    console.log(`  • Чек-листы:      ${importChecklists ? colors.green + `Да (${tripData.checklistContent.items?.length} задач)` : colors.red + 'Нет'}${colors.reset}`)
    console.log(`  • Заметки:        ${importNotes ? colors.green + `Да (${tripData.sectionFolders.length} папок)` : colors.red + 'Нет'}${colors.reset}`)
    console.log(`  • Разделы:        ${importSections ? colors.green + 'Да' : colors.red + 'Нет'}${colors.reset}`)

    if (importChecklists) {
      console.log(`\n${colors.bright}📋 Чек-листы, которые будут загружены:${colors.reset}`)
      tripData.checklistContent.tabs?.forEach((t) => {
        const tabGroups = (tripData.checklistContent.groups || []).filter(g => g.type === t.id)
        const tabItems = (tripData.checklistContent.items || []).filter(i => i.type === t.id)
        console.log(`  ${colors.cyan}[Вкладка: ${t.name}]${colors.reset} (${tabGroups.length} групп, ${tabItems.length} задач)`)
      })
    }

    console.log(`\n${colors.green}✅ Предпросмотр завершен.${colors.reset}\n`)
    return
  }

  // Get credentials
  let email = cliOptions.email || process.env.TRIP_EMAIL || process.env.DEV_EMAIL
  let password = cliOptions.password || process.env.TRIP_PASSWORD || process.env.DEV_PASSWORD

  if (!email) {
    const response = await prompts({
      type: 'text',
      name: 'email',
      message: 'Введите Email для входа:',
      initial: 'dev@dev.dev',
    })
    email = response.email
  }

  if (!password) {
    const response = await prompts({
      type: 'password',
      name: 'password',
      message: 'Введите Пароль:',
    })
    password = response.password
  }

  if (!email || !password) {
    console.error(`${colors.red}❌ Email и пароль обязательны для входа${colors.reset}`)
    process.exit(1)
  }

  const api = new ApiClient(cliOptions.apiUrl)

  // 1. Sign-In
  console.log(`\n${colors.dim}🔐 Выполняю вход на ${cliOptions.apiUrl}...${colors.reset}`)
  try {
    const authResult = await api.signIn(email, password)
    console.log(`${colors.green}✅ Успешная авторизация!${colors.reset} Пользователь: ${colors.bright}${authResult.user?.name || authResult.user?.email || email}${colors.reset}`)
  }
  catch (err: any) {
    console.error(`${colors.red}❌ Ошибка авторизации: ${err.message}${colors.reset}`)
    process.exit(1)
  }

  // 2. Create Trip
  console.log(`\n${colors.dim}🚀 Создание путешествия «${tripData.title}»...${colors.reset}`)
  let createdTrip: any
  try {
    createdTrip = await api.createTrip({
      title: tripData.title,
      description: tripData.description,
      startDate: tripData.startDate,
      endDate: tripData.endDate,
    })
    console.log(`${colors.green}✅ Путешествие создано!${colors.reset} ID: ${colors.yellow}${createdTrip.id}${colors.reset}`)

    if (importTripMeta) {
      await api.updateTrip(createdTrip.id, {
        descriptionShort: tripData.descriptionShort,
        cities: tripData.cities,
        tags: tripData.tags,
        status: cliOptions.status,
        visibility: cliOptions.visibility,
      })
    }
  }
  catch (err: any) {
    console.error(`${colors.red}❌ Ошибка при создании путешествия: ${err.message}${colors.reset}`)
    process.exit(1)
  }

  const tripId = createdTrip.id

  // 3. Create all Trip Sections (Tabs) with populated Rich Checklist
  console.log(`\n${colors.dim}📑 Создание разделов путешествия...${colors.reset}`)
  for (const sec of DEFAULT_TRIP_SECTIONS) {
    try {
      let sectionContent: any = {}

      // If Checklist section and user wants to import checklists, pass parsed content
      if (sec.type === 'checklist' && importChecklists) {
        sectionContent = tripData.checklistContent
      }
      else if (sec.type === 'finances') {
        sectionContent = {
          settings: {
            mainCurrency: 'RUB',
            exchangeRates: { TWD: 2.8, USD: 90, EUR: 100, CNY: 12.5 },
          },
          categories: [
            { id: 'cat-housing', name: 'Жильё', icon: 'mdi:bed', isDefault: true },
            { id: 'cat-transport', name: 'Транспорт', icon: 'mdi:train-car', isDefault: true },
            { id: 'cat-flights', name: 'Авиабилеты', icon: 'mdi:airplane', isDefault: true },
            { id: 'cat-food', name: 'Еда и напитки', icon: 'mdi:food-fork-drink', isDefault: true },
            { id: 'cat-entertainment', name: 'Развлечения', icon: 'mdi:party-popper', isDefault: true },
            { id: 'cat-shopping', name: 'Покупки', icon: 'mdi:shopping-outline', isDefault: true },
            { id: 'cat-other', name: 'Прочее', icon: 'mdi:dots-horizontal-circle-outline', isDefault: true },
          ],
          transactions: [],
        }
      }

      await api.createTripSection({
        tripId,
        type: sec.type,
        title: sec.title,
        icon: sec.icon,
        content: sectionContent,
      })

      if (sec.type === 'checklist' && importChecklists) {
        console.log(`  ${colors.green}✓${colors.reset} Раздел ${colors.bright}«${sec.title}»${colors.reset} создан с ${colors.yellow}${tripData.checklistContent.items?.length || 0}${colors.reset} задачами и ${colors.yellow}${tripData.checklistContent.tabs?.length || 0}${colors.reset} вкладками`)
      }
      else {
        console.log(`  ${colors.green}✓${colors.reset} Раздел создан: ${colors.bright}${sec.title}${colors.reset}`)
      }
    }
    catch (secErr: any) {
      console.warn(`  ${colors.yellow}⚠ Раздел "${sec.title}": ${secErr.message}${colors.reset}`)
    }
  }

  // 4. Create / Sync Days
  const dayIdMap = new Map<number, string>()

  if (importDays) {
    console.log(`\n${colors.dim}📅 Создание дней маршрута (${tripData.days.length} дн.)...${colors.reset}`)
    const existingDays = await api.getDaysByTripId(tripId)

    for (let i = 0; i < tripData.days.length; i++) {
      const day = tripData.days[i]
      let dayId: string

      if (i === 0 && existingDays.length > 0) {
        dayId = existingDays[0].id
        await api.updateDay(dayId, {
          title: day.title,
          description: day.description,
          note: day.rawContent,
          date: day.date,
        })
      }
      else {
        const newDay = await api.createDay({
          tripId,
          title: day.title,
          description: day.description,
          date: day.date,
        })
        dayId = newDay.id

        await api.updateDay(dayId, {
          note: day.rawContent,
        })
      }

      dayIdMap.set(day.dayNumber, dayId)
      process.stdout.write(`${colors.cyan}  ✓ День ${day.dayNumber}: ${day.title} (${day.date})${colors.reset}\n`)
    }
  }

  // 5. Generate & Create Activities (Blocks) for each day
  if (importActivities && importDays) {
    console.log(`\n${colors.dim}🧩 Генерация и добавление блоков активностей...${colors.reset}`)

    for (const day of tripData.days) {
      const dayId = dayIdMap.get(day.dayNumber)
      if (!dayId)
        continue

      console.log(`\n${colors.bright}  [День ${day.dayNumber}] ${day.title}:${colors.reset}`)

      let activitiesToCreate: ActivityPayload[] = []

      if (useLlm) {
        // 1. Try server LLM endpoint
        try {
          process.stdout.write(`    ${colors.dim}🤖 Запрос к LLM на сервере...${colors.reset} `)
          const generated = await api.generateDayTemplate(dayId, {
            prompt: 'Преобразуй этот план дня в структурированные блоки расписания (активности) с точным временем начала и конца, тегами и подробными секциями с описанием.',
            currentActivities: [],
            canvasNote: day.rawContent,
          })

          if (Array.isArray(generated) && generated.length > 0) {
            activitiesToCreate = generated
            process.stdout.write(`${colors.green}OK (получено ${generated.length} блоков)${colors.reset}\n`)
          }
          else {
            throw new Error('Пустой ответ от сервера')
          }
        }
        catch (serverLlmErr: any) {
          // 2. Try Direct LLM via HubMix/OpenAI if available
          process.stdout.write(`${colors.yellow}Серверный LLM: ${serverLlmErr.message}${colors.reset}\n`)

          const directLlmKey = process.env.AI_HUBMIX_KEY || process.env.OPENAI_API_KEY
          if (directLlmKey) {
            process.stdout.write(`    ${colors.dim}🤖 Запрос к прямому LLM (HubMix/OpenAI)...${colors.reset} `)
            const directGenerated = await generateActivitiesViaDirectLlm(day.rawContent)
            if (directGenerated && directGenerated.length > 0) {
              activitiesToCreate = directGenerated
              process.stdout.write(`${colors.green}OK (получено ${directGenerated.length} блоков)${colors.reset}\n`)
            }
            else {
              process.stdout.write(`${colors.yellow}использую встроенный парсер${colors.reset}\n`)
              activitiesToCreate = parseActivitiesFromMarkdown(day.rawContent)
            }
          }
          else {
            process.stdout.write(`    ${colors.dim}⚙️  Использую встроенный парсер таймлайна...${colors.reset}\n`)
            activitiesToCreate = parseActivitiesFromMarkdown(day.rawContent)
          }
        }
      }
      else {
        activitiesToCreate = parseActivitiesFromMarkdown(day.rawContent)
      }

      // Create activities in DB
      for (const act of activitiesToCreate) {
        try {
          await api.createActivity({
            dayId,
            title: act.title,
            startTime: act.startTime,
            endTime: act.endTime,
            tag: act.tag,
            sections: act.sections || [],
          })
          console.log(`    ${colors.green}+${colors.reset} [${act.startTime}–${act.endTime}] [${act.tag}] ${act.title}`)
        }
        catch (actErr: any) {
          console.warn(`    ${colors.red}⚠ Ошибка при создании активности "${act.title}": ${actErr.message}${colors.reset}`)
        }
      }
    }
  }

  // 6. Add Section Folders & Notes into Trip Notes ("01 - Заметки", "05 - Полезная информация", etc.)
  if (importNotes) {
    console.log(`\n${colors.dim}📚 Добавление заметок и базы знаний в раздел «Заметки»...${colors.reset}`)

    let noteOrder = 0

    // 6.1 Root notes (e.g. Concept file and Summary plan)
    for (const rootNote of tripData.rootNotes) {
      try {
        const noteRecord = await api.createNote({
          tripId,
          type: 'markdown',
          title: rootNote.title,
          order: noteOrder++,
        })
        await api.updateNote(noteRecord.id, {
          title: rootNote.title,
          content: rootNote.content,
        })
        console.log(`  ${colors.green}📄${colors.reset} Корневая заметка: ${colors.bright}${rootNote.title}${colors.reset}`)
      }
      catch (err: any) {
        console.warn(`  ${colors.red}⚠ Ошибка при создании заметки "${rootNote.title}": ${err.message}${colors.reset}`)
      }
    }

    // 6.2 Folders & their files (e.g. "01 - Заметки", "05 - Полезная информация", "03 - Бронирования", "04 - Финансы")
    for (const sectionFolder of tripData.sectionFolders) {
      try {
        const folderRecord = await api.createNote({
          tripId,
          type: 'folder',
          title: sectionFolder.folderName,
          order: noteOrder++,
        })
        console.log(`\n  ${colors.yellow}📁${colors.reset} Папка: ${colors.bright}${sectionFolder.folderName}${colors.reset}`)

        let fileOrder = 0
        for (const noteFile of sectionFolder.files) {
          try {
            const fileRecord = await api.createNote({
              tripId,
              parentId: folderRecord.id,
              type: 'markdown',
              title: noteFile.title,
              order: fileOrder++,
            })
            await api.updateNote(fileRecord.id, {
              title: noteFile.title,
              content: noteFile.content,
            })
            console.log(`    ${colors.green}└─ 📄${colors.reset} ${noteFile.title} (${Math.round(noteFile.content.length / 1024)} KB)`)
          }
          catch (fileErr: any) {
            console.warn(`    ${colors.red}⚠ Ошибка при создании файла "${noteFile.title}": ${fileErr.message}${colors.reset}`)
          }
        }
      }
      catch (folderErr: any) {
        console.warn(`  ${colors.red}⚠ Ошибка при создании папки "${sectionFolder.folderName}": ${folderErr.message}${colors.reset}`)
      }
    }
  }

  console.log(`\n${colors.bright}${colors.green}════════════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.bright}${colors.green}🎉 Путешествие успешно импортировано в приложение!${colors.reset}`)
  console.log(`${colors.bright}${colors.green}════════════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`  ${colors.cyan}•${colors.reset} ID путешествия:       ${colors.bright}${tripId}${colors.reset}`)
  console.log(`  ${colors.cyan}•${colors.reset} Название:             ${colors.bright}${tripData.title}${colors.reset}`)
  console.log(`  ${colors.cyan}•${colors.reset} Дней маршрута:        ${importDays ? tripData.days.length : 0}`)
  console.log(`  ${colors.cyan}•${colors.reset} Задач в чек-листе:    ${importChecklists ? (tripData.checklistContent.items?.length || 0) : 0}`)
  console.log(`  ${colors.cyan}•${colors.reset} Папок в заметках:     ${importNotes ? tripData.sectionFolders.length : 0}`)
  console.log(`  ${colors.cyan}•${colors.reset} Ссылка в приложении:  ${colors.blue}http://localhost:1420/trips/${tripId}${colors.reset}\n`)
}

// Run script
runImport().catch((error) => {
  console.error(`\n${colors.red}💥 Непредвиденная ошибка:${colors.reset}`, error)
  process.exit(1)
})
