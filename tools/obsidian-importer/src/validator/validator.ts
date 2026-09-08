import type {
  DayValidationSummary,
  UnparsedActivityCandidate,
  ValidatedActivitySummary,
  ValidationIssue,
  ValidationReport,
  ValidationScopeContext,
} from './types'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { buildImageIndex } from '../lib/image-indexer'
import { normalizeIframeLineBreaks, parseActivitiesFromMarkdown } from '../parsers/activity'
import { parseObsidianBookings } from '../parsers/booking'
import { parseObsidianChecklists } from '../parsers/checklist'
import { parseDayMetaFromMarkdown } from '../parsers/day-meta'
import { parseObsidianFinances } from '../parsers/finances'
import { extractLocationsFromText } from '../parsers/location'
import {
  extractCities,
  extractDayDescription,
  extractDayTitle,
  extractDetailedDescription,
  extractShortDescription,
  extractTags,
} from '../parsers/vault'

/**
 * Основной движок глубокой валидации и диагностики Obsidian Travel Vault.
 */
export function validateObsidianVault(context: ValidationScopeContext, startDateStr?: string): ValidationReport {
  const issues: ValidationIssue[] = []
  const tripRoot = context.tripRootPath

  // 1. Построение индекса медиа-файлов
  const imageIndex = buildImageIndex(tripRoot)

  // 2. Валидация корневого файла и структуры хаба
  let rootNoteContent = ''
  let extractedTitle = basename(tripRoot).replace(/^[–—\-]+\s*/, '').trim()
  let descriptionShort = ''
  let detailedDescription = ''

  const rootEntries = readdirSync(tripRoot, { withFileTypes: true })
  const rootMdFiles = rootEntries.filter(e => e.isFile() && e.name.endsWith('.md'))

  // Ищем корневой хаб-файл (<Название>.md)
  let hubFile = rootMdFiles.find((f) => {
    const base = f.name.replace(/\.md$/, '').toLowerCase()
    return base === extractedTitle.toLowerCase() || base.includes(extractedTitle.toLowerCase())
  })

  if (!hubFile && rootMdFiles.length > 0) {
    hubFile = rootMdFiles[0]
  }

  if (hubFile) {
    const hubPath = join(tripRoot, hubFile.name)
    rootNoteContent = readFileSync(hubPath, 'utf-8')

    // Проверяем H1 заголовок
    const titleMatch = rootNoteContent.match(/^#\s*(?:Концепция маршрута:\s*)?[«"']?([^»"'\n(]+)[»"']?/m)
    if (titleMatch && titleMatch[1].trim()) {
      extractedTitle = titleMatch[1].trim()
    }
    else {
      issues.push({
        severity: 'warning',
        category: 'hub',
        file: hubFile.name,
        message: 'В корневом файле не найден заголовок первого уровня `# <Название>`.',
        recommendation: `Добавьте строку \`# ${extractedTitle}\` в начало файла.`,
      })
    }

    // Проверяем краткое описание
    const hasShortSection = /(?:^|\n)##\s*(?:[\p{Emoji}\p{Symbol}\p{Punctuation}\s]*)(?:Краткое\s+описание|Summary|Short\s+Description)/iu.test(rootNoteContent)
    if (!hasShortSection) {
      issues.push({
        severity: 'warning',
        category: 'hub',
        file: hubFile.name,
        message: 'Раздел «## 📝 Краткое описание» отсутствует.',
        recommendation: 'Добавьте раздел `## 📝 Краткое описание` с 2–4 емкими предложениями об экспедиции для карточки в веб-интерфейсе.',
      })
    }

    descriptionShort = extractShortDescription(rootNoteContent, [])
    detailedDescription = extractDetailedDescription(rootNoteContent, extractedTitle)
  }
  else {
    issues.push({
      severity: 'warning',
      category: 'hub',
      message: `В корне папки не найден мастер-файл путешествия (${extractedTitle}.md).`,
      recommendation: `Создайте файл ${extractedTitle}.md с концепцией тура и разделом «## 📝 Краткое описание».`,
    })
  }

  // 3. Поиск папки маршрутного плана (02 - Маршрутный план)
  let daysDirPath = ''
  const planDirNames = ['02 - Маршрутный план', 'Маршрутный план', '02 - Plan', 'Plan', 'Days', '02 - Дни']

  for (const name of planDirNames) {
    const checkPath = join(tripRoot, name)
    if (existsSync(checkPath) && statSync(checkPath).isDirectory()) {
      daysDirPath = checkPath
      break
    }
  }

  // Если корень сам является папкой с днями
  if (!daysDirPath) {
    const directDayFiles = rootEntries.filter(e => e.isFile() && /^(?:\d{1,2}|day|день)/i.test(e.name) && e.name.endsWith('.md'))
    if (directDayFiles.length > 0) {
      daysDirPath = tripRoot
    }
  }

  // Если дней все еще нет, ищем в подпапках
  if (!daysDirPath) {
    for (const entry of rootEntries) {
      if (entry.isDirectory()) {
        const subDirPath = join(tripRoot, entry.name)
        try {
          const subFiles = readdirSync(subDirPath)
          if (subFiles.some(f => /^(?:\d{1,2}|day|день)/i.test(f) && f.endsWith('.md'))) {
            daysDirPath = subDirPath
            break
          }
        }
        catch {
          // ignore
        }
      }
    }
  }

  if (!daysDirPath) {
    issues.push({
      severity: 'error',
      category: 'structure',
      message: 'Папка с дневными планами маршрута («02 - Маршрутный план») не найдена!',
      recommendation: 'Создайте папку `02 - Маршрутный план` и поместите в нее файлы `01 ...md`, `02 ...md`.',
    })
  }

  // 4. Валидация дней маршрута
  const daySummaries: DayValidationSummary[] = []
  const startDate = startDateStr ? new Date(startDateStr) : new Date()

  if (daysDirPath) {
    const dayFiles = readdirSync(daysDirPath).filter(f => f.endsWith('.md'))
    const dayNumberSet = new Set<number>()

    for (const fileName of dayFiles) {
      const filePath = join(daysDirPath, fileName)
      const content = readFileSync(filePath, 'utf-8')
      const fileNameWithoutExt = fileName.replace(/\.md$/, '')

      if (fileNameWithoutExt === 'Маршрутный план' || fileNameWithoutExt.toLowerCase() === 'plan') {
        continue
      }

      const dayNumberMatch = fileName.match(/^0*(\d{1,2})|[дd](\d{1,2})|day\s*(\d{1,2})/i)
      const dayNumber = dayNumberMatch
        ? Number.parseInt(dayNumberMatch[1] || dayNumberMatch[2] || dayNumberMatch[3], 10)
        : (daySummaries.length + 1)

      // Проверка дубликатов номеров дней
      if (dayNumberSet.has(dayNumber)) {
        issues.push({
          severity: 'warning',
          category: 'days',
          file: fileName,
          message: `Дубликат номера дня: День ${dayNumber} уже встречался в другом файле.`,
          recommendation: 'Проверьте нумерацию файлов в папке `02 - Маршрутный план`.',
        })
      }
      dayNumberSet.add(dayNumber)

      const title = extractDayTitle(fileNameWithoutExt, dayNumber)
      const dayDescription = extractDayDescription(content)
      const rawContent = normalizeIframeLineBreaks(content)

      const dayDate = new Date(startDate)
      dayDate.setDate(dayDate.getDate() + (dayNumber - 1))
      const dateStr = dayDate.toISOString().split('T')[0]

      const dayMeta = parseDayMetaFromMarkdown(rawContent)
      const activities = parseActivitiesFromMarkdown(rawContent)

      // Проверка шапки дня
      const dayIssues: ValidationIssue[] = []
      const hasPhase = />[ \t]*\*\*(?:Фаза тура|Фаза|Phase):\*\*/i.test(content)
      const hasHighlight = />[ \t]*\*\*(?:Ключевой хайлайт|Хайлайт дня|Хайлайты|Хайлайт|Highlight):\*\*/i.test(content)

      if (!hasPhase && !hasHighlight) {
        dayIssues.push({
          severity: 'warning',
          category: 'days',
          file: fileName,
          message: 'В шапке дня отсутствуют параметры `> **Фаза тура:**` и `> **Ключевой хайлайт:**`.',
          recommendation: 'Добавьте в цитату шапки строки `> **Фаза тура:** ...` и `> **Ключевой хайлайт:** ...` для заполнения описания дня в расписании.',
        })
      }

      // Проверка структуры активностей и поиск нераспознанных кандидатов
      const unparsedCandidates: UnparsedActivityCandidate[] = []
      const lines = content.split('\n')

      // Находим границу секции финансов
      let finIndex = lines.length
      for (let i = 0; i < lines.length; i++) {
        if (/^##\s*(?:💰\s*)?Финансовые затраты/i.test(lines[i])) {
          finIndex = i
          break
        }
      }

      const officialTimeRegex = /^[*-]\s*\*\*(\d{1,2}:\d{2})\+?\s*(?:[-–—]\s*(\d{1,2}:\d{2}))?\+?\*\*\s*(?:[-–—:]\s*)?(.*)$/
      const looseTimePattern = /^\s*(?:[*-]\s*)?(?:\*\*)?(\d{1,2}[:.]\d{2})\s*(?:[-–—]\s*(\d{1,2}[:.]\d{2}))?(?:\*\*)?\s*(?:[-–—:]\s*)?(.*)$/

      for (let lineIdx = 0; lineIdx < finIndex; lineIdx++) {
        const line = lines[lineIdx]
        const trimmed = line.trim()

        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('>') || trimmed.startsWith('|') || trimmed.startsWith('---')) {
          continue
        }

        // Если строка похожа на активность со временем, но не распознается официальным парсером
        if (looseTimePattern.test(line) && !officialTimeRegex.test(line)) {
          let reason = 'Нестандартный формат строки активности'
          let fix = '* **09:30 - 11:30** — Название активности:'

          if (/^\s+[*-]/.test(line) && /\*\*\d{1,2}[:.]\d{2}/.test(trimmed)) {
            reason = 'Строка активности имеет отступ (вложена в подпункты предыдущей активности)'
            fix = trimmed.trim()
          }
          else if (!/^[*-]/.test(trimmed)) {
            reason = 'Отсутствует маркер списка (* или -) в начале строки'
            fix = `* ${trimmed}`
          }
          else if (/\d{1,2}\.\d{2}/.test(trimmed)) {
            reason = 'Вместо двоеточия в часах/минутах использована точка (09.30 вместо 09:30)'
            fix = trimmed.replace(/(\d{1,2})\.(\d{2})/g, '$1:$2')
          }
          else if (!/\*\*\d{1,2}:\d{2}/.test(trimmed)) {
            reason = 'Время активности не выделено полужирным шрифтом (**HH:MM**)'
            const timeCleaned = trimmed.replace(/\*+(\d{1,2}:\d{2})\*+/g, '$1')
            const rangeMatch = timeCleaned.match(/(\d{1,2}:\d{2}(?:\s*[-–—]\s*\d{1,2}:\d{2})?)/)
            if (rangeMatch) {
              fix = timeCleaned.replace(rangeMatch[1], `**${rangeMatch[1]}**`)
            }
            else {
              fix = trimmed.replace(/(\d{1,2}:\d{2})/g, '**$1**')
            }
          }

          unparsedCandidates.push({
            line: lineIdx + 1,
            rawLine: trimmed,
            reason,
            suggestedFix: fix,
          })

          dayIssues.push({
            severity: 'warning',
            category: 'timeline',
            file: fileName,
            line: lineIdx + 1,
            rawText: trimmed,
            message: `Строка таймлайна будет пропущена парсером: ${reason}`,
            recommendation: `Исправьте формат строки на: \`${fix}\``,
          })
        }
      }

      // Проверка ссылок на изображения в дне
      const imagesReferenced: string[] = []
      const missingImages: string[] = []

      const wikilinkMatches = content.matchAll(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)
      for (const m of wikilinkMatches) {
        const imgName = basename(m[1].trim())
        if (/\.(png|jpg|jpeg|webp|gif|heic|heif|svg)$/i.test(imgName)) {
          if (!imagesReferenced.includes(imgName)) {
            imagesReferenced.push(imgName)
            if (!imageIndex.has(imgName) && !imageIndex.has(imgName.toLowerCase())) {
              missingImages.push(imgName)
            }
          }
        }
      }

      const mdImgMatches = content.matchAll(/!\[[^\]]*\]\(([^)]+\.(?:png|jpg|jpeg|webp|gif|heic|heif|svg))\)/gi)
      for (const m of mdImgMatches) {
        const imgName = basename(m[1].trim())
        if (!imagesReferenced.includes(imgName)) {
          imagesReferenced.push(imgName)
          if (!imageIndex.has(imgName) && !imageIndex.has(imgName.toLowerCase())) {
            missingImages.push(imgName)
          }
        }
      }

      if (missingImages.length > 0) {
        dayIssues.push({
          severity: 'warning',
          category: 'media',
          file: fileName,
          message: `В заметке упомянуты файлы изображений, которых нет в папке \`_\`: ${missingImages.join(', ')}`,
          recommendation: 'Поместите файлы фото в папку вложений `_` или проверьте правильность их имен.',
        })
      }

      // Проверка интерактивных Google Maps iframe
      const iframes = content.match(/<iframe\b[^>]*>.*?<\/iframe>/gi) || []
      let hasIframe = false
      for (const iframe of iframes) {
        hasIframe = true
        if (!iframe.includes('loading="lazy"')) {
          dayIssues.push({
            severity: 'info',
            category: 'locations',
            file: fileName,
            message: 'В теге <iframe> отсутствует атрибут loading="lazy".',
            recommendation: 'Добавьте loading="lazy" для плавной загрузки карты.',
          })
        }
        if (!iframe.includes('width: 100%') && !iframe.includes('min-width: 100%')) {
          dayIssues.push({
            severity: 'info',
            category: 'locations',
            file: fileName,
            message: 'В стилях <iframe> не задана адаптивная ширина (style="width: 100%; min-width: 100%; height: 350px...").',
            recommendation: 'Используйте стандартный стиль для адаптивности карты в мобильном и десктопном клиенте.',
          })
        }
      }

      // Проверка блока суточных финансов
      const hasFinances = /^##\s*(?:💰\s*)?Финансовые затраты/im.test(content)
      let financesTotal: string | undefined
      if (hasFinances) {
        const totalMatch = content.match(/(?:\*\*Итого[^*]*\*\*|Итого[^:\n]*):?\s*(?:около\s*)?`?([~≈]?[\d\s]+(?:[–—\-][\d\s]*)?(?:₽|RUB|TWD|\$|EUR))`?/i)
        if (totalMatch) {
          financesTotal = totalMatch[1].trim()
        }
      }
      else {
        dayIssues.push({
          severity: 'info',
          category: 'finances',
          file: fileName,
          message: 'Отсутствует итоговый блок «## 💰 Финансовые затраты на день (на 1 чел)».',
          recommendation: 'Добавьте блок суточных затрат в конце заметки для отображения сводки в бейджах.',
        })
      }

      // Анализ распознанных активностей
      const validatedActivities: ValidatedActivitySummary[] = activities.map((act) => {
        const descSections = act.sections?.filter(s => s.type === 'description') || []
        const actText = descSections.map(s => s.text).join('\n')
        const locs = extractLocationsFromText(actText)
        const actIframes = actText.match(/<iframe\b[^>]*>/gi) || []

        const actImages: string[] = []
        const actImgMatches = actText.matchAll(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)
        for (const m of actImgMatches) {
          actImages.push(basename(m[1].trim()))
        }

        return {
          startTime: act.startTime,
          endTime: act.endTime,
          title: act.title,
          tag: act.tag,
          hasLocations: locs.length > 0,
          hasIframe: actIframes.length > 0,
          imagesCount: actImages.length,
          notesCount: descSections.filter(s => s.isAttached).length,
        }
      })

      issues.push(...dayIssues)

      daySummaries.push({
        dayNumber,
        fileName,
        filePath,
        title,
        description: dayDescription,
        date: dateStr,
        metaCount: dayMeta.length,
        activitiesCount: activities.length,
        activities: validatedActivities,
        unparsedCandidates,
        imagesReferenced,
        missingImages,
        locationsCount: extractLocationsFromText(content).length,
        hasIframe,
        hasFinances,
        financesTotal,
        issues: dayIssues,
      })
    }
  }

  daySummaries.sort((a, b) => a.dayNumber - b.dayNumber)

  // Проверка последовательности номеров дней (пропуски)
  if (daySummaries.length > 1 && context.scope !== 'single-day') {
    for (let i = 0; i < daySummaries.length - 1; i++) {
      const current = daySummaries[i].dayNumber
      const next = daySummaries[i + 1].dayNumber
      if (next !== current + 1) {
        issues.push({
          severity: 'warning',
          category: 'days',
          message: `Нарушена последовательность дней: после Дня ${current} идет День ${next} (пропущен День ${current + 1}).`,
          recommendation: 'Убедитесь, что все дни маршрута пронумерованы по порядку без пропусков.',
        })
      }
    }
  }

  let finalDays = daySummaries
  if (context.scope === 'single-day' && context.targetFileName) {
    const targetDay = daySummaries.find(d => d.fileName === context.targetFileName)
    if (targetDay) {
      finalDays = [targetDay]
    }
  }

  // 5. Валидация бронирований (03 - Бронирования/*)
  const bookingsData = parseObsidianBookings(tripRoot, startDate.toISOString().split('T')[0])
  const hotelsCount = bookingsData.bookings.filter(b => b.type === 'hotel').length
  const flightsCount = bookingsData.bookings.filter(b => b.type === 'flight').length
  const trainsCount = bookingsData.bookings.filter(b => b.type === 'train').length
  const carsCount = bookingsData.bookings.filter(b => b.type === 'car').length
  const attractionsCount = bookingsData.bookings.filter(b => b.type === 'attraction').length

  const bookingDirNames = ['03 - Бронирования', '03 - Bookings', '01 - Бронирования', 'Бронирования']
  const hasBookingsDir = bookingDirNames.some(d => existsSync(join(tripRoot, d)))

  if (!hasBookingsDir) {
    issues.push({
      severity: 'info',
      category: 'bookings',
      message: 'Папка «03 - Бронирования» не найдена (отели, рейсы и поезда не будут созданы).',
      recommendation: 'Создайте папку `03 - Бронирования` с файлами `Отели.md`, `Авиаперелеты.md` и `Транспорт.md`.',
    })
  }
  else {
    if (hotelsCount === 0) {
      issues.push({
        severity: 'warning',
        category: 'bookings',
        message: 'В папке бронирований не найдено ни одного распарсенного отеля (проверьте таблицу в Отели.md).',
        recommendation: 'Оформите сводную таблицу в `Отели.md` с колонками `| Ночи | Локация | Отель ... |`.',
      })
    }
  }

  // 6. Валидация финансов (04 - Финансы/Финансы.md)
  let financesFilePath: string | undefined
  const financeCandidates = [
    join(tripRoot, '04 - Финансы', 'Финансы.md'),
    join(tripRoot, '04 - Финансы', 'Бюджет.md'),
    join(tripRoot, 'Финансы.md'),
  ]
  for (const c of financeCandidates) {
    if (existsSync(c)) {
      financesFilePath = c
      break
    }
  }

  const financesData = parseObsidianFinances(financesFilePath)
  const totalFinancesRub = financesData.transactions.reduce((sum, t) => sum + t.amount, 0)

  if (!financesFilePath) {
    issues.push({
      severity: 'info',
      category: 'finances',
      message: 'Файл сметы «04 - Финансы/Финансы.md» не найден.',
      recommendation: 'Создайте `04 - Финансы/Финансы.md` со сводной таблицей расходов по категориям (✈️, 🚄, 🏨, 🍜, 🎟️, 🎁).',
    })
  }

  // 7. Валидация чек-листов (06 - Чек лист/*)
  const checklistFiles: string[] = []
  const checklistDirNames = ['06 - Чек лист', '06 - Чек-лист', '06 - Checklist', 'Чек лист', 'Checklist']
  for (const name of checklistDirNames) {
    const p = join(tripRoot, name)
    if (existsSync(p) && statSync(p).isDirectory()) {
      const files = readdirSync(p).filter(f => f.endsWith('.md'))
      for (const f of files) {
        checklistFiles.push(join(p, f))
      }
      break
    }
  }

  const checklistData = parseObsidianChecklists(checklistFiles)
  const totalTasks = checklistData.items?.length || 0
  const tasksWithCost = checklistData.items?.filter(i => !!i.cost).length || 0
  const tasksWithLocation = checklistData.items?.filter(i => !!i.location).length || 0
  const tasksWithLink = checklistData.items?.filter(i => !!i.link).length || 0

  if (checklistFiles.length === 0) {
    issues.push({
      severity: 'info',
      category: 'checklists',
      message: 'Папка чек-листов «06 - Чек лист» не найдена.',
      recommendation: 'Создайте `06 - Чек лист` с файлами `Чек-лист подготовки и сборов.md` и `Что попробовать и купить (Must-Try & Must-Buy).md`.',
    })
  }

  // 8. Города и теги
  const mainText = rootNoteContent || ''
  const cities = extractCities(mainText, daySummaries as any)
  const tags = extractTags(mainText)

  if (cities.length === 0) {
    issues.push({
      severity: 'warning',
      category: 'hub',
      message: 'Не удалось определить список ключевых городов маршрута.',
      recommendation: 'Укажите названия городов в именах дневных файлов (например, `01 Тайбэй...`) или в тексте концепции.',
    })
  }

  // 9. Расчет итогового индекса совместимости (Score)
  let score = 100

  // Критические ошибки
  const errorCount = issues.filter(i => i.severity === 'error').length
  score -= errorCount * 25

  // Предупреждения по таймлайну (пропущенные строки активностей)
  const timelineWarningCount = issues.filter(i => i.severity === 'warning' && i.category === 'timeline').length
  score -= timelineWarningCount * 5

  // Предупреждения по структуре/хабу
  const hubWarningCount = issues.filter(i => i.severity === 'warning' && i.category === 'hub').length
  score -= hubWarningCount * 4

  // Отсутствующие изображения
  const missingImgTotal = daySummaries.reduce((sum, d) => sum + d.missingImages.length, 0)
  score -= Math.min(15, missingImgTotal * 2)

  // Отсутствие городов или описания
  if (!descriptionShort)
    score -= 5
  if (cities.length === 0)
    score -= 5
  if (daySummaries.length === 0)
    score -= 30

  score = Math.max(0, Math.min(100, Math.round(score)))

  let status: ValidationReport['status'] = 'excellent'
  if (errorCount > 0 || score < 50) {
    status = 'critical'
  }
  else if (score < 75) {
    status = 'needs-attention'
  }
  else if (score < 90) {
    status = 'good'
  }

  const lastDayDate = new Date(startDate)
  lastDayDate.setDate(lastDayDate.getDate() + Math.max(0, daySummaries.length - 1))

  return {
    context,
    tripTitle: extractedTitle,
    descriptionShort,
    description: detailedDescription,
    cities,
    tags,
    dates: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: lastDayDate.toISOString().split('T')[0],
      durationDays: daySummaries.length,
    },
    days: finalDays,
    totalActivities: finalDays.reduce((sum, d) => sum + d.activitiesCount, 0),
    totalImagesReferenced: finalDays.reduce((sum, d) => sum + d.imagesReferenced.length, 0),
    totalImagesMissing: finalDays.reduce((sum, d) => sum + d.missingImages.length, 0),
    totalLocations: finalDays.reduce((sum, d) => sum + d.locationsCount, 0),
    bookingsSummary: {
      hotelsCount,
      flightsCount,
      trainsCount,
      carsCount,
      attractionsCount,
      totalBookings: bookingsData.bookings.length,
    },
    financesSummary: {
      categoriesCount: financesData.categories.length,
      transactionsCount: financesData.transactions.length,
      totalRub: totalFinancesRub,
    },
    checklistsSummary: {
      tabsCount: checklistData.tabs?.length || 0,
      groupsCount: checklistData.groups?.length || 0,
      tasksCount: totalTasks,
      tasksWithCost,
      tasksWithLocation,
      tasksWithLink,
    },
    notesSummary: {
      foldersCount: rootEntries.filter(e => e.isDirectory() && !e.name.startsWith('.')).length,
      filesCount: rootMdFiles.length,
    },
    issues,
    score,
    status,
    readinessSummary: {
      canImport: errorCount === 0 && daySummaries.length > 0,
      tripMetaReady: !!extractedTitle && cities.length > 0,
      daysReady: daySummaries.length > 0,
      activitiesReady: daySummaries.some(d => d.activitiesCount > 0),
      bookingsReady: bookingsData.bookings.length > 0,
      financesReady: financesData.transactions.length > 0,
      checklistsReady: totalTasks > 0,
    },
  }
}
