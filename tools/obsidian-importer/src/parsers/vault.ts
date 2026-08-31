import type { ParsedDay, ParsedNoteFile, ParsedNoteFolder, ParsedTripData } from '../types'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
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

      const dayNumberMatch = fileName.match(/^0*(\d{1,2})|[дd](\d{1,2})|day\s*(\d{1,2})/i)
      const dayNumber = dayNumberMatch
        ? Number.parseInt(dayNumberMatch[1] || dayNumberMatch[2] || dayNumberMatch[3], 10)
        : (parsedDays.length + 1)

      let title = fileNameWithoutExt.replace(/^\d{1,2}\s*/, '').trim()
      if (!title) {
        title = `День ${dayNumber}`
      }

      let dayDescription = ''
      const expectMatch = content.match(/##\s*(?:\S[^\n]*)?Чего ожидать от дня\s*\n([^#\n]+)/i)
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

      const dayMeta = parseDayMetaFromMarkdown(content)

      parsedDays.push({
        dayNumber,
        fileName,
        filePath,
        title,
        description: dayDescription,
        rawContent: content,
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
        folderNotes.push({
          title: fileName.replace(/\.md$/, ''),
          fileName,
          filePath,
          content,
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
  const cityRegex = /Куала-Лумпур|Тайбэй|Цзюфэнь|Пинси|Тайчжун|Жиюэтань|Тайнань|Гаосюн|Хуалянь|Тароко|Сингапур|Сеул|Пусан|Чеджу|Шанхай|Пекин|Чжанцзяцзе|Гуанчжоу|Гонконг|Токио|Киото|Осака|Бангкок|Пхукет|Алтай|Мурманск/gi
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
