import type { ActivityPayload, Booking } from '../types'
import process from 'node:process'
import { colors } from '../config/colors'
import { DEFAULT_TRIP_SECTIONS } from '../config/constants'
import { loadEnvIfAvailable } from '../config/env'
import { ApiClient } from '../lib/api-client'
import { enrichActivityWithMediaAndLocation } from '../lib/enricher'
import { buildImageIndex } from '../lib/image-indexer'
import { generateActivitiesViaDirectLlm, mergeLlmActivitiesWithRawMarkdown } from '../lib/llm'
import { parseActivitiesFromMarkdown } from '../parsers/activity'
import { parseObsidianTripFolder } from '../parsers/vault'
import { parseCliArgs } from './args'
import { promptForCredentials, promptForInteractiveOptions, promptForTargetDirectory } from './prompts'

export async function runImport(): Promise<void> {
  loadEnvIfAvailable()
  const cliOptions = parseCliArgs()

  console.log(`\n${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}    🛫 Obsidian ➔ Trip Scheduler Import Tool (Advanced)${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════${colors.reset}\n`)

  const targetDir = await promptForTargetDirectory(cliOptions.dir)

  console.log(`\n${colors.dim}📖 Чтение и парсинг структуры Obsidian...${colors.reset}`)
  let tripData
  try {
    tripData = parseObsidianTripFolder(targetDir, cliOptions.startDate)
  }
  catch (err: any) {
    console.error(`${colors.red}❌ Ошибка парсинга папки Obsidian: ${err.message}${colors.reset}`)
    process.exit(1)
  }

  console.log(`\n${colors.green}✔ Найдено в структуре Obsidian:${colors.reset}`)
  console.log(`  • Название:        ${colors.bright}${tripData.title}${colors.reset}`)
  console.log(`  • Описание:        ${colors.cyan}${tripData.descriptionShort}${colors.reset}`)
  console.log(`  • Города:          ${tripData.cities.join(', ') || 'Не определены'}`)
  console.log(`  • Теги:            ${tripData.tags.join(', ') || '—'}`)
  console.log(`  • Даты:            ${tripData.startDate} ➔ ${tripData.endDate} (${tripData.days.length} дн.)`)
  console.log(`  • Дней маршрута:   ${tripData.days.length}`)
  console.log(`  • Корневых файлов: ${tripData.rootNotes.length}`)
  console.log(`  • Папок с файлами: ${tripData.sectionFolders.length} (${tripData.sectionFolders.reduce((acc, f) => acc + f.files.length, 0)} файлов)`)
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

  // 1. Create or Initialize Trip
  console.log(`\n${colors.dim}🚀 Создание путешествия в Trip Scheduler...${colors.reset}`)
  let createdTrip
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

  // Update Trip Metadata & Cities
  if (importTripMeta) {
    try {
      await api.updateTrip(createdTrip.id, {
        title: tripData.title,
        description: tripData.description,
        descriptionShort: tripData.descriptionShort,
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
    catch {
      existingSections = []
    }

    for (const sec of DEFAULT_TRIP_SECTIONS) {
      try {
        let sectionContent: any = null

        if (sec.type === 'bookings') {
          sectionContent = tripData.bookingsContent && tripData.bookingsContent.bookings.length > 0 ? tripData.bookingsContent : null
        }
        else if (sec.type === 'checklist' && importChecklists) {
          sectionContent = tripData.checklistContent && tripData.checklistContent.items && tripData.checklistContent.items.length > 0 ? tripData.checklistContent : null
        }
        else if (sec.type === 'finances') {
          // Раздел «Финансы» создается чистым для логирования реальных трат во время поездки
          sectionContent = null
        }

        const existingSec = existingSections.find(s => s.type === sec.type)

        if (existingSec) {
          await api.updateTripSection(existingSec.id, {
            title: sec.title,
            icon: sec.icon,
            content: sectionContent,
          })
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
          console.log(`  ${colors.green}✔ Раздел «${sec.title}» наполнен:${colors.reset} ${hotelsCount > 0 ? `🏨 ${hotelsCount} отелей ` : ''}${flightsCount > 0 ? `✈️ ${flightsCount} рейсов ` : ''}${trainsCount > 0 ? `🚆 ${trainsCount} поездов ` : ''}${carsCount > 0 ? `🚗 ${carsCount} авто/трансферов ` : ''}${attractionsCount > 0 ? `🎟️ ${attractionsCount} билетов/пропусков` : ''}`)
        }
        else if (sec.type === 'checklist' && sectionContent?.items?.length > 0) {
          const totalItems = sectionContent.items.length
          const totalGroups = sectionContent.groups?.length || 0
          console.log(`  ${colors.green}✔ Раздел «${sec.title}» наполнен:${colors.reset} 📝 ${totalGroups} групп (${totalItems} пунктов)`)
        }
        else if (sec.type === 'finances') {
          console.log(`  ${colors.green}✔ Раздел создан:${colors.reset} ${sec.title} (готов для учета трат в поездке)`)
        }
        else {
          console.log(`  ${colors.green}✔ Раздел создан:${colors.reset} ${sec.title}`)
        }
      }
      catch (err: any) {
        console.warn(`  ${colors.yellow}⚠ Раздел «${sec.title}»: ${err.message}${colors.reset}`)
      }
    }
  }

  // 3. Create Days
  const dayIdMap = new Map<number, string>()

  if (importDays) {
    console.log(`\n${colors.dim}📅 Создание дней маршрута (${tripData.days.length} дн.)...${colors.reset}`)

    // Clean up initial placeholder days created automatically by server upon trip creation
    let existingDays: Array<{ id: string, date: string, title: string }> = []
    try {
      existingDays = await api.getDaysByTripId(createdTrip.id)
      if (Array.isArray(existingDays) && existingDays.length > 0) {
        for (const exDay of existingDays) {
          try {
            await api.deleteDay(exDay.id)
          }
          catch {
            // ignore if individual delete fails
          }
        }
        // Refresh remaining days in case delete failed
        existingDays = await api.getDaysByTripId(createdTrip.id)
      }
    }
    catch {
      existingDays = []
    }

    for (let i = 0; i < tripData.days.length; i++) {
      const day = tripData.days[i]
      try {
        let createdDay: { id: string, title: string }

        if (existingDays && existingDays.length > i && existingDays[i]?.id) {
          // Reuse remaining placeholder day if it couldn't be deleted
          const targetId = existingDays[i].id
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
            console.warn(`    ${colors.yellow}⚠ Ошибка сохранения day.meta: ${metaErr.message}${colors.reset}`)
          }
        }
      }
      catch (err: any) {
        console.error(`  ${colors.red}❌ Ошибка создания дня ${day.dayNumber}: ${err.message}${colors.reset}`)
      }
    }
  }

  // 4. Create Notes Hierarchy
  if (importNotes && (tripData.sectionFolders.length > 0 || tripData.rootNotes.length > 0)) {
    console.log(`\n${colors.dim}📝 Импорт структуры заметок и статей...${colors.reset}`)

    for (const folder of tripData.sectionFolders) {
      try {
        const folderRecord = await api.createNote({
          tripId: createdTrip.id,
          type: 'folder',
          title: folder.folderName,
        })
        console.log(`  ${colors.green}📁 Папка:${colors.reset} ${folder.folderName}`)

        for (const file of folder.files) {
          try {
            const noteRecord = await api.createNote({
              tripId: createdTrip.id,
              parentId: folderRecord.id,
              type: 'markdown',
              title: file.title,
            })

            await api.updateNote(noteRecord.id, {
              title: file.title,
              content: file.content,
            })
            console.log(`    ${colors.dim}📄 ${file.title}${colors.reset}`)
          }
          catch (fileErr: any) {
            console.warn(`    ${colors.yellow}⚠ Файл ${file.title}: ${fileErr.message}${colors.reset}`)
          }
        }
      }
      catch (folderErr: any) {
        console.warn(`  ${colors.yellow}⚠ Папка ${folder.folderName}: ${folderErr.message}${colors.reset}`)
      }
    }

    if (tripData.rootNotes.length > 0) {
      for (const rootNote of tripData.rootNotes) {
        try {
          const noteRecord = await api.createNote({
            tripId: createdTrip.id,
            type: 'markdown',
            title: rootNote.title,
          })
          await api.updateNote(noteRecord.id, {
            title: rootNote.title,
            content: rootNote.content,
          })
          console.log(`  ${colors.green}📄 Корневая заметка:${colors.reset} ${rootNote.title}`)
        }
        catch (err: any) {
          console.warn(`  ${colors.yellow}⚠ Заметка ${rootNote.title}: ${err.message}${colors.reset}`)
        }
      }
    }
  }

  // 5. Generate & Create Activities (Blocks) for each day
  if (importActivities && importDays) {
    console.log(`\n${colors.dim}🧩 Генерация и добавление блоков активностей...${colors.reset}`)

    const imageIndex = buildImageIndex(targetDir)
    const geoCache = new Map<string, [number, number]>()
    const uploadCache = new Map<string, string>()

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
      const locationContext = tripData.cities.length > 0 ? tripData.cities[0] : undefined

      for (const act of activitiesToCreate) {
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
            },
          )
          enrichedActivities.push(enriched)
        }
        catch {
          enrichedActivities.push(act)
        }
      }

      for (const act of enrichedActivities) {
        try {
          await api.createActivity({
            dayId,
            title: act.title,
            startTime: act.startTime,
            endTime: act.endTime,
            tag: act.tag,
            sections: act.sections || [],
          })

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

          console.log(`    ${colors.green}✔ [${act.startTime}–${act.endTime}]${colors.reset} [${act.tag}] ${act.title}${noteBadge}${bookingBadge}${geoBadge}${galleryBadge}`)
        }
        catch (actErr: any) {
          console.warn(`    ${colors.yellow}⚠ Активность «${act.title}»: ${actErr.message}${colors.reset}`)
        }
      }
    }
  }

  console.log(`\n${colors.bright}${colors.green}════════════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.bright}${colors.green}  ✨ Импорт путешествия успешно завершен!${colors.reset}`)
  console.log(`${colors.bright}${colors.green}════════════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`  🌐 Откройте путешествие: ${colors.cyan}${cliOptions.apiUrl.replace('-api.', '.')}/trips/${createdTrip.id}${colors.reset}\n`)
}
