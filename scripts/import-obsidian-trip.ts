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
    title: 'Чек-лист',
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
  -h, --help               Показать справку

${colors.yellow}Примеры:${colors.reset}
  bun run scripts/import-obsidian-trip.ts "/home/injurka/Documents/obsidian-mark/Personal Note/Travel/-- Kuala Lumpur & Taiwan"
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
    ? ['gemini-flash-latest', 'gemini-flash-lite-latest', 'baidu-deepseek-v4-flash']
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
// Obsidian Parser
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

  // 3. Scan Section Folders ("01 - Заметки", "03 - Бронирования", "04 - Финансы", etc.)
  const sectionFolders: ParsedNoteFolder[] = []
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
      }

      sectionFolders.push({
        folderName: entry.name,
        folderPath,
        files: folderNotes,
      })
    }
  }

  // 4. Extract title, short description, cities, tags from concept/summary
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
  console.log(`${colors.bright}${colors.cyan}    🛫 Obsidian ➔ Trip Scheduler Import Tool${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════${colors.reset}\n`)

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
  console.log(`  ${colors.green}•${colors.reset} Секций заметок:   ${colors.yellow}${tripData.sectionFolders.length}${colors.reset} (${tripData.sectionFolders.map(s => `${s.folderName} [${s.files.length} ф.]`).join(', ')})`)
  console.log(`  ${colors.green}•${colors.reset} Корневых заметок: ${colors.yellow}${tripData.rootNotes.length}${colors.reset}`)

  if (cliOptions.dryRun) {
    console.log(`\n${colors.yellow}🔍 [DRY-RUN] Режим предпросмотра включен. Запросы к API отправляться не будут.${colors.reset}`)
    console.log(`\n${colors.bright}📑 Разделы, которые будут созданы:${colors.reset}`)
    for (const sec of DEFAULT_TRIP_SECTIONS) {
      console.log(`  ${colors.cyan}• [${sec.type}] ${sec.title}${colors.reset} (${sec.icon})`)
    }
    console.log(`\n${colors.bright}📅 Обнаруженные дни и блоки:${colors.reset}`)
    for (const day of tripData.days) {
      const activities = parseActivitiesFromMarkdown(day.rawContent)
      console.log(`\n  ${colors.cyan}День ${day.dayNumber}: ${day.title} (${day.date})${colors.reset}`)
      console.log(`  Описание: ${day.description || '(нет)'}`)
      console.log(`  Блоков расписания найдено: ${activities.length}`)
      for (const act of activities) {
        console.log(`    [${act.startTime} - ${act.endTime}] [${act.tag}] ${act.title}`)
      }
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

    await api.updateTrip(createdTrip.id, {
      descriptionShort: tripData.descriptionShort,
      cities: tripData.cities,
      tags: tripData.tags,
      status: cliOptions.status,
      visibility: cliOptions.visibility,
    })
  }
  catch (err: any) {
    console.error(`${colors.red}❌ Ошибка при создании путешествия: ${err.message}${colors.reset}`)
    process.exit(1)
  }

  const tripId = createdTrip.id

  // 3. Create all Trip Sections (Tabs: Bookings, Checklist, Finances, Memories, Notes, Documents)
  console.log(`\n${colors.dim}📑 Создание разделов путешествия...${colors.reset}`)
  for (const sec of DEFAULT_TRIP_SECTIONS) {
    try {
      await api.createTripSection({
        tripId,
        type: sec.type,
        title: sec.title,
        icon: sec.icon,
        content: {},
      })
      console.log(`  ${colors.green}✓${colors.reset} Раздел создан: ${colors.bright}${sec.title}${colors.reset}`)
    }
    catch (secErr: any) {
      console.warn(`  ${colors.yellow}⚠ Раздел "${sec.title}": ${secErr.message}${colors.reset}`)
    }
  }

  // 4. Create / Sync Days
  console.log(`\n${colors.dim}📅 Создание дней маршрута (${tripData.days.length} дн.)...${colors.reset}`)
  const existingDays = await api.getDaysByTripId(tripId)

  const dayIdMap = new Map<number, string>()

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

  // 5. Generate & Create Activities (Blocks) for each day
  console.log(`\n${colors.dim}🧩 Генерация и добавление блоков активностей...${colors.reset}`)

  for (const day of tripData.days) {
    const dayId = dayIdMap.get(day.dayNumber)
    if (!dayId)
      continue

    console.log(`\n${colors.bright}  [День ${day.dayNumber}] ${day.title}:${colors.reset}`)

    let activitiesToCreate: ActivityPayload[] = []

    if (cliOptions.useLlm) {
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

  // 6. Add Section Folders & Notes into Trip Notes ("01 - Заметки", "03 - Бронирования", "04 - Финансы", etc.)
  console.log(`\n${colors.dim}📚 Добавление заметок и секций в раздел «Заметки»...${colors.reset}`)

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

  // 6.2 Folders & their files
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
          console.log(`    ${colors.green}└─ 📄${colors.reset} ${noteFile.title}`)
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

  console.log(`\n${colors.bright}${colors.green}════════════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.bright}${colors.green}🎉 Путешествие успешно импортировано в приложение!${colors.reset}`)
  console.log(`${colors.bright}${colors.green}════════════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`  ${colors.cyan}•${colors.reset} ID путешествия:  ${colors.bright}${tripId}${colors.reset}`)
  console.log(`  ${colors.cyan}•${colors.reset} Название:        ${colors.bright}${tripData.title}${colors.reset}`)
  console.log(`  ${colors.cyan}•${colors.reset} Дней:            ${tripData.days.length}`)
  console.log(`  ${colors.cyan}•${colors.reset} Разделов (вкладок): ${DEFAULT_TRIP_SECTIONS.length}`)
  console.log(`  ${colors.cyan}•${colors.reset} Папок в заметках: ${tripData.sectionFolders.length}`)
  console.log(`  ${colors.cyan}•${colors.reset} Ссылка на сайт:  ${colors.blue}http://localhost:1420/trips/${tripId}${colors.reset}\n`)
}

// Run script
runImport().catch((error) => {
  console.error(`\n${colors.red}💥 Непредвиденная ошибка:${colors.reset}`, error)
  process.exit(1)
})
