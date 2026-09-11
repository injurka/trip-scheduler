import type { ActivityPayload, Booking } from '../types'
import process from 'node:process'
import { colors } from '../config/colors'
import { loadEnvIfAvailable } from '../config/env'
import { loadImporterConfig } from '../config/loader'
import { ApiClient } from '../lib/api-client'
import {
  computeDayLlmHash,
  loadGeocodeCache,
  loadLlmCache,
  saveGeocodeCache,
  saveLlmCache,
} from '../lib/cache'
import { enrichActivityWithMediaAndLocation } from '../lib/enricher'
import { buildImageIndex } from '../lib/image-indexer'
import { generateActivitiesViaDirectLlm, mergeLlmActivitiesWithRawMarkdown } from '../lib/llm'
import { stableId } from '../lib/stable-id'
import { parseActivitiesFromMarkdown } from '../parsers/activity'
import { parseObsidianTripFolder } from '../parsers/vault'
import {
  printValidationReport,
  resolveValidationScopeContext,
  validateObsidianVault,
} from '../validator'
import { parseCliArgs } from './args'
import {
  promptForContinueToImport,
  promptForCredentials,
  promptForExecutionMode,
  promptForInteractiveOptions,
  promptForTargetDirectory,
  promptForTargetTrip,
} from './prompts'

export async function runImport(): Promise<void> {
  loadEnvIfAvailable()
  const cliOptions = parseCliArgs()
  const appConfig = loadImporterConfig(cliOptions.configPath)
  const importErrors: string[] = []
  const recordError = (label: string, error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error)
    importErrors.push(`${label}: ${message}`)
  }

  console.log(`\n${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}    🛫 Obsidian ➔ Trip Scheduler Import Tool (Advanced)${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════${colors.reset}\n`)

  const targetDir = await promptForTargetDirectory(cliOptions.dir)

  let runValidation = cliOptions.validate

  if (!cliOptions.validate && !cliOptions.dryRun && !cliOptions.nonInteractive) {
    const chosenMode = await promptForExecutionMode()
    if (chosenMode === 'validate') {
      runValidation = true
    }
    else if (chosenMode === 'dry-run') {
      cliOptions.dryRun = true
    }
  }

  if (runValidation) {
    const scopeContext = resolveValidationScopeContext(targetDir)
    const report = validateObsidianVault(scopeContext, cliOptions.startDate)
    printValidationReport(report)

    if (cliOptions.nonInteractive && cliOptions.validate) {
      process.exit(report.readinessSummary.canImport ? 0 : 1)
    }

    if (!report.readinessSummary.canImport) {
      console.log(`\n${colors.red}${colors.bright}⚠️  Внимание: в хранилище обнаружены критические ошибки!${colors.reset}`)
    }

    const shouldProceed = await promptForContinueToImport(report.readinessSummary.canImport)
    if (!shouldProceed) {
      console.log(`\n${colors.cyan}ℹ️  Валидация завершена. Вы можете исправить предупреждения в Obsidian и повторить запуск.${colors.reset}\n`)
      process.exit(0)
    }
  }

  console.log(`\n${colors.dim}📖 Чтение и парсинг структуры Obsidian...${colors.reset}`)
  let tripData
  try {
    tripData = parseObsidianTripFolder(targetDir, cliOptions.startDate)
  }
  catch (err: any) {
    console.error(`${colors.red}❌ Ошибка парсинга папки Obsidian: ${err.message}${colors.reset}`)
    process.exit(1)
  }

  const bookingsTotal = tripData.bookingsContent?.bookings?.length || 0
  const financesTotalRub = (tripData.financesContent?.transactions || []).reduce((sum, t) => sum + (t.amount || 0), 0)
  const transactionsCount = tripData.financesContent?.transactions?.length || 0

  console.log(`\n${colors.green}✔ Найдено в структуре Obsidian:${colors.reset}`)
  console.log(`  • Название:        ${colors.bright}${tripData.title}${colors.reset}`)
  console.log(`  • Описание:        ${colors.cyan}${tripData.descriptionShort}${colors.reset}`)
  console.log(`  • Города:          ${tripData.cities.join(', ') || 'Не определены'}`)
  console.log(`  • Теги:            ${tripData.tags.join(', ') || '—'}`)
  console.log(`  • Даты:            ${tripData.startDate} ➔ ${tripData.endDate} (${tripData.days.length} дн.)`)
  console.log(`  • Дней маршрута:   ${tripData.days.length}`)
  console.log(`  • Корневых файлов: ${tripData.rootNotes.length}`)
  console.log(`  • Папок с файлами: ${tripData.sectionFolders.length} (${tripData.sectionFolders.reduce((acc, f) => acc + f.files.length, 0)} файлов)`)
  console.log(`  • Бронирований:    ${bookingsTotal}`)
  console.log(`  • Смета и бюджет:  ${transactionsCount} статей на ~${financesTotalRub.toLocaleString('ru-RU')} ₽`)
  console.log(`  • Задач чек-листа: ${tripData.checklistContent.items?.length || 0} (в ${tripData.checklistFilesCount} файлах)`)

  if (cliOptions.dryRun) {
    console.log(`\n${colors.yellow}🔍 [DRY-RUN] Режим предпросмотра включен. Запросы к API отправляться не будут.${colors.reset}`)
  }

  const {
    importTripMeta,
    importDays,
    importActivities,
    importChecklists,
    importNotes,
    importSections,
    useLlm,
    selectedModel,
  } = await promptForInteractiveOptions(cliOptions, tripData)

  if (cliOptions.dryRun) {
    console.log(`\n${colors.bright}Выбранные модули:${colors.reset}`)
    console.log(`  • Путешествие:    ${importTripMeta ? 'Да' : 'Нет'}`)
    console.log(`  • Дни маршрута:   ${importDays ? `Да (${tripData.days.length} дн., ${tripData.days.reduce((acc, d) => acc + d.meta.length, 0)} инфо-блоков day.meta)` : 'Нет'}`)
    console.log(`  • Активности:     ${importActivities ? `Да (LLM: ${selectedModel})` : 'Нет'}`)
    console.log(`  • Чек-листы:      ${importChecklists ? `Да (${tripData.checklistContent.items?.length || 0} задач)` : 'Нет'}`)
    console.log(`  • Заметки:        ${importNotes ? `Да (${tripData.sectionFolders.length} папок)` : 'Нет'}`)
    console.log(`  • Разделы:        ${importSections ? 'Да' : 'Нет'}`)

    if (tripData.days.length > 0) {
      console.log(`\n${colors.bright}📅 Дни маршрута и распарсенные инфо-блоки (day.meta):${colors.reset}`)
      for (const d of tripData.days) {
        console.log(`  [День ${d.dayNumber}: ${d.title}] (${d.meta.length} инфо-блоков)`)
        for (const m of d.meta) {
          console.log(`    - 🏷️ ${m.title}${m.subtitle ? ` -> ${m.subtitle}` : ''}`)
        }
      }
    }

    if (tripData.checklistContent.tabs && tripData.checklistContent.tabs.length > 0) {
      console.log(`\n${colors.bright}📋 Чек-листы, которые будут загружены:${colors.reset}`)
      for (const tab of tripData.checklistContent.tabs) {
        const tabItems = tripData.checklistContent.items?.filter(i => i.type === tab.id) || []
        const tabGroups = tripData.checklistContent.groups?.filter(g => g.type === tab.id) || []
        console.log(`  [Вкладка: ${tab.name}] (${tabGroups.length} групп, ${tabItems.length} задач)`)
      }
    }

    if (tripData.financesContent?.transactions && tripData.financesContent.transactions.length > 0) {
      const totalRub = tripData.financesContent.transactions.reduce((sum, t) => sum + (t.amount || 0), 0)
      console.log(`\n${colors.bright}💰 Смета и плановые расходы (${tripData.financesContent.transactions.length} статей на ~${totalRub.toLocaleString('ru-RU')} ₽):${colors.reset}`)
      for (const t of tripData.financesContent.transactions.slice(0, 6)) {
        console.log(`  • [${t.amount.toLocaleString('ru-RU')} ₽] ${t.title}${t.notes ? ` (${t.notes})` : ''}`)
      }
      if (tripData.financesContent.transactions.length > 6) {
        console.log(`  ${colors.dim}... и ещё ${tripData.financesContent.transactions.length - 6} статей расходов${colors.reset}`)
      }
    }

    console.log(`\n${colors.green}✅ Предпросмотр завершен.${colors.reset}\n`)
    return
  }

  const { email, password } = await promptForCredentials(cliOptions)
  const api = new ApiClient(cliOptions.apiUrl)

  try {
    process.stdout.write(`\n${colors.dim}🔐 Авторизация на ${cliOptions.apiUrl}...${colors.reset} `)
    await api.signIn(email, password)
    process.stdout.write(`${colors.green}Успешно!${colors.reset}\n`)
  }
  catch (err: any) {
    console.error(`\n${colors.red}❌ Ошибка авторизации: ${err.message}${colors.reset}`)
    process.exit(1)
  }

  // 1. Connect to existing trip or create a new trip
  let targetTripId = cliOptions.tripId
  let overwriteDays = cliOptions.daysOverwrite ?? false

  if (!targetTripId && !cliOptions.nonInteractive) {
    const targetSelection = await promptForTargetTrip(api, cliOptions.tripId, tripData.title)
    targetTripId = targetSelection.tripId
    overwriteDays = targetSelection.overwriteDays
  }

  let createdTrip: { id: string, title: string, startDate?: string, endDate?: string, imageUrl?: string | null }

  if (targetTripId) {
    console.log(`\n${colors.dim}🔗 Подключение к существующему путешествию...${colors.reset}`)
    try {
      const existingTrip = await api.getTripById(targetTripId)
      createdTrip = {
        id: existingTrip.id,
        title: existingTrip.title,
        startDate: existingTrip.startDate,
        endDate: existingTrip.endDate,
        imageUrl: existingTrip.imageUrl,
      }
      console.log(`  ${colors.green}✔ Найдено путешествие:${colors.reset} ${colors.bright}${createdTrip.title}${colors.reset} (ID: ${createdTrip.id})`)
    }
    catch (err: any) {
      console.error(`  ${colors.red}❌ Путешествие с ID ${targetTripId} не найдено: ${err.message}${colors.reset}`)
      process.exit(1)
    }
  }
  else {
    console.log(`\n${colors.dim}🚀 Создание путешествия в Trip Scheduler...${colors.reset}`)
    try {
      createdTrip = await api.createTrip({
        title: tripData.title,
        description: tripData.description,
        startDate: tripData.startDate,
        endDate: tripData.endDate,
      })
      console.log(`  ${colors.green}✔ Путешествие создано:${colors.reset} ${colors.bright}${createdTrip.title}${colors.reset} (ID: ${createdTrip.id})`)
    }
    catch (err: any) {
      console.error(`  ${colors.red}❌ Ошибка создания поездки: ${err.message}${colors.reset}`)
      process.exit(1)
    }
  }

  let coverImageUrl = tripData.cover && /^https?:\/\//i.test(tripData.cover) ? tripData.cover : undefined
  if (cliOptions.uploadImages && tripData.coverImagePath && (!targetTripId || !createdTrip.imageUrl || overwriteDays)) {
    try {
      coverImageUrl = await api.uploadImage(createdTrip.id, tripData.coverImagePath, 'route')
      console.log(`  ${colors.green}✔ Обложка путешествия загружена${colors.reset}`)
    }
    catch (err: any) {
      recordError('Загрузка обложки', err)
      console.warn(`  ${colors.yellow}⚠ Ошибка загрузки обложки: ${err.message}${colors.reset}`)
    }
  }

  // Update Trip Metadata & Cities
  if (importTripMeta) {
    try {
      await api.updateTrip(createdTrip.id, {
        title: tripData.title,
        description: tripData.description,
        descriptionShort: tripData.descriptionShort,
        imageUrl: coverImageUrl,
        cities: tripData.cities,
        tags: tripData.tags,
        status: cliOptions.status,
        visibility: cliOptions.visibility,
        startDate: tripData.startDate,
        endDate: tripData.endDate,
      })
      console.log(`  ${colors.green}✔ Метаданные путешествия обновлены${colors.reset} (города: ${tripData.cities.join(', ') || '—'}, теги: ${tripData.tags.join(', ')})`)
    }
    catch (err: any) {
      recordError('Обновление метаданных', err)
      console.warn(`  ${colors.yellow}⚠ Ошибка обновления метаданных: ${err.message}${colors.reset}`)
    }
  }

  // 2. Create / Update Trip Section Tabs (All 6 Standard Sections)
  const createdBookings: Booking[] = tripData.bookingsContent?.bookings || []

  if (importSections) {
    console.log(`\n${colors.dim}📑 Наполнение разделов-вкладок путешествия...${colors.reset}`)

    let existingSections: Array<{ id: string, type: string, title: string }> = []
    try {
      const details = await api.getTripDetails(createdTrip.id)
      if (Array.isArray(details?.sections)) {
        existingSections = details.sections
      }
    }
    catch (error) {
      recordError('Получение разделов путешествия', error)
      throw error
    }

    for (const sec of appConfig.defaultSections) {
      try {
        let sectionContent: any

        if (sec.type === 'bookings') {
          sectionContent = tripData.bookingsContent && tripData.bookingsContent.bookings.length > 0 ? tripData.bookingsContent : undefined
        }
        else if (sec.type === 'checklist' && importChecklists) {
          sectionContent = tripData.checklistContent && tripData.checklistContent.items && tripData.checklistContent.items.length > 0 ? tripData.checklistContent : undefined
        }
        else if (sec.type === 'finances') {
          sectionContent = tripData.financesContent?.transactions?.length ? tripData.financesContent : undefined
        }

        const existingSec = existingSections.find(s => s.type === sec.type)

        if (existingSec) {
          const updatePayload: { title: string, icon: string | null, content?: unknown } = {
            title: sec.title,
            icon: sec.icon,
          }
          if (sectionContent !== undefined)
            updatePayload.content = sectionContent
          await api.updateTripSection(existingSec.id, updatePayload)
        }
        else {
          await api.createTripSection({
            tripId: createdTrip.id,
            type: sec.type as any,
            title: sec.title,
            icon: sec.icon,
            content: sectionContent,
          })
        }

        if (sec.type === 'bookings' && sectionContent?.bookings?.length > 0) {
          const hotelsCount = sectionContent.bookings.filter((b: any) => b.type === 'hotel').length
          const flightsCount = sectionContent.bookings.filter((b: any) => b.type === 'flight').length
          const trainsCount = sectionContent.bookings.filter((b: any) => b.type === 'train').length
          const carsCount = sectionContent.bookings.filter((b: any) => b.type === 'car').length
          const attractionsCount = sectionContent.bookings.filter((b: any) => b.type === 'attraction').length
          const othersCount = sectionContent.bookings.filter((b: any) => b.type === 'other').length
          console.log(`  ${colors.green}✔ Раздел «${sec.title}» наполнен:${colors.reset} ${hotelsCount > 0 ? `🏨 ${hotelsCount} отелей ` : ''}${flightsCount > 0 ? `✈️ ${flightsCount} рейсов ` : ''}${trainsCount > 0 ? `🚆 ${trainsCount} поездов ` : ''}${carsCount > 0 ? `🚗 ${carsCount} авто/трансферов ` : ''}${attractionsCount > 0 ? `🎟️ ${attractionsCount} билетов/пропусков ` : ''}${othersCount > 0 ? `🧭 ${othersCount} прочих переездов` : ''}`)
        }
        else if (sec.type === 'checklist' && sectionContent?.items?.length > 0) {
          const totalItems = sectionContent.items.length
          const totalGroups = sectionContent.groups?.length || 0
          console.log(`  ${colors.green}✔ Раздел «${sec.title}» наполнен:${colors.reset} 📝 ${totalGroups} групп (${totalItems} пунктов)`)
        }
        else {
          console.log(`  ${colors.green}✔ Раздел сохранен:${colors.reset} ${sec.title}`)
        }
      }
      catch (err: any) {
        recordError(`Раздел «${sec.title}»`, err)
        console.warn(`  ${colors.yellow}⚠ Раздел «${sec.title}»: ${err.message}${colors.reset}`)
      }
    }
  }

  // 3. Create Days
  const dayIdMap = new Map<number, string>()
  let existingDays: Array<{ id: string, date: string, title: string, activities?: Array<{ id: string, title?: string, startTime?: string, sections?: Array<{ id: string, type: string }> }> }> = []

  if (importDays) {
    console.log(`\n${colors.dim}📅 Создание дней маршрута (${tripData.days.length} дн.)...${colors.reset}`)

    // Clean up days if overwriteDays is enabled or for clean initial trip setup
    try {
      existingDays = await api.getDaysByTripId(createdTrip.id)
      if (Array.isArray(existingDays) && existingDays.length > 0) {
        if (overwriteDays || !targetTripId) {
          process.stdout.write(`  ${colors.dim}🧹 Очистка старых дней и активностей...${colors.reset} `)
          // Batch delete activities in chunks of 10
          const allActivitiesToDelete: string[] = []
          for (const exDay of existingDays) {
            if (Array.isArray(exDay.activities)) {
              for (const act of exDay.activities) {
                if (act.id)
                  allActivitiesToDelete.push(act.id)
              }
            }
          }

          const BATCH_SIZE = appConfig.batchSize || 8
          for (let b = 0; b < allActivitiesToDelete.length; b += BATCH_SIZE) {
            const chunk = allActivitiesToDelete.slice(b, b + BATCH_SIZE)
            const results = await Promise.allSettled(chunk.map(id => api.deleteActivity(id)))
            for (const result of results) {
              if (result.status === 'rejected')
                throw result.reason
            }
          }

          // Batch delete days in chunks of 5
          for (let b = 0; b < existingDays.length; b += BATCH_SIZE) {
            const chunk = existingDays.slice(b, b + BATCH_SIZE)
            const results = await Promise.allSettled(chunk.map(d => api.deleteDay(d.id)))
            for (const result of results) {
              if (result.status === 'rejected')
                throw result.reason
            }
          }

          existingDays = await api.getDaysByTripId(createdTrip.id)
          process.stdout.write(`${colors.green}Готово!${colors.reset}\n`)
        }
      }
    }
    catch (error) {
      recordError('Получение или очистка дней', error)
      throw error
    }

    for (let i = 0; i < tripData.days.length; i++) {
      const day = tripData.days[i]
      try {
        let createdDay: { id: string, title: string }

        const existingDay = existingDays.find(d => d.date === day.date)

        if (existingDay) {
          // Обновляем существующий день с совпадающей датой
          const targetId = existingDay.id
          await api.updateDay(targetId, {
            title: day.title,
            description: day.description,
            date: day.date,
          })
          createdDay = { id: targetId, title: day.title }
        }
        else {
          createdDay = await api.createDay({
            tripId: createdTrip.id,
            title: day.title,
            description: day.description,
            date: day.date,
          })
        }

        dayIdMap.set(day.dayNumber, createdDay.id)
        console.log(`  ${colors.green}✔ [День ${day.dayNumber}]${colors.reset} ${day.title} (${day.date})`)

        if (day.meta && day.meta.length > 0) {
          try {
            await api.updateDay(createdDay.id, {
              meta: day.meta,
              note: day.rawContent,
            })
            console.log(`    ${colors.cyan}🏷️  Добавлено ${day.meta.length} инфо-блоков day.meta${colors.reset}`)
          }
          catch (metaErr: any) {
            recordError(`day.meta дня ${day.dayNumber}`, metaErr)
            console.warn(`    ${colors.yellow}⚠ Ошибка сохранения day.meta: ${metaErr.message}${colors.reset}`)
          }
        }
      }
      catch (err: any) {
        recordError(`День ${day.dayNumber}`, err)
        console.error(`  ${colors.red}❌ Ошибка создания дня ${day.dayNumber}: ${err.message}${colors.reset}`)
      }
    }
  }

  // 4. Create Notes Hierarchy
  if (importNotes && (tripData.sectionFolders.length > 0 || tripData.rootNotes.length > 0)) {
    console.log(`\n${colors.dim}📝 Импорт структуры заметок и статей...${colors.reset}`)
    let existingNotes: Array<{ id: string, parentId?: string | null, type: string, title: string }> = []
    try {
      existingNotes = await api.getNotesByTripId(createdTrip.id)
    }
    catch (error) {
      recordError('Получение существующих заметок', error)
      throw error
    }

    for (const folder of tripData.sectionFolders) {
      try {
        const existingFolder = existingNotes.find(note => note.type === 'folder' && !note.parentId && note.title === folder.folderName)
        const folderRecord = existingFolder ?? await api.createNote({ tripId: createdTrip.id, type: 'folder', title: folder.folderName })
        console.log(`  ${colors.green}📁 Папка:${colors.reset} ${folder.folderName}`)

        for (const file of folder.files) {
          try {
            const existingNote = existingNotes.find(note => note.type === 'markdown' && note.parentId === folderRecord.id && note.title === file.title)
            const noteRecord = existingNote ?? await api.createNote({ tripId: createdTrip.id, parentId: folderRecord.id, type: 'markdown', title: file.title })

            await api.updateNote(noteRecord.id, {
              title: file.title,
              content: file.content,
            })
            console.log(`    ${colors.dim}📄 ${file.title}${colors.reset}`)
          }
          catch (fileErr: any) {
            recordError(`Файл ${file.title}`, fileErr)
            console.warn(`    ${colors.yellow}⚠ Файл ${file.title}: ${fileErr.message}${colors.reset}`)
          }
        }
      }
      catch (folderErr: any) {
        recordError(`Папка ${folder.folderName}`, folderErr)
        console.warn(`  ${colors.yellow}⚠ Папка ${folder.folderName}: ${folderErr.message}${colors.reset}`)
      }
    }

    if (tripData.rootNotes.length > 0) {
      for (const rootNote of tripData.rootNotes) {
        try {
          const existingNote = existingNotes.find(note => note.type === 'markdown' && !note.parentId && note.title === rootNote.title)
          const noteRecord = existingNote ?? await api.createNote({ tripId: createdTrip.id, type: 'markdown', title: rootNote.title })
          await api.updateNote(noteRecord.id, {
            title: rootNote.title,
            content: rootNote.content,
          })
          console.log(`  ${colors.green}📄 Корневая заметка:${colors.reset} ${rootNote.title}`)
        }
        catch (err: any) {
          recordError(`Заметка ${rootNote.title}`, err)
          console.warn(`  ${colors.yellow}⚠ Заметка ${rootNote.title}: ${err.message}${colors.reset}`)
        }
      }
    }
  }

  // 5. Generate & Create Activities (Blocks) for each day
  let totalActivitiesCreated = 0
  let totalImagesUploaded = 0
  let totalLocationsGeocoded = 0

  // Persistent caches (geocode + content-addressed LLM) and in-memory upload cache for the current run
  const geoCache = loadGeocodeCache()
  const llmCache = loadLlmCache()
  const uploadCache = new Map<string, string>()

  if (importActivities && importDays) {
    console.log(`\n${colors.dim}🧩 Генерация и добавление блоков активностей...${colors.reset}`)

    const imageIndex = buildImageIndex(targetDir)

    if (geoCache.size > 0) {
      console.log(`  ${colors.dim}📍 Загружен кеш геокодирования: ${geoCache.size} локаций${colors.reset}`)
    }
    if (llmCache.size > 0) {
      console.log(`  ${colors.dim}🤖 Загружен кеш ИИ распознавания: ${llmCache.size} дней${colors.reset}`)
    }

    if (imageIndex.size > 0) {
      console.log(`  ${colors.dim}📸 Проиндексировано локальных медиа-файлов: ${Math.round(imageIndex.size / 4)}${colors.reset}`)
    }

    for (const day of tripData.days) {
      const dayId = dayIdMap.get(day.dayNumber)
      if (!dayId)
        continue

      console.log(`\n${colors.bright}  [День ${day.dayNumber}] ${day.title}:${colors.reset}`)

      const rawActivities = parseActivitiesFromMarkdown(day.rawContent)
      let activitiesToCreate: ActivityPayload[] = []

      if (useLlm) {
        let llmActivities: ActivityPayload[] | null = null
        const dayHash = computeDayLlmHash(day.rawContent, selectedModel)

        if (llmCache.has(dayHash)) {
          const cachedEntry = llmCache.get(dayHash)!
          llmActivities = cachedEntry.activities
          console.log(`    ${colors.green}⚡ Использован кеш ИИ${colors.reset} ${colors.dim}(контент не менялся, получено ${llmActivities.length} блоков, 0 токенов)${colors.reset}`)
        }
        else {
          const directLlmKey = process.env.AI_HUBMIX_KEY || process.env.OPENAI_API_KEY
          if (directLlmKey) {
            try {
              process.stdout.write(`    ${colors.dim}🤖 Запрос к LLM (${colors.cyan}${selectedModel}${colors.dim})...${colors.reset} `)
              const directGenerated = await generateActivitiesViaDirectLlm(day.rawContent, selectedModel)
              if (directGenerated && directGenerated.length > 0) {
                llmActivities = directGenerated
                process.stdout.write(`${colors.green}OK (получено ${directGenerated.length} блоков)${colors.reset}\n`)
              }
              else {
                throw new Error('LLM не вернул распознанных активностей')
              }
            }
            catch (directErr: any) {
              process.stdout.write(`${colors.yellow}Ошибка прямого LLM: ${directErr.message}. Пробую серверный LLM...${colors.reset}\n`)
              try {
                process.stdout.write(`    ${colors.dim}🤖 Запрос к LLM на сервере...${colors.reset} `)
                const generated = await api.generateDayTemplate(dayId, {
                  prompt: 'Преобразуй этот план дня в структурированные блоки расписания (активности) с точным временем начала и конца, тегами и подробными секциями с описанием.',
                  currentActivities: [],
                  canvasNote: day.rawContent,
                })

                if (Array.isArray(generated) && generated.length > 0) {
                  llmActivities = generated
                  process.stdout.write(`${colors.green}OK (получено ${generated.length} блоков)${colors.reset}\n`)
                }
                else {
                  throw new Error('Пустой ответ от сервера')
                }
              }
              catch (serverLlmErr: any) {
                process.stdout.write(`${colors.yellow}Серверный LLM: ${serverLlmErr.message}. Использую встроенный парсер...${colors.reset}\n`)
              }
            }
          }
          else {
            try {
              process.stdout.write(`    ${colors.dim}🤖 Запрос к LLM на сервере...${colors.reset} `)
              const generated = await api.generateDayTemplate(dayId, {
                prompt: 'Преобразуй этот план дня в структурированные блоки расписания (активности) с точным временем начала и конца, тегами и подробными секциями с описанием.',
                currentActivities: [],
                canvasNote: day.rawContent,
              })

              if (Array.isArray(generated) && generated.length > 0) {
                llmActivities = generated
                process.stdout.write(`${colors.green}OK (получено ${generated.length} блоков)${colors.reset}\n`)
              }
              else {
                throw new Error('Пустой ответ от сервера')
              }
            }
            catch (serverLlmErr: any) {
              process.stdout.write(`${colors.yellow}Серверный LLM: ${serverLlmErr.message}${colors.reset}\n`)
            }
          }

          if (llmActivities && llmActivities.length > 0) {
            llmCache.set(dayHash, {
              date: new Date().toISOString(),
              model: selectedModel,
              activities: llmActivities,
            })
          }
        }

        if (llmActivities && llmActivities.length > 0) {
          if (rawActivities.length > 0) {
            activitiesToCreate = mergeLlmActivitiesWithRawMarkdown(llmActivities, rawActivities)
          }
          else {
            activitiesToCreate = llmActivities
          }
        }
        else {
          process.stdout.write(`    ${colors.dim}⚙️  Использую встроенный парсер таймлайна...${colors.reset}\n`)
          activitiesToCreate = rawActivities
        }
      }
      else {
        activitiesToCreate = rawActivities
      }

      // Enrich activities with geolocations, uploaded image galleries, note callouts, and matched bookings
      const enrichedActivities: ActivityPayload[] = []
      // Extract location context for the day to ensure accurate geocoding across multi-city trips
      let locationContext = tripData.cities.length > 0 ? tripData.cities[0] : undefined
      const locMatch = day.rawContent.match(/>[ \t]*\*\*(?:Локация|Location):\*\*[ \t]*([^\n]+)/i)
      const dayContextText = `${locMatch ? locMatch[1] : ''} ${day.title} ${day.fileName}`
      for (const city of tripData.cities) {
        if (new RegExp(`(^|[^\\wа-яёА-ЯЁ])${city}(?![\\wа-яёА-ЯЁ])`, 'iu').test(dayContextText)) {
          locationContext = city
          break
        }
      }

      for (let actIdx = 0; actIdx < activitiesToCreate.length; actIdx++) {
        const act = activitiesToCreate[actIdx]
        try {
          const enriched = await enrichActivityWithMediaAndLocation(
            act,
            imageIndex,
            api,
            createdTrip.id,
            geoCache,
            uploadCache,
            {
              uploadImages: cliOptions.uploadImages,
              geocode: cliOptions.geocode,
              locationContext,
              bookings: createdBookings,
              dayDate: day.date,
              onProgress: (msg) => {
                console.log(`      ${colors.dim}[${actIdx + 1}/${activitiesToCreate.length}] ${msg}${colors.reset}`)
              },
            },
          )
          enrichedActivities.push(enriched)
        }
        catch (error) {
          recordError(`Обогащение активности «${act.title}»`, error)
          enrichedActivities.push(act)
        }
      }

      const existingDayRecord = existingDays.find(d => d.id === dayId)
      const existingActs = existingDayRecord?.activities || []
      const retainedExistingActivityIds = new Set<string>()

      for (const act of enrichedActivities) {
        try {
          const expectedSectionIds = new Set((act.sections ?? []).map(section => section.id))
          const existingActivity = !overwriteDays
            ? existingActs.find(existing => existing.sections?.some(section => expectedSectionIds.has(section.id)))
            ?? existingActs.find(existing => existing.startTime === act.startTime && existing.title === act.title)
            : undefined
          const activityPayload = {
            dayId,
            title: act.title,
            startTime: act.startTime,
            endTime: act.endTime,
            tag: act.tag,
            sections: act.sections || [],
          }
          if (existingActivity)
            await api.updateActivity({ id: existingActivity.id, ...activityPayload })
          else
            await api.createActivity(activityPayload)
          if (existingActivity)
            retainedExistingActivityIds.add(existingActivity.id)

          const descSections = act.sections?.filter(s => s.type === 'description') || []
          const attachedNotes = descSections.filter(s => s.isAttached)
          const noteBadge = attachedNotes.length > 0
            ? ` ${colors.magenta}[📌 +${attachedNotes.length} ${attachedNotes.length === 1 ? 'заметка' : 'заметки'}: ${attachedNotes.map(n => n.title || 'Заметка').join(', ')}]${colors.reset}`
            : (descSections.length > 1 ? ` ${colors.magenta}[📝 +${descSections.length - 1} заметка]${colors.reset}` : '')
          const gallerySection = act.sections?.find(s => s.type === 'gallery') as any
          const galleryBadge = gallerySection?.imageUrls?.length ? ` ${colors.cyan}[📸 ${gallerySection.imageUrls.length} фото]${colors.reset}` : ''
          const geoSection = act.sections?.find(s => s.type === 'geolocation') as any
          const geoBadge = geoSection?.points?.length ? ` ${colors.green}[📍 ${geoSection.points[0].address || 'Локация'}]${colors.reset}` : ''
          const bookingSection = act.sections?.find(s => s.type === 'booking') as any
          let bookingBadge = ''
          if (bookingSection?.bookingId) {
            const matchedBooking = createdBookings.find(b => b.id === bookingSection.bookingId)
            if (matchedBooking) {
              const bType = matchedBooking.type === 'hotel' ? 'Отель' : (matchedBooking.type === 'flight' ? 'Билет' : 'Поезд')
              bookingBadge = ` ${colors.blue}[🎫 ${bType}: ${matchedBooking.title}]${colors.reset}`
            }
          }

          totalActivitiesCreated++
          if (gallerySection?.imageUrls?.length) {
            totalImagesUploaded += gallerySection.imageUrls.length
          }
          if (geoSection?.points?.length) {
            totalLocationsGeocoded += geoSection.points.length
          }

          const action = existingActivity ? '↻' : '✔'
          console.log(`    ${colors.green}${action} [${act.startTime}–${act.endTime}]${colors.reset} [${act.tag}] ${act.title}${noteBadge}${bookingBadge}${geoBadge}${galleryBadge}`)
        }
        catch (actErr: any) {
          recordError(`Активность «${act.title}»`, actErr)
          console.warn(`    ${colors.yellow}⚠ Активность «${act.title}»: ${actErr.message}${colors.reset}`)
        }
      }

      if (!overwriteDays) {
        for (const existing of existingActs) {
          const isImporterOwned = existing.sections?.some(
            (section, index) => section.id === stableId('activity-section', existing.startTime, section.type, index),
          )
          if (isImporterOwned && !retainedExistingActivityIds.has(existing.id)) {
            try {
              await api.deleteActivity(existing.id)
              console.log(`    ${colors.dim}🗑 Удалена отсутствующая в vault активность: ${existing.title}${colors.reset}`)
            }
            catch (error) {
              recordError(`Удаление устаревшей активности «${existing.title}»`, error)
            }
          }
        }
      }
    }
  }

  // Persist caches to disk for future runs
  saveGeocodeCache(geoCache)
  saveLlmCache(llmCache)
  const savedMessages: string[] = []
  if (geoCache.size > 0)
    savedMessages.push(`${geoCache.size} локаций`)
  if (llmCache.size > 0)
    savedMessages.push(`${llmCache.size} дней ИИ`)
  if (savedMessages.length > 0) {
    console.log(`\n${colors.dim}💾 Кеши сохранены: ${savedMessages.join(', ')}${colors.reset}`)
  }

  if (importErrors.length > 0) {
    if (!targetTripId) {
      try {
        await api.deleteTrip(createdTrip.id)
        console.error(`  ${colors.yellow}Созданное частично путешествие удалено.${colors.reset}`)
      }
      catch (cleanupError) {
        recordError('Удаление незавершенного путешествия', cleanupError)
      }
    }
    console.error(`\n${colors.bright}${colors.red}Импорт завершен с ошибками (${importErrors.length}):${colors.reset}`)
    for (const error of importErrors)
      console.error(`  ${colors.red}• ${error}${colors.reset}`)
    throw new Error(`Импорт не завершен полностью: ${importErrors.length} ошибок`)
  }

  console.log(`\n${colors.bright}${colors.green}════════════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.bright}${colors.green}  ✨ Импорт путешествия успешно завершен!${colors.reset}`)
  console.log(`${colors.bright}${colors.green}════════════════════════════════════════════════════════════════════${colors.reset}`)
  if (importActivities) {
    console.log(`  📊 Создано активностей: ${colors.bright}${totalActivitiesCreated}${colors.reset}`)
    if (totalImagesUploaded > 0)
      console.log(`  📸 Загружено фото:       ${colors.cyan}${totalImagesUploaded}${colors.reset}`)
    if (totalLocationsGeocoded > 0)
      console.log(`  📍 Локаций на карте:     ${colors.green}${totalLocationsGeocoded}${colors.reset}`)
  }
  const clientUrl = cliOptions.apiUrl.includes('localhost')
    ? cliOptions.apiUrl.replace(/:\d+$/, ':5173')
    : cliOptions.apiUrl.replace('-api.', '.')

  console.log(`  🌐 Откройте путешествие:  ${colors.bright}${colors.cyan}${clientUrl}/trips/${createdTrip.id}${colors.reset}\n`)
}
