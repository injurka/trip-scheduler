import type { Transport } from './transport'
import process from 'node:process'
import { colors } from '../config/colors'
import { DEFAULT_TRIP_SECTIONS } from '../config/constants'
import { parseActivitiesFromMarkdown } from '../parsers/activity'
import { parseObsidianTripFolder } from '../parsers/vault'
import { computeDayLlmHash, loadGeocodeCache, loadLlmCache, saveGeocodeCache, saveLlmCache } from './cache'
import { enrichActivityWithMediaAndLocation } from './enricher'
import { buildImageIndex } from './image-indexer'
import { generateActivitiesViaDirectLlm, mergeLlmActivitiesWithRawMarkdown } from './llm'

/**
 * Programmatic-ядро импорта: приводит папку Obsidian-вольта к данным Trip Scheduler
 * и прогоняет её через Transport (REST-клиент CLI или InProcessTransport сервера).
 * Вынесено из cli/importer.ts, чтобы один и тот же пайплайн можно было выполнять
 * без CLI (headless-импорт сгенерированных путешествий).
 *
 * @module
 */

export interface ImportCoreOptions {
  startDate?: string
  useLlm?: boolean
  llmModel?: string
  status?: 'planned' | 'draft' | 'completed'
  visibility?: 'private' | 'public'
  uploadImages?: boolean
  geocode?: boolean
  importTripMeta?: boolean
  importDays?: boolean
  importActivities?: boolean
  importChecklists?: boolean
  importNotes?: boolean
  importSections?: boolean
  onLog?: (message: string) => void
  onProgress?: (stage: string, detail?: string) => void
}

export interface ImportCoreResult {
  tripId: string
  title: string
  daysCreated: number
  activitiesCreated: number
  notesCreated: number
  sectionsCreated: number
}

function safeCall(fn: () => Promise<unknown>, log?: (message: string) => void, label = ''): Promise<void> {
  return fn().then(() => undefined).catch((err: any) => {
    log?.(`⚠ ${label}: ${err?.message || err}`)
    throw err
  })
}

export async function importTripFolderCore(
  targetDir: string,
  transport: Transport,
  options: ImportCoreOptions = {},
): Promise<ImportCoreResult> {
  const log = options.onLog
  const progress = options.onProgress
  const useLlm = options.useLlm !== false
  const uploadImages = options.uploadImages !== false
  const geocode = options.geocode !== false

  progress?.('parsing', 'Чтение и парсинг структуры Obsidian')
  const tripData = parseObsidianTripFolder(targetDir, options.startDate)

  log?.(`Найдено: ${tripData.title}, дней: ${tripData.days.length}, городов: ${tripData.cities.join(', ') || '—'}`)

  const importTripMeta = options.importTripMeta !== false
  const importDays = options.importDays !== false
  const importActivities = options.importActivities !== false
  const importChecklists = options.importChecklists !== false
  const importNotes = options.importNotes !== false
  const importSections = options.importSections !== false

  // 1. Create trip
  progress?.('trip', 'Создание путешествия')
  const createdTrip = await transport.createTrip({
    title: tripData.title,
    description: tripData.description,
    startDate: tripData.startDate,
    endDate: tripData.endDate,
  })

  try {
    let coverImageUrl = tripData.cover && /^https?:\/\//i.test(tripData.cover) ? tripData.cover : undefined
    if (uploadImages && tripData.coverImagePath && transport.uploadImage) {
      try {
        coverImageUrl = await transport.uploadImage(createdTrip.id, tripData.coverImagePath, 'route')
      }
      catch (err: any) {
        log?.(`⚠ Загрузка обложки: ${err?.message || err}`)
        throw err
      }
    }

    // Update trip metadata & cities
    if (importTripMeta) {
      await safeCall(async () => {
        await transport.updateTrip(createdTrip.id, {
          title: tripData.title,
          description: tripData.description,
          descriptionShort: tripData.descriptionShort,
          imageUrl: coverImageUrl,
          cities: tripData.cities,
          tags: tripData.tags,
          status: options.status,
          visibility: options.visibility,
          startDate: tripData.startDate,
          endDate: tripData.endDate,
        })
      }, log, 'Обновление метаданных')
    }

    const createdBookings = tripData.bookingsContent?.bookings || []

    // 2. Sections
    let sectionsCreated = 0
    if (importSections) {
      progress?.('sections', 'Наполнение разделов-вкладок')
      let existingSections: Array<{ id: string, type: string, title: string }> = []
      try {
        const details = await transport.getTripDetails(createdTrip.id)
        if (Array.isArray(details?.sections))
          existingSections = details.sections
      }
      catch (error) {
        log?.(`⚠ Получение разделов: ${error instanceof Error ? error.message : error}`)
        throw error
      }

      for (const sec of DEFAULT_TRIP_SECTIONS) {
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
            await transport.updateTripSection(existingSec.id, updatePayload)
          }
          else {
            await transport.createTripSection({
              tripId: createdTrip.id,
              type: sec.type,
              title: sec.title,
              icon: sec.icon,
              content: sectionContent,
            })
          }
          sectionsCreated++
        }
        catch (err: any) {
          log?.(`⚠ Раздел «${sec.title}»: ${err.message}`)
          throw err
        }
      }
    }

    // 3. Days
    const dayIdMap = new Map<number, string>()
    let activitiesCreated = 0
    let notesCreated = 0

    if (importDays) {
      progress?.('days', `Создание дней маршрута (${tripData.days.length})`)

      // Clean up initial placeholder days created automatically upon trip creation
      let existingDays: Array<{ id: string, date: string, title: string }> = []
      try {
        existingDays = await transport.getDaysByTripId(createdTrip.id)
        for (const exDay of existingDays) {
          await safeCall(() => transport.deleteDay(exDay.id), log, `Удаление плейсхолдера дня ${exDay.id}`)
        }
        if (existingDays.length > 0)
          existingDays = await transport.getDaysByTripId(createdTrip.id)
      }
      catch (error) {
        log?.(`⚠ Получение дней: ${error instanceof Error ? error.message : error}`)
        throw error
      }

      for (let i = 0; i < tripData.days.length; i++) {
        const day = tripData.days[i]
        try {
          let createdDay: { id: string, title: string }

          if (existingDays && existingDays.length > i && existingDays[i]?.id) {
          // Reuse remaining placeholder day if it couldn't be deleted
            const targetId = existingDays[i].id
            await transport.updateDay(targetId, {
              title: day.title,
              description: day.description,
              date: day.date,
            })
            createdDay = { id: targetId, title: day.title }
          }
          else {
            createdDay = await transport.createDay({
              tripId: createdTrip.id,
              title: day.title,
              description: day.description,
              date: day.date,
            })
          }

          dayIdMap.set(day.dayNumber, createdDay.id)

          if (day.meta && day.meta.length > 0) {
            await safeCall(() => transport.updateDay(createdDay.id, {
              meta: day.meta,
              note: day.rawContent,
            }), log, `day.meta дня ${day.dayNumber}`)
          }
        }
        catch (err: any) {
          log?.(`⚠ День ${day.dayNumber}: ${err.message}`)
          throw err
        }
      }
    }

    // 4. Notes
    if (importNotes && (tripData.sectionFolders.length > 0 || tripData.rootNotes.length > 0)) {
      progress?.('notes', 'Импорт структуры заметок')

      for (const folder of tripData.sectionFolders) {
        try {
          const folderRecord = await transport.createNote({
            tripId: createdTrip.id,
            type: 'folder',
            title: folder.folderName,
          })

          for (const file of folder.files) {
            try {
              const noteRecord = await transport.createNote({
                tripId: createdTrip.id,
                parentId: folderRecord.id,
                type: 'markdown',
                title: file.title,
              })

              await transport.updateNote(noteRecord.id, {
                title: file.title,
                content: file.content,
              })
              notesCreated++
            }
            catch (fileErr: any) {
              log?.(`⚠ Файл ${file.title}: ${fileErr.message}`)
              throw fileErr
            }
          }
        }
        catch (folderErr: any) {
          log?.(`⚠ Папка ${folder.folderName}: ${folderErr.message}`)
          throw folderErr
        }
      }

      for (const rootNote of tripData.rootNotes) {
        try {
          const noteRecord = await transport.createNote({
            tripId: createdTrip.id,
            type: 'markdown',
            title: rootNote.title,
          })
          await transport.updateNote(noteRecord.id, {
            title: rootNote.title,
            content: rootNote.content,
          })
          notesCreated++
        }
        catch (err: any) {
          log?.(`⚠ Заметка ${rootNote.title}: ${err.message}`)
          throw err
        }
      }
    }

    // 5. Activities
    if (importActivities && importDays) {
      progress?.('activities', 'Генерация и добавление блоков активностей')

      const imageIndex = uploadImages ? buildImageIndex(targetDir) : new Map<string, string>()
      const geoCache = loadGeocodeCache()
      const llmCache = loadLlmCache()
      const uploadCache = new Map<string, string>()

      for (const day of tripData.days) {
        const dayId = dayIdMap.get(day.dayNumber)
        if (!dayId)
          continue

        const rawActivities = parseActivitiesFromMarkdown(day.rawContent)
        let activitiesToCreate = rawActivities

        if (useLlm) {
          let llmActivities: import('../types').ActivityPayload[] | null = null
          const dayHash = computeDayLlmHash(day.rawContent, options.llmModel || 'default')

          if (llmCache.has(dayHash)) {
            llmActivities = llmCache.get(dayHash)!.activities
            log?.(`⚡ Использован кеш ИИ для дня ${day.dayNumber} (контент не менялся)`)
          }
          else {
            const directLlmKey = process.env.AI_HUBMIX_KEY || process.env.OPENAI_API_KEY
            if (directLlmKey) {
              try {
                const directGenerated = await generateActivitiesViaDirectLlm(day.rawContent, options.llmModel)
                if (directGenerated && directGenerated.length > 0) {
                  llmActivities = directGenerated
                }
                else {
                  throw new Error('LLM не вернул распознанных активностей')
                }
              }
              catch (directErr: any) {
                log?.(`Прямой LLM для дня ${day.dayNumber}: ${directErr.message}, пробую серверный`)
              }
            }

            if (!llmActivities) {
              try {
                const generated = await transport.generateDayTemplate?.(dayId, {
                  prompt: 'Преобразуй этот план дня в структурированные блоки расписания (активности) с точным временем начала и конца, тегами и подробными секциями с описанием.',
                  currentActivities: [],
                  canvasNote: day.rawContent,
                })

                if (Array.isArray(generated) && generated.length > 0) {
                  llmActivities = generated
                }
                else {
                  throw new Error('Пустой ответ от сервера')
                }
              }
              catch (serverLlmErr: any) {
                log?.(`Серверный LLM для дня ${day.dayNumber}: ${serverLlmErr.message}, использую встроенный парсер`)
              }
            }

            if (llmActivities && llmActivities.length > 0) {
              llmCache.set(dayHash, {
                date: new Date().toISOString(),
                model: options.llmModel || 'default',
                activities: llmActivities,
              })
            }
          }

          if (llmActivities && llmActivities.length > 0) {
            activitiesToCreate = rawActivities.length > 0
              ? mergeLlmActivitiesWithRawMarkdown(llmActivities, rawActivities)
              : llmActivities
          }
        }

        const enrichedActivities: import('../types').ActivityPayload[] = []
        let locationContext = tripData.cities.length > 0 ? tripData.cities[0] : undefined
        const locationMatch = day.rawContent.match(/>[ \t]*\*\*(?:Локация|Location):\*\*[ \t]*([^\n]+)/i)
        const dayContextText = `${locationMatch?.[1] ?? ''} ${day.title} ${day.fileName}`
        for (const city of tripData.cities) {
          if (new RegExp(`(^|[^\\wа-яёА-ЯЁ])${city}(?![\\wа-яёА-ЯЁ])`, 'iu').test(dayContextText)) {
            locationContext = city
            break
          }
        }
        const uploader = transport.uploadImage
          ? { uploadImage: transport.uploadImage.bind(transport) }
          : null

        for (const act of activitiesToCreate) {
          try {
            const enriched = await enrichActivityWithMediaAndLocation(
              act,
              imageIndex,

              uploader,
              createdTrip.id,
              geoCache,
              uploadCache,
              {
                uploadImages,
                geocode,
                locationContext,
                bookings: createdBookings,
                dayDate: day.date,
              },
            )
            enrichedActivities.push(enriched)
          }
          catch (error) {
            if (uploadImages)
              throw error
            enrichedActivities.push(act)
          }
        }

        for (const act of enrichedActivities) {
          try {
            await transport.createActivity({
              dayId,
              title: act.title,
              startTime: act.startTime,
              endTime: act.endTime,
              tag: act.tag,
              sections: act.sections || [],
            })
            activitiesCreated++
          }
          catch (actErr: any) {
            log?.(`⚠ Активность «${act.title}»: ${actErr.message}`)
            throw actErr
          }
        }
      }

      saveGeocodeCache(geoCache)
      saveLlmCache(llmCache)
    }

    log?.(`${colors.green}Импорт «${tripData.title}» завершен: дней ${dayIdMap.size}, активностей ${activitiesCreated}, заметок ${notesCreated}${colors.reset}`)

    return {
      tripId: createdTrip.id,
      title: tripData.title,
      daysCreated: dayIdMap.size,
      activitiesCreated,
      notesCreated,
      sectionsCreated,
    }
  }
  catch (error) {
    if (transport.deleteTrip) {
      try {
        await transport.deleteTrip(createdTrip.id)
        log?.(`Удалено незавершенное путешествие ${createdTrip.id}`)
      }
      catch (cleanupError: any) {
        log?.(`⚠ Не удалось удалить незавершенное путешествие: ${cleanupError?.message || cleanupError}`)
      }
    }
    throw error
  }
}
