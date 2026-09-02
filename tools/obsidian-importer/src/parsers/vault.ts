import type { ParsedDay, ParsedNoteFile, ParsedNoteFolder, ParsedTripData } from '../types'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { normalizeIframeLineBreaks } from './activity'
import { parseObsidianBookings } from './booking'
import { parseObsidianChecklists } from './checklist'
import { parseDayMetaFromMarkdown } from './day-meta'
import { parseObsidianFinances } from './finances'

export function discoverObsidianTravelFolders(): string[] {
  const home = homedir()
  const candidateDirs = [
    join(home, 'Documents/obsidian-mark/Personal Note/Travel'),
    join(home, 'Documents/Obsidian/Travel'),
    join(home, 'Obsidian/Travel'),
    join(home, 'Documents/Travel'),
  ]

  const discovered: string[] = []

  for (const base of candidateDirs) {
    if (existsSync(base) && statSync(base).isDirectory()) {
      try {
        const entries = readdirSync(base, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            discovered.push(join(base, entry.name))
          }
        }
      }
      catch {
        // ignore errors
      }
    }
  }

  return discovered
}

export function cleanMarkdownFormatting(text: string): string {
  return text
    .replace(/^[\s\uFE00-\uFE0F\u1F300-\u1F9FF\u2600-\u26FF\u2700-\u27BF]+/u, '')
    .replace(/!\[\[[^\]]+\]\]/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\\([*_[\]()])/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractDayDescription(content: string): string {
  if (!content)
    return ''

  const phaseMatch = content.match(/>[ \t]*\*\*(?:Фаза тура|Фаза|Phase):\*\*[ \t]*([^\n]+)/i)
  const highlightMatch = content.match(/>[ \t]*\*\*(?:Ключевой хайлайт|Хайлайт дня|Хайлайты|Хайлайт|Highlight):\*\*[ \t]*([^\n]+)/i)

  const rawPhase = phaseMatch ? cleanMarkdownFormatting(phaseMatch[1]) : ''
  const rawHighlight = highlightMatch ? cleanMarkdownFormatting(highlightMatch[1]) : ''

  if (rawPhase && rawHighlight) {
    const cleanPhase = rawPhase.replace(/[.;,]+$/, '')
    const cleanHighlight = rawHighlight.replace(/[.;,]+$/, '')
    return `${cleanPhase}. ${cleanHighlight}.`
  }
  if (rawPhase) {
    return rawPhase.endsWith('.') ? rawPhase : `${rawPhase}.`
  }
  if (rawHighlight) {
    return rawHighlight.endsWith('.') ? rawHighlight : `${rawHighlight}.`
  }

  // Fallback 1: Explicit expectation / description section
  const expectMatch = content.match(/##\s*(?:\S[^\n]*)?(?:Чего ожидать от дня|Описание дня|Обзор дня|Хайлайты дня)\s*\n([^#\n]+)/i)
  if (expectMatch && expectMatch[1].trim()) {
    const cleaned = cleanMarkdownFormatting(expectMatch[1])
    if (cleaned)
      return cleaned
  }

  // Fallback 2: Title parenthesized subtitle, e.g. # 🗓️ День 01: Четверг (🛬 Перелет за Полярный круг...)
  const titleSubMatch = content.match(/^#[ \t]*(?:🗓️[ \t]*)?День\s*\d+[^(\n]*\(([^)]+)\)/im)
    || content.match(/^##[ \t]*Маршрут:[ \t]*([^\n]+)/im)
  if (titleSubMatch && (titleSubMatch[1] || titleSubMatch[2])) {
    const candidate = cleanMarkdownFormatting(titleSubMatch[1] || titleSubMatch[2])
    if (candidate && candidate.length > 10) {
      return candidate.endsWith('.') ? candidate : `${candidate}.`
    }
  }

  // Fallback 3: First regular paragraph
  const firstPara = content
    .split('\n')
    .map(l => l.trim())
    .find(l => l && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('-') && !l.startsWith('*') && !l.startsWith('---'))
  if (firstPara) {
    return cleanMarkdownFormatting(firstPara).slice(0, 250)
  }

  return ''
}

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

      const rawContent = normalizeIframeLineBreaks(content)
      if (entry.name.toLowerCase().includes(folderName.toLowerCase()) || fileNameWithoutExt === folderName || entries.length <= 6) {
        if (!conceptContent) {
          conceptContent = rawContent
        }
      }

      rootNotes.push({
        title: fileNameWithoutExt,
        fileName: entry.name,
        filePath,
        content: rawContent,
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

      const dayNumberMatch = fileName.match(/^0*(\d{1,2})|[дd](\d{1,2})|day\s*(\d{1,2})/i)
      const dayNumber = dayNumberMatch
        ? Number.parseInt(dayNumberMatch[1] || dayNumberMatch[2] || dayNumberMatch[3], 10)
        : (parsedDays.length + 1)

      let title = fileNameWithoutExt.replace(/^\d{1,2}\s*/, '').trim()
      if (!title) {
        title = `День ${dayNumber}`
      }

      const dayDescription = extractDayDescription(content)

      const dayDate = new Date(startDate)
      dayDate.setDate(dayDate.getDate() + (dayNumber - 1))
      const dateStr = dayDate.toISOString().split('T')[0]

      const rawContent = normalizeIframeLineBreaks(content)
      const dayMeta = parseDayMetaFromMarkdown(rawContent)

      parsedDays.push({
        dayNumber,
        fileName,
        filePath,
        title,
        description: dayDescription,
        rawContent,
        date: dateStr,
        meta: dayMeta,
      })
    }
  }

  parsedDays.sort((a, b) => a.dayNumber - b.dayNumber)

  // 3. Scan Section Folders
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
        const rawContent = normalizeIframeLineBreaks(content)
        folderNotes.push({
          title: fileName.replace(/\.md$/, ''),
          fileName,
          filePath,
          content: rawContent,
        })

        if (/06|чек|checklist|сборы|must-try|must-buy/i.test(entry.name) || /чек|checklist|сборы|must-try|must-buy/i.test(fileName)) {
          checklistFiles.push(filePath)
        }

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

  sectionFolders.sort((a, b) => a.folderName.localeCompare(b.folderName, undefined, { numeric: true }))

  // 4. Parse Checklists, Finances & Bookings into Rich Structures
  const checklistContent = parseObsidianChecklists(checklistFiles)
  const financesContent = parseObsidianFinances(financesFilePath)

  // 5. Extract title, short description, cities, tags from concept/summary
  const mainText = conceptContent || summaryContent || ''

  const titleMatch = mainText.match(/^#\s*(?:Концепция маршрута:\s*)?[«"']?([^»"'\n(]+)[»"']?/m)
  if (titleMatch && titleMatch[1].trim()) {
    extractedTitle = titleMatch[1].trim()
  }

  const cities = extractCities(mainText, parsedDays)
  const tags = extractTags(mainText)
  const descriptionShort = extractShortDescription(mainText, parsedDays, cities)
  const description = extractDetailedDescription(mainText, extractedTitle)

  const lastDayDate = new Date(startDate)
  lastDayDate.setDate(lastDayDate.getDate() + Math.max(0, parsedDays.length - 1))
  const endDateStr = lastDayDate.toISOString().split('T')[0]

  const bookingsContent = parseObsidianBookings(resolvedPath, startDate.toISOString().split('T')[0], endDateStr)

  return {
    title: extractedTitle,
    description,
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
    bookingsContent,
  }
}

export function extractCities(mainText: string, parsedDays: ParsedDay[] = []): string[] {
  const citiesMap = new Map<string, string>()

  const knownCities = [
    'Куала-Лумпур',
    'Тайбэй',
    'Цзюфэнь',
    'Пинси',
    'Тайчжун',
    'Жиюэтань',
    'Тайнань',
    'Гаосюн',
    'Хуалянь',
    'Тароко',
    'Цзяоси',
    'Сингапур',
    'Сеул',
    'Пусан',
    'Чеджу',
    'Кёнджу',
    'Шанхай',
    'Пекин',
    'Чжанцзяцзе',
    'Гуанчжоу',
    'Гонконг',
    'Токио',
    'Киото',
    'Осака',
    'Нара',
    'Хаконэ',
    'Камакура',
    'Хиросима',
    'Миядзима',
    'Химэдзи',
    'Бангкок',
    'Пхукет',
    'Самуи',
    'Чиангмай',
    'Ханой',
    'Дананг',
    'Хошимин',
    'Сапа',
    'Нячанг',
    'Катманду',
    'Покхара',
    'Лима',
    'Куско',
    'Бали',
    'Убуд',
    'Мурманск',
    'Териберка',
    'Саамская деревня',
    'Горно-Алтайск',
    'Чемал',
    'Артыбаш',
    'Акташ',
    'Манжерок',
    'Усть-Сема',
    'Ороктой',
  ]

  for (const city of knownCities) {
    const regex = new RegExp(`(^|[^\\wа-яёА-ЯЁ])${city}(?![\\wа-яёА-ЯЁ])`, 'iu')
    if (regex.test(mainText)) {
      citiesMap.set(city.toLowerCase(), city)
    }
  }

  for (const day of parsedDays) {
    const cleanName = day.fileName.replace(/\.md$/, '')
    const match = cleanName.match(/^\d{1,2}\s+([A-Za-zА-Яа-яЁё0-9\-\s]+?)(?:\s*\(|\s*[\u{1F300}-\u{1FAFF}]|\s*—|\s*[-–]\s*|\s*$)/u)
    if (match) {
      const candidate = match[1].trim()
      if (candidate.length >= 3 && candidate.length <= 30 && !/^(?:день|day|фаза|этап|вылет|прилет)/i.test(candidate)) {
        const knownMatch = knownCities.find(c => c.toLowerCase() === candidate.toLowerCase())
        const normalized = knownMatch || (candidate.charAt(0).toUpperCase() + candidate.slice(1))
        citiesMap.set(normalized.toLowerCase(), normalized)
      }
    }
  }

  // Remove incomplete prefixes if a longer known compound exists (e.g. remove "Горно" if "Горно-Алтайск" exists)
  const resultCities = Array.from(citiesMap.values())
  const filtered = resultCities.filter((c) => {
    return !resultCities.some(other => other !== c && other.toLowerCase().startsWith(`${c.toLowerCase()}-`))
  })

  return filtered.slice(0, 10)
}

export function extractTags(mainText: string): string[] {
  const tagsSet = new Set<string>()

  // Macro-regions and countries with word boundaries
  if (/(?:^|[^а-яёa-z0-9])малайзи[ияею]/i.test(mainText))
    tagsSet.add('Малайзия')
  if (/(?:^|[^а-яёa-z0-9])тайван[ьеяю]/i.test(mainText))
    tagsSet.add('Тайвань')
  if (/(?:^|[^а-яёa-z0-9])сингапур/i.test(mainText))
    tagsSet.add('Сингапур')
  if (/(?:^|[^а-яёa-z0-9])(?:южн[а-яё]+\s+)?коре[еяюий](?:ск[а-яё]*)?(?![а-яёa-z0-9])/i.test(mainText) && !/(?:^|[^а-яёa-z0-9])(?:по)?коренн/i.test(mainText)) {
    tagsSet.add('Корея')
  }
  if (/(?:^|[^а-яёa-z0-9])кита[еяюий](?:ск[а-яё]*)?(?![а-яёa-z0-9])/i.test(mainText))
    tagsSet.add('Китай')
  if (/(?:^|[^а-яёa-z0-9])япони[ияею]/i.test(mainText))
    tagsSet.add('Япония')
  if (/(?:^|[^а-яёa-z0-9])та[ий]ланд/i.test(mainText))
    tagsSet.add('Таиланд')
  if (/(?:^|[^а-яёa-z0-9])вьетнам/i.test(mainText))
    tagsSet.add('Вьетнам')
  if (/(?:^|[^а-яёa-z0-9])индонези[ияею]/i.test(mainText))
    tagsSet.add('Индонезия')
  if (/(?:^|[^а-яёa-z0-9])непал/i.test(mainText))
    tagsSet.add('Непал')
  if (/(?:^|[^а-яёa-z0-9])перу(?![а-яёa-z0-9])/i.test(mainText))
    tagsSet.add('Перу')
  if (/(?:^|[^а-яёa-z0-9])(?:росси[ияею]|российск|мурманск|териберк|алта[йие]|байкал|камчатк|карели)(?![а-яёa-z0-9])/i.test(mainText))
    tagsSet.add('Россия')
  if (/(?:^|[^а-яёa-z0-9])(?:арктик[аеиу]|заполяр[ьея]|полярн[а-яё]+|мурманск|териберк|хибин)/i.test(mainText)) {
    tagsSet.add('Север')
    tagsSet.add('Арктика')
  }
  if (/(?:^|[^а-яёa-z0-9])(?:ази[яеию]|азиатск)(?![а-яёa-z0-9])/i.test(mainText))
    tagsSet.add('Азия')

  // Thematic tags
  if (/(?:^|[^а-яёa-z0-9])(?:природ[аеы]|гор[ыае]|озер[ао]|ущель[ея]|водопад|море|океан|тундр[аеы]|тайг[аеы]|вулкан)/i.test(mainText))
    tagsSet.add('Природа')
  if (/(?:^|[^а-яёa-z0-9])(?:мегаполис|небоскреб|метрополитен)/i.test(mainText))
    tagsSet.add('Мегаполисы')
  if (/(?:^|[^а-яёa-z0-9])(?:культур[аеы]|храм[а-яё]*|музе[йи]|традици[ий]|саам|этно)/i.test(mainText))
    tagsSet.add('Культура')
  if (/(?:^|[^а-яёa-z0-9])(?:гастро|кухн[яеи]|ресторан|деликатес|стритфуд|еж[ией]|краб)/i.test(mainText))
    tagsSet.add('Гастрономия')
  tagsSet.add('Путешествие')

  return Array.from(tagsSet)
}

export function extractShortDescription(mainText: string, parsedDays: ParsedDay[] = [], cities: string[] = []): string {
  if (!mainText)
    return ''

  // 1. Explicit "## Краткое описание" / "## 📝 Краткое описание" section
  const shortSectionMatch = mainText.match(
    /(?:^|\n)##\s*(?:[\p{Emoji}\p{Symbol}\p{Punctuation}\s]*)(?:Краткое\s+описание(?: путешествия| маршрута| тура| экспедиции)?|Короткое\s+описание|Обзор(?: путешествия| маршрута| тура)?|Summary|Short\s+Description)[^\n]*\n([\s\S]*?)(?=\n\s*(?:##|---|```|$))/iu,
  )

  if (shortSectionMatch && shortSectionMatch[1].trim()) {
    const rawSection = shortSectionMatch[1].trim()
    const cleaned = cleanMarkdownFormatting(rawSection)
      .replace(/^[-\*]\s+/gm, '')
      .replace(/\n+/g, ' ')
      .trim()
    if (cleaned.length > 5) {
      return cleaned
    }
  }

  // 2. Search for markdown blockquote containing concept / description / idea
  const quoteBlockMatch = mainText.match(/(?:^|\n)(>\s*\*\*(?:Концепция(?:\s+(?:путешествия|маршрута|тура|экспедиции))?|Описание(?:\s+(?:маршрута|путешествия))?|Идея(?:\s+(?:маршрута|путешествия))?|О\s+(?:маршруте|путешествии)|Главное|Маршрут):\*\*[\s\S]*?)(?=\n\s*(?:```|---|##|\n(?![>]))|$)/i)

  if (quoteBlockMatch) {
    const rawQuote = quoteBlockMatch[1]
    const rawLines = rawQuote.split('\n').map(l => l.replace(/^>\s*/, '').trim()).filter(Boolean)

    const introMatch = rawLines[0].match(/^\*\*(?:Концепция(?:\s+(?:путешествия|маршрута|тура|экспедиции))?|Описание(?:\s+(?:маршрута|путешествия))?|Идея(?:\s+(?:маршрута|путешествия))?|О\s+(?:маршруте|путешествии)|Главное|Маршрут):\*\*\s*(.*)/i)
    let firstLine = introMatch ? introMatch[1] : rawLines[0]
    firstLine = cleanMarkdownFormatting(firstLine)

    let fullIntro = firstLine
    let lineIdx = 1
    while (lineIdx < rawLines.length && !/^\d+\./.test(rawLines[lineIdx])) {
      fullIntro += ` ${cleanMarkdownFormatting(rawLines[lineIdx])}`
      lineIdx++
    }
    fullIntro = fullIntro.trim()

    const introWords = fullIntro.split(/\s+/).length
    if (introWords >= 18 && /[.!?]$/.test(fullIntro)) {
      return fullIntro
    }

    const subItems: string[] = []
    for (; lineIdx < rawLines.length; lineIdx++) {
      const line = rawLines[lineIdx]
      if (!/^\d+\./.test(line))
        continue

      const boldMatches = Array.from(line.matchAll(/\*\*([^*]+)\*\*/g)).map(m => m[1].trim())

      let itemTitle = ''
      if (boldMatches.length >= 2 && /^(?:Фаза|Этап|День)/i.test(boldMatches[0])) {
        itemTitle = cleanMarkdownFormatting(boldMatches[1])
      }
      else if (boldMatches.length >= 1) {
        let t = boldMatches[0]
        t = t.replace(/^(?:День|Фаза|Этап)[^—–\-:]*[-—–:]\s*/i, '')
        itemTitle = cleanMarkdownFormatting(t)
      }

      if (itemTitle) {
        itemTitle = itemTitle.replace(/[:.]+$/, '').replace(/\s*\([^)]*\)$/, '').trim()
        if (itemTitle.length >= 3 && itemTitle.length <= 70) {
          subItems.push(itemTitle)
        }
      }
    }

    const cleanIntroBase = fullIntro.replace(/[:.]+$/, '').trim()

    if (subItems.length > 0) {
      const summaryItems = subItems.slice(0, 4).join(', ')
      return `${cleanIntroBase}: ${summaryItems}.`
    }

    if (parsedDays && parsedDays.length > 0) {
      const dayHighlights = parsedDays
        .map(d => cleanMarkdownFormatting(d.title).replace(/^День\s*\d+\s*[-—:]?\s*/i, '').replace(/^[^\w\sа-яёА-ЯЁ]+\s*/, '').trim())
        .filter(t => t.length > 3)
        .slice(0, 4)

      if (dayHighlights.length > 0) {
        return `${cleanIntroBase}. В программе: ${dayHighlights.join(', ')}.`
      }
    }

    if (introWords >= 10) {
      return `${cleanIntroBase}.`
    }
  }

  // 3. First meaningful paragraph if no quote block
  const paragraphs = mainText
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p && !p.startsWith('#') && !p.startsWith('```') && !p.startsWith('---') && !p.startsWith('>'))

  for (const p of paragraphs) {
    const cleanP = cleanMarkdownFormatting(p)
      .replace(/^[-\*]\s+/gm, '')
      .replace(/\n+/g, ' ')
      .trim()

    const words = cleanP.split(/\s+/)
    if (words.length >= 10 && words.length <= 60 && !cleanP.startsWith('|')) {
      return cleanP.length > 250 ? `${cleanP.slice(0, 247)}...` : cleanP
    }
  }

  // 4. Fallback (15-30 words)
  const durationStr = parsedDays.length > 0 ? `${parsedDays.length}-дневное` : 'Увлекательное'
  const citiesStr = cities.length > 0 ? cities.slice(0, 4).join(', ') : 'региону'
  const highlights = parsedDays
    .map(d => cleanMarkdownFormatting(d.title).replace(/^День\s*\d+\s*[-—:]?\s*/i, '').replace(/^[^\w\sа-яёА-ЯЁ]+\s*/, '').trim())
    .filter(t => t.length > 3)
    .slice(0, 4)

  if (highlights.length > 0) {
    return `Насыщенное ${durationStr} путешествие: ${citiesStr}. Ключевые локации маршрута: ${highlights.join(', ')}.`
  }

  return `Насыщенное ${durationStr} путешествие по направлению ${citiesStr} с детально спланированным маршрутом, активностями и рекомендациями.`
}

export function extractDetailedDescription(mainText: string, defaultTitle: string = ''): string {
  if (!mainText)
    return defaultTitle ? `# ${defaultTitle}` : ''

  // 1. Explicit "## Подробная концепция путешествия" / "## 📖 Подробная концепция путешествия" / "## Подробная концепция" / "## Подробное описание" section
  const detailedMatch = mainText.match(
    /(?:^|\n)##\s*(?:[\p{Emoji}\p{Symbol}\p{Punctuation}\s]*)(?:Подробная\s+концепция(?: путешествия| маршрута| тура| экспедиции)?|Детальная\s+концепция(?: путешествия| маршрута| тура| экспедиции)?|Подробное\s+описание(?: путешествия| маршрута| тура| экспедиции)?|Детальное\s+описание(?: путешествия| маршрута| тура| экспедиции)?|Концепция\s+путешествия|Концепция\s+маршрута|Концепция\s+тура|Detailed\s+Concept|Detailed\s+Description)[^\n]*\n([\s\S]*?)(?=(?:\n\s*---|\n\s*##\s*(?:[\p{Emoji}\p{Symbol}\p{Punctuation}\s]*)(?:Ключевые|Разделы|Параметры|Бронирования|Финансы)|$))/iu,
  )

  if (detailedMatch && detailedMatch[1].trim()) {
    const raw = detailedMatch[1].trim()
    return raw
      .replace(/!\[\[[^\]]+\]\]/g, '')
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
  }

  // 2. Legacy blockquote format: > **Концепция путешествия:** ...
  const quoteBlockMatch = mainText.match(
    /(?:^|\n)(>\s*\*\*(?:Концепция(?:\s+(?:путешествия|маршрута|тура|экспедиции))?|Описание(?:\s+(?:маршрута|путешествия))?|Идея(?:\s+(?:маршрута|путешествия))?|О\s+(?:маршруте|путешествии)|Главное|Маршрут):\*\*[\s\S]*?)(?=\n\s*(?:```|---|##|\n(?![>]))|$)/i,
  )

  if (quoteBlockMatch && quoteBlockMatch[1].trim()) {
    const unquoted = quoteBlockMatch[1]
      .split('\n')
      .map(l => l.replace(/^>\s?/, ''))
      .join('\n')
      .trim()
    if (unquoted.length > 0) {
      return unquoted
        .replace(/!\[\[[^\]]+\]\]/g, '')
        .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    }
  }

  return mainText
    .replace(/!\[\[[^\]]+\]\]/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
}
