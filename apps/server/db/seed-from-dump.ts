/* eslint-disable no-console */
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import prompts from 'prompts'
import { v4 as uuidv4 } from 'uuid'
import { s3Service } from '../src/services/s3.service'
import { db } from './index'
import {
  activities,
  blogs,
  comments,
  countries,
  days,
  destinationReviews,
  emailVerificationTokens,
  highlights,
  llmModels,
  llmTokenUsage,
  marks,
  memories,
  metroLines,
  metroLineStations,
  metroStations,
  metroSystems,
  plans,
  postElements,
  postMedia,
  posts,
  refreshTokens,
  savedPosts,
  tripImages,
  tripParticipants,
  trips,
  tripSections,
  users,
} from './schema'

// ─────────────────────────────────────────────────────────────
// Типы
// ─────────────────────────────────────────────────────────────

interface DumpData {
  users: any[]
  trips: any[]
  posts: any[]
  blogs: any[]
  metro: any[]
  marks?: any[]
  highlights?: any[]
  destinationReviews?: any[]
  countries?: any[]
}

interface SelectedDump {
  path: string
  isFolder: boolean
}

// ─────────────────────────────────────────────────────────────
// Утилиты
// ─────────────────────────────────────────────────────────────

const MAX_PG_PARAMS = 65_535

function summarizeRecord(rec: Record<string, any>): string {
  const keys = Object.keys(rec)
  const parts: string[] = []

  // id всегда первый
  if (rec.id !== undefined)
    parts.push(`id=${rec.id}`)

  // ключевые FK и имена
  for (const k of ['tripId', 'dayId', 'userId', 'postId', 'title', 'slug', 'name']) {
    if (rec[k] !== undefined && k !== 'id') {
      const val = typeof rec[k] === 'string' && rec[k].length > 60 ? `${rec[k].slice(0, 60)}…` : rec[k]
      parts.push(`${k}=${val}`)
    }
  }

  // кол-во полей с длинным текстом (>200 символов)
  const largeFields = keys.filter(k => typeof rec[k] === 'string' && rec[k].length > 200)
  if (largeFields.length > 0)
    parts.push(`${largeFields.length} больших текстовых поля`)

  return parts.length > 0 ? parts.join(', ') : `${keys.length} полей`
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value)
    return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function toDateString(value: string | Date | null | undefined): string | null {
  const d = toDate(value)
  return d ? d.toISOString().split('T')[0] : null
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}мс` : `${(ms / 1000).toFixed(1)}с`
}

// Моки исключены из docker-образа (.dockerignore: ./db/mock),
// поэтому подгружаем их лениво — только когда дамп не содержит нужных данных.
// Путь собирается через переменную, чтобы Bun НЕ резолвил его статически
// (иначе скрипт падает при старте, если ./mock/ нет на диске).
// При флаге --skip-mock не пытаемся импортировать вообще — сразу null.
let skipMock = false

async function loadMock<T = any>(fileName: string, exportName: string): Promise<T[] | null> {
  if (skipMock)
    return null

  try {
    const mockPath = `./mock/${fileName}`
    const mod = await import(mockPath)
    return (mod[exportName] as T[]) ?? null
  }
  catch {
    return null
  }
}

async function safeInsert<T extends Record<string, any>>(
  label: string,
  table: any,
  rows: T[],
): Promise<{ success: number, failed: number }> {
  if (rows.length === 0) {
    console.log(`   ⏭️  [${label}] нет данных`)
    return { success: 0, failed: 0 }
  }

  const columnCount = Object.keys(rows[0]).length
  const chunkSize = Math.max(1, Math.floor(MAX_PG_PARAMS / columnCount) - 10)
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += chunkSize)
    chunks.push(rows.slice(i, i + chunkSize))

  const start = Date.now()

  try {
    for (const chunk of chunks)
      await db.insert(table).values(chunk)

    console.log(
      `   ✅ [${label}] ${rows.length} записей${chunks.length > 1 ? ` (${chunks.length} чанков)` : ''} — ${formatDuration(Date.now() - start)}`,
    )
    return { success: rows.length, failed: 0 }
  }
  catch {
    console.warn(`   ⚠️  [${label}] Chunk-вставка упала, переходим к поштучной...`)
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < rows.length; i++) {
      try {
        await db.insert(table).values([rows[i]])
        successCount++
      }
      catch (err) {
        failCount++
        const reason = err instanceof Error ? err.message : String(err)
        const summary = summarizeRecord(rows[i])
        console.error(`   ❌ [${label}] #${i}: ${reason}`)
        console.error(`      ↳ ${summary}`)
      }
    }

    const icon = failCount === 0 ? '✅' : '⚠️ '
    console.log(`   ${icon} [${label}] ✅ ${successCount} успешно, ❌ ${failCount} ошибок — ${formatDuration(Date.now() - start)}`)
    return { success: successCount, failed: failCount }
  }
}

// ─────────────────────────────────────────────────────────────
// Валидаторы
// ─────────────────────────────────────────────────────────────

function validateTrip(trip: any, index: number): void {
  const errors: string[] = []
  if (!trip.id)
    errors.push('нет id')
  if (!trip.userId)
    errors.push('нет userId')
  if (!trip.title)
    errors.push('нет title')
  if (!trip.startDate)
    errors.push('нет startDate')
  if (!trip.endDate)
    errors.push('нет endDate')
  if (trip.startDate && Number.isNaN(new Date(trip.startDate).getTime()))
    errors.push(`невалидный startDate: "${trip.startDate}"`)
  if (trip.endDate && Number.isNaN(new Date(trip.endDate).getTime()))
    errors.push(`невалидный endDate: "${trip.endDate}"`)

  if (errors.length > 0)
    console.error(`   ❌ [Trip #${index}] id=${trip.id ?? '?'}: ${errors.join(', ')}`)
}

// ─────────────────────────────────────────────────────────────
// Чтение дампа из S3
// ─────────────────────────────────────────────────────────────

async function discoverAndSelectS3Dump(latest = false): Promise<string | null> {
  console.log('☁️  Получение списка дампов из S3...')
  try {
    const folders = await s3Service.listDumpFolders('dumps/')
    if (!folders || folders.length === 0)
      return null

    const sorted = folders.sort((a, b) => b.localeCompare(a))

    if (latest) {
      console.log(`☁️  Флаг --latest: выбран последний дамп ${sorted[0]}`)
      return sorted[0]
    }

    const response = await prompts({
      type: 'select',
      name: 'selected',
      message: 'Выберите S3 дамп для восстановления',
      choices: sorted.map(f => ({
        title: `☁️ ${f}`,
        value: f,
      })),
      hint: '- Стрелки для выбора, Enter для подтверждения',
    })

    return response.selected ?? null
  }
  catch (error) {
    console.error('❌ Ошибка при работе с S3:', error)
    return null
  }
}

async function readJsonFilesFromS3Dir(prefix: string): Promise<any[]> {
  try {
    const files = await s3Service.listFilesInFolder(prefix)
    const jsonFiles = files.filter(f => f.endsWith('.json'))

    const items = await Promise.all(
      jsonFiles.map(async (key) => {
        const content = await s3Service.getFileContent(key)
        return JSON.parse(content)
      }),
    )
    return items.flat()
  }
  catch {
    return []
  }
}

async function readDumpFromS3(prefix: string): Promise<DumpData> {
  console.log('☁️ Чтение папочного дампа из S3...')

  const basePath = prefix.endsWith('/') ? prefix : `${prefix}/`

  const [usersRaw, countriesRaw, marksRaw, trips, posts, blogs, metro, highlightsData, destinationReviewsData] = await Promise.all([
    s3Service.getFileContent(`${basePath}users/all.json`).then(JSON.parse).catch(() => []),
    readJsonFilesFromS3Dir(`${basePath}countries/`),
    readJsonFilesFromS3Dir(`${basePath}marks/`),
    readJsonFilesFromS3Dir(`${basePath}trips/`),
    readJsonFilesFromS3Dir(`${basePath}posts/`),
    readJsonFilesFromS3Dir(`${basePath}blogs/`),
    readJsonFilesFromS3Dir(`${basePath}metro/`),
    readJsonFilesFromS3Dir(`${basePath}highlights/`),
    readJsonFilesFromS3Dir(`${basePath}destination-reviews/`),
  ])

  const users = Array.isArray(usersRaw) ? usersRaw : []
  console.log(`   👤 users: ${users.length} | ✈️  trips: ${trips.length} | 📝 posts: ${posts.length} | 📰 blogs: ${blogs.length} | 🚇 metro: ${metro.length} | 📸 highlights: ${highlightsData.length} | ⭐ reviews: ${destinationReviewsData.length}`)

  return { users, countries: countriesRaw, marks: marksRaw, trips, posts, blogs, metro, highlights: highlightsData, destinationReviews: destinationReviewsData }
}

// ─────────────────────────────────────────────────────────────
// Чтение дампа из папочной структуры (ЛОКАЛЬНО)
// ─────────────────────────────────────────────────────────────

async function readJsonFilesFromDir(dir: string): Promise<any[]> {
  try {
    const files = await fs.readdir(dir)
    const items = await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .map(async (f) => {
          const content = await fs.readFile(path.join(dir, f), 'utf-8')
          return JSON.parse(content)
        }),
    )
    return items.flat()
  }
  catch {
    return []
  }
}

async function readDumpFromFolder(folderPath: string): Promise<DumpData> {
  console.log('📂 Чтение папочного дампа...')

  const [usersRaw, countriesRaw, marksRaw, trips, posts, blogs, metro, highlightsData, destinationReviewsData] = await Promise.all([
    fs.readFile(path.join(folderPath, 'users', 'all.json'), 'utf-8').then(JSON.parse).catch(() => []),
    readJsonFilesFromDir(path.join(folderPath, 'countries')),
    readJsonFilesFromDir(path.join(folderPath, 'marks')),
    readJsonFilesFromDir(path.join(folderPath, 'trips')),
    readJsonFilesFromDir(path.join(folderPath, 'posts')),
    readJsonFilesFromDir(path.join(folderPath, 'blogs')),
    readJsonFilesFromDir(path.join(folderPath, 'metro')),
    readJsonFilesFromDir(path.join(folderPath, 'highlights')),
    readJsonFilesFromDir(path.join(folderPath, 'destination-reviews')),
  ])

  const users = Array.isArray(usersRaw) ? usersRaw : []

  console.log(`   👤 users: ${users.length} | ✈️  trips: ${trips.length} | 📝 posts: ${posts.length} | 📰 blogs: ${blogs.length} | 🚇 metro: ${metro.length} | 📸 highlights: ${highlightsData.length} | ⭐ reviews: ${destinationReviewsData.length}`)

  return { users, countries: countriesRaw, marks: marksRaw, trips, posts, blogs, metro, highlights: highlightsData, destinationReviews: destinationReviewsData }
}

async function discoverAndSelectLocalDump(): Promise<SelectedDump | null> {
  const dumpDir = path.join(__dirname, 'dump')

  try {
    const entries = await fs.readdir(dumpDir, { withFileTypes: true })

    interface DumpOption { name: string, path: string, time: number, isFolder: boolean }
    const options: DumpOption[] = await Promise.all(
      entries
        .filter(e => e.isDirectory() || (e.isFile() && e.name.endsWith('.json')))
        .map(async (e) => {
          const fullPath = path.join(dumpDir, e.name)
          const stats = await fs.stat(fullPath)
          return {
            name: e.name,
            path: fullPath,
            time: stats.mtime.getTime(),
            isFolder: e.isDirectory(),
          }
        }),
    )

    const sorted = options.sort((a, b) => b.time - a.time)
    if (sorted.length === 0)
      return null

    const response = await prompts(
      {
        type: 'select',
        name: 'selected',
        message: 'Выберите локальный дамп для восстановления',
        choices: sorted.map(item => ({
          title: item.isFolder ? `📁 ${item.name}/` : `📄 ${item.name}`,
          description: `изменён: ${new Date(item.time).toLocaleString()}${item.isFolder ? '' : ' [устаревший формат]'}`,
          value: { path: item.path, isFolder: item.isFolder } satisfies SelectedDump,
        })),
        hint: '- Стрелки для выбора, Enter для подтверждения',
      },
    )

    return response.selected ?? null
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT')
      return null
    throw error
  }
}

// ─────────────────────────────────────────────────────────────
// Секции восстановления
// ─────────────────────────────────────────────────────────────

async function restoreMetro(sourceMetro: any[]): Promise<void> {
  console.log('\n🚇 Восстановление данных Метро...')

  if (sourceMetro.length > 0) {
    console.log(`   📂 В дампе: ${sourceMetro.length} систем`)
    for (const system of sourceMetro) {
      await db.insert(metroSystems)
        .values({ id: system.id, city: system.city, country: system.country })
        .onConflictDoNothing()

      if (!Array.isArray(system.lines))
        continue

      for (const line of system.lines) {
        await db.insert(metroLines)
          .values({ id: line.id, systemId: system.id, name: line.name, color: line.color, lineNumber: line.lineNumber })
          .onConflictDoNothing()

        if (!Array.isArray(line.lineStations))
          continue

        for (const ls of line.lineStations) {
          if (!ls.station)
            continue
          await db.insert(metroStations)
            .values({ id: ls.station.id, systemId: system.id, name: ls.station.name })
            .onConflictDoNothing()
          await db.insert(metroLineStations)
            .values({ lineId: line.id, stationId: ls.station.id, order: ls.order })
            .onConflictDoNothing()
        }
      }
    }
    console.log('   ✅ Метро из дампа восстановлено')
  }
  else {
    const mockMetro = await loadMock('02.metro', 'MOCK_METRO_DATA')
    if (!mockMetro) {
      console.log('   ⏭️  В дампе нет данных метро, а моки недоступны — пропускаем')
      return
    }
    console.log('   ⚠️  В дампе нет данных метро. Используем MOCK_METRO_DATA...')
    for (const system of mockMetro) {
      const [insertedSystem] = await db.insert(metroSystems)
        .values({ id: system.id, city: system.city, country: system.country })
        .returning()

      for (const line of system.lines) {
        const [insertedLine] = await db.insert(metroLines)
          .values({ id: line.id, systemId: insertedSystem.id, name: line.name, color: line.color, lineNumber: line.lineNumber })
          .returning()

        const stationsToInsert = line.stations.map((s: any) => ({
          id: s.id,
          systemId: insertedSystem.id,
          name: s.name,
        }))
        if (stationsToInsert.length > 0)
          await db.insert(metroStations).values(stationsToInsert).onConflictDoNothing()

        const lineStationsToInsert = line.stations.map((s: any, idx: number) => ({
          lineId: insertedLine.id,
          stationId: s.id,
          order: idx,
        }))
        if (lineStationsToInsert.length > 0)
          await db.insert(metroLineStations).values(lineStationsToInsert).onConflictDoNothing()
      }
    }
    console.log('   ✅ MOCK_METRO_DATA восстановлен')
  }
}

async function restoreTrips(sourceTrips: any[]): Promise<void> {
  console.log('\n✈️  Восстановление путешествий...')

  const tripsToInsert: (typeof trips.$inferInsert)[] = []
  const sectionsToInsert: (typeof tripSections.$inferInsert)[] = []
  const participantsToInsert: (typeof tripParticipants.$inferInsert)[] = []
  const daysToInsert: (typeof days.$inferInsert)[] = []
  const activitiesToInsert: (typeof activities.$inferInsert)[] = []
  const imagesToInsert: (typeof tripImages.$inferInsert)[] = []
  const memoriesToInsert: (typeof memories.$inferInsert)[] = []

  for (let i = 0; i < sourceTrips.length; i++) {
    const {
      days: tripDays,
      images: tripImagesData,
      memories: tripMemories,
      sections,
      participants,
      user: _user,
      ...tripDetails
    } = sourceTrips[i]

    validateTrip(tripDetails, i)

    tripsToInsert.push({
      ...tripDetails,
      startDate: toDateString(tripDetails.startDate),
      endDate: toDateString(tripDetails.endDate),
      createdAt: toDate(tripDetails.createdAt) ?? new Date(),
      updatedAt: toDate(tripDetails.updatedAt) ?? new Date(),
    })

    sections?.forEach((section: any) => {
      if (!section.id || !section.tripId)
        console.warn(`   ⚠️  [TripSection] trip=${tripDetails.id}: секция без id/tripId`)
      sectionsToInsert.push({
        ...section,
        createdAt: toDate(section.createdAt) ?? new Date(),
        updatedAt: toDate(section.updatedAt) ?? new Date(),
      })
    })

    participants?.forEach((p: any) => {
      if (!p.tripId || !p.userId)
        console.warn(`   ⚠️  [TripParticipant] trip=${tripDetails.id}: участник без tripId/userId`)
      participantsToInsert.push(p)
    })

    tripDays?.forEach((day: any) => {
      const { activities: dayActivities, ...dayDetails } = day
      if (!day.id || !day.tripId)
        console.warn(`   ⚠️  [Day] trip=${tripDetails.id}: день без id/tripId`)

      daysToInsert.push({
        ...dayDetails,
        date: toDateString(day.date),
        createdAt: toDate(dayDetails.createdAt) ?? new Date(),
        updatedAt: toDate(dayDetails.updatedAt) ?? new Date(),
      })

      dayActivities?.forEach((activity: any) => {
        if (!activity.id || !activity.dayId)
          console.warn(`   ⚠️  [Activity] day=${day.id}: активность без id/dayId`)
        activitiesToInsert.push({
          ...activity,
          createdAt: toDate(activity.createdAt) ?? new Date(),
          updatedAt: toDate(activity.updatedAt) ?? new Date(),
        })
      })
    })

    tripImagesData?.forEach((image: any) => {
      imagesToInsert.push({
        ...image,
        createdAt: toDate(image.createdAt) ?? new Date(),
        takenAt: toDate(image.takenAt),
      })
    })

    tripMemories?.forEach((memory: any) => {
      memoriesToInsert.push({
        ...memory,
        timestamp: toDate(memory.timestamp),
        createdAt: toDate(memory.createdAt) ?? new Date(),
        updatedAt: toDate(memory.updatedAt) ?? new Date(),
      })
    })
  }

  console.log(`   📊 trips=${tripsToInsert.length} | sections=${sectionsToInsert.length} | participants=${participantsToInsert.length}`)
  console.log(`   📊 days=${daysToInsert.length} | activities=${activitiesToInsert.length} | images=${imagesToInsert.length} | memories=${memoriesToInsert.length}`)

  await safeInsert('trips', trips, tripsToInsert)
  await Promise.all([
    safeInsert('tripSections', tripSections, sectionsToInsert),
    safeInsert('tripParticipants', tripParticipants, participantsToInsert),
  ])
  await safeInsert('days', days, daysToInsert)
  await Promise.all([
    safeInsert('activities', activities, activitiesToInsert),
    safeInsert('tripImages', tripImages, imagesToInsert),
  ])
  await safeInsert('memories', memories, memoriesToInsert)
}

async function restorePosts(sourcePosts: any[]): Promise<void> {
  console.log('\n📝 Восстановление постов...')

  const postsToInsert: (typeof posts.$inferInsert)[] = []
  const elementsToInsert: (typeof postElements.$inferInsert)[] = []
  const mediaToInsert: (typeof postMedia.$inferInsert)[] = []
  const savedPostsToInsert: (typeof savedPosts.$inferInsert)[] = []

  for (const postData of sourcePosts) {
    const { elements, media, savedBy, ...postDetails } = postData

    postsToInsert.push({
      ...postDetails,
      createdAt: toDate(postDetails.createdAt) ?? new Date(),
      updatedAt: toDate(postDetails.updatedAt) ?? new Date(),
    })

    elements?.forEach((el: any) => {
      elementsToInsert.push({
        ...el,
        createdAt: toDate(el.createdAt) ?? new Date(),
        updatedAt: toDate(el.updatedAt) ?? new Date(),
      })
    })

    media?.forEach((m: any) => {
      mediaToInsert.push({
        ...m,
        createdAt: toDate(m.createdAt) ?? new Date(),
        takenAt: toDate(m.takenAt),
      })
    })

    savedBy?.forEach((s: any) => {
      savedPostsToInsert.push({
        ...s,
        createdAt: toDate(s.createdAt) ?? new Date(),
      })
    })
  }

  console.log(`   📊 posts=${postsToInsert.length} | elements=${elementsToInsert.length} | media=${mediaToInsert.length} | saved=${savedPostsToInsert.length}`)

  await safeInsert('posts', posts, postsToInsert)
  await Promise.all([
    safeInsert('postElements', postElements, elementsToInsert),
    safeInsert('postMedia', postMedia, mediaToInsert),
    safeInsert('savedPosts', savedPosts, savedPostsToInsert),
  ])
}

async function restoreBlogs(sourceBlogs: any[]): Promise<void> {
  console.log('\n📰 Восстановление блогов...')
  const blogsToInsert = sourceBlogs.map((blog: any) => ({
    ...blog,
    publishedAt: toDate(blog.publishedAt),
    createdAt: toDate(blog.createdAt) ?? new Date(),
    updatedAt: toDate(blog.updatedAt) ?? new Date(),
  }))
  await safeInsert('blogs', blogs, blogsToInsert)
}

// ─────────────────────────────────────────────────────────────
// Главная функция
// ─────────────────────────────────────────────────────────────

async function seedFromJson(): Promise<void> {
  console.log('🌱 Восстановление базы данных из JSON дампа...\n')

  let dumpData: DumpData

  // Флаги CLI: --s3 (источник S3), --latest (последний дамп без промпта), --skip-mock (без локальных моков), --log <file> (запись логов в файл)
  // Первый позиционный аргумент (без --) — путь к локальному дампу
  const cliArgs = process.argv.slice(2)
  const forceS3 = cliArgs.includes('--s3')
  const useLatest = cliArgs.includes('--latest')
  skipMock = cliArgs.includes('--skip-mock')
  const filePathArg = cliArgs.find(a => !a.startsWith('--'))

  function getArgValue(args: string[], flag: string): string | null {
    const idx = args.indexOf(flag)
    if (idx === -1 || idx + 1 >= args.length)
      return null
    const val = args[idx + 1]
    return val.startsWith('--') ? null : val
  }

  const logFilePath = getArgValue(cliArgs, '--log')
  let logStream: ReturnType<typeof createWriteStream> | null = null

  if (logFilePath) {
    try {
      logStream = createWriteStream(logFilePath, { flags: 'a' })
      const origLog = console.log.bind(console)
      const origErr = console.error.bind(console)
      const origWarn = console.warn.bind(console)

      const tee = (origFn: (...a: any[]) => void) =>
        (...args: any[]) => {
          origFn(...args)
          if (logStream) {
            logStream.write(`${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`)
          }
        }

      console.log = tee(origLog)
      console.error = tee(origErr)
      console.warn = tee(origWarn)
      console.log(`📝 Лог пишется в ${logFilePath}`)
    }
    catch {
      console.warn(`⚠️  Не удалось открыть лог-файл ${logFilePath}, пишу только в консоль`)
    }

    // Закрыть лог-файл при любом выходе (включая Ctrl+C)
    process.on('exit', () => {
      logStream?.end()
    })
  }

  let source: 'local' | 's3' | undefined
  if (forceS3) {
    source = 's3'
  }
  else if (filePathArg) {
    source = 'local'
  }
  else {
    // Выбор источника (Local / S3)
    const sourceResponse = await prompts({
      type: 'select',
      name: 'source',
      message: 'Откуда вы хотите восстановить дамп?',
      choices: [
        { title: 'Локальная папка (db/dump)', value: 'local' },
        { title: 'S3 Хранилище', value: 's3' },
      ],
    })
    source = sourceResponse.source
  }

  if (!source) {
    console.log('🚫 Операция отменена.')
    process.exit(0)
  }

  // S3
  if (source === 's3') {
    const selectedS3Prefix = await discoverAndSelectS3Dump(useLatest)
    if (!selectedS3Prefix) {
      console.error('❌ В S3 дампы не найдены или операция прервана.')
      process.exit(1)
    }
    console.log(`📁 Выбран S3 дамп: ${selectedS3Prefix}`)
    dumpData = await readDumpFromS3(selectedS3Prefix)
  }
  // Local
  else {
    if (filePathArg) {
      const resolvedPath = path.resolve(process.cwd(), filePathArg)
      const stat = await fs.stat(resolvedPath)

      if (stat.isDirectory()) {
        console.log(`📁 Используется папка: ${path.basename(resolvedPath)}/`)
        dumpData = await readDumpFromFolder(resolvedPath)
      }
      else {
        console.log(`📄 Используется legacy-файл: ${path.basename(resolvedPath)}`)
        const fileContent = await fs.readFile(resolvedPath, 'utf-8')
        dumpData = JSON.parse(fileContent)
      }
    }
    else {
      const selected = await discoverAndSelectLocalDump()
      if (!selected) {
        console.error('❌ Локальные дампы не найдены в `db/dump`.')
        console.log('ℹ️  Создайте дамп: `bun run db:dump`')
        process.exit(1)
      }

      if (selected.isFolder) {
        console.log(`📁 Выбрана папка: ${path.basename(selected.path)}/`)
        dumpData = await readDumpFromFolder(selected.path)
      }
      else {
        console.log(`📄 Выбран legacy-файл: ${path.basename(selected.path)}`)
        const fileContent = await fs.readFile(selected.path, 'utf-8')
        dumpData = JSON.parse(fileContent)
      }
    }
  }

  const {
    users: sourceUsers,
    countries: sourceCountries,
    trips: sourceTrips,
    posts: sourcePosts,
    blogs: sourceBlogs,
    metro: sourceMetro,
    marks: sourceMarks,
    highlights: sourceHighlights,
    destinationReviews: sourceReviews,
  } = dumpData

  if (!Array.isArray(sourceUsers)) {
    console.error('❌ Неверный формат дампа: отсутствует поле `users`.')
    process.exit(1)
  }

  const startTime = Date.now()

  // 2. Очистка (строго по FK: дочерние → родительские)
  console.log('\n🗑️  Очистка таблиц...')
  await db.delete(highlights)
  await db.delete(destinationReviews)
  await db.delete(countries)
  await db.delete(blogs)
  await db.delete(savedPosts)
  await db.delete(postMedia)
  await db.delete(postElements)
  await db.delete(posts)
  await db.delete(llmTokenUsage)
  await db.delete(llmModels)
  await db.delete(marks)
  await db.delete(memories)
  await db.delete(activities)
  await db.delete(days)
  await db.delete(comments)
  await db.delete(tripSections)
  await db.delete(tripImages)
  await db.delete(tripParticipants)
  await db.delete(trips)
  await db.delete(refreshTokens)
  await db.delete(emailVerificationTokens)
  await db.delete(users)
  await db.delete(plans)
  await db.delete(metroLineStations)
  await db.delete(metroStations)
  await db.delete(metroLines)
  await db.delete(metroSystems)
  console.log('   ✅ Все таблицы очищены')

  // 3. Справочники (независимы — параллельно)
  console.log('\n⭐ Восстановление справочников...')

  const [subscriptionMock, llmMock] = await Promise.all([
    loadMock('03.subscription', 'SUBSCRIPTION_MOCK'),
    loadMock('04.llm', 'LLM_MOCK'),
  ])
  const plansData = (subscriptionMock ?? []).map(p => ({ ...p, id: Number(p.id) }))

  if (plansData.length === 0) {
    plansData.push(
      {
        id: 1,
        name: 'Базовый',
        maxTrips: 3,
        maxStorageBytes: 1024 * 1024 * 1024, // 1 GB
        monthlyLlmCredits: 50_000,
        isDeveloping: false,
      },
      {
        id: 2,
        name: 'Про',
        maxTrips: 15,
        maxStorageBytes: 25 * 1024 * 1024 * 1024, // 25 GB
        monthlyLlmCredits: 1_000_000,
        isDeveloping: false,
      },
      {
        id: 3,
        name: 'Командный',
        maxTrips: 100,
        maxStorageBytes: 100 * 1024 * 1024 * 1024, // 100 GB
        monthlyLlmCredits: 5_000_000,
        isDeveloping: true,
      },
    )
    console.log('   ⚠️  Моки планов недоступны — вставляем базовые системные планы (id=1, 2, 3)')
  }

  // Страны (требуются для destinationReviews)
  let countriesToInsert: any[] = []
  if (Array.isArray(sourceCountries) && sourceCountries.length > 0) {
    countriesToInsert = sourceCountries
  }
  else {
    const countryMock = await loadMock('07.country', 'MOCK_COUNTRY_DATA')
    countriesToInsert = (countryMock ?? []).map((c: any) => {
      let rusName = ''
      if (typeof c.name?.rus === 'string')
        rusName = c.name.rus
      else if (c.name?.rus?.common)
        rusName = c.name.rus.common
      else if (c.name?.rus?.official)
        rusName = c.name.rus.official

      const fallbackName = c.name?.common || c.name?.official || 'Неизвестная страна'
      const finalName = rusName || fallbackName
      const id = c.cca2 || c.cca3 || uuidv4()

      return { id, name: finalName, flagUrl: c.flag || null }
    }).filter(c => c.name !== 'Неизвестная страна' && c.name !== '')
  }

  await Promise.all([
    plansData.length > 0
      ? db.insert(plans).values(plansData).then(() => console.log(`   ✅ [plans] ${plansData.length} записей`))
      : Promise.resolve(console.log('   ⏭️  [plans] моки недоступны, пропускаем')),
    llmMock && llmMock.length > 0
      ? db.insert(llmModels).values(llmMock).onConflictDoNothing().then(() => console.log(`   ✅ [llmModels] ${llmMock.length} записей`))
      : Promise.resolve(console.log('   ⏭️  [llmModels] моки недоступны, пропускаем')),
    countriesToInsert.length > 0
      ? db.insert(countries).values(countriesToInsert).onConflictDoNothing().then(() => console.log(`   ✅ [countries] ${countriesToInsert.length} записей`))
      : Promise.resolve(),
  ])

  // 4. Метро
  await restoreMetro(Array.isArray(sourceMetro) ? sourceMetro : [])

  // 5. Пользователи
  console.log('\n👤 Восстановление пользователей...')
  if (sourceUsers.length > 0) {
    const usersToInsert = sourceUsers.map((user: any) => ({
      ...user,
      emailVerified: toDate(user.emailVerified),
      llmCreditsPeriodStartDate: toDate(user.llmCreditsPeriodStartDate),
      createdAt: toDate(user.createdAt) ?? new Date(),
      updatedAt: toDate(user.updatedAt) ?? new Date(),
    }))
    await safeInsert('users', users, usersToInsert)
  }

  // 5.1 Highlights (Витрина)
  console.log('\n📸 Восстановление витрины (highlights)...')
  if (Array.isArray(sourceHighlights) && sourceHighlights.length > 0) {
    const highlightsToInsert = sourceHighlights.map((h: any) => {
      const { country, ...rest } = h
      let cId = rest.countryId
      if (!cId && country) {
        const found = countriesToInsert.find(c => c.name === country)
        cId = found?.id
      }
      return {
        ...rest,
        countryId: cId || 'IT',
        takenAt: toDate(h.takenAt),
        createdAt: toDate(h.createdAt) ?? new Date(),
      }
    })
    await safeInsert('highlights', highlights, highlightsToInsert)
  }

  // 5.2 Destination Reviews (Впечатления)
  console.log('\n⭐ Восстановление впечатлений (destinationReviews)...')
  if (Array.isArray(sourceReviews) && sourceReviews.length > 0) {
    const reviewsToInsert = sourceReviews.map((r: any) => ({
      ...r,
      createdAt: toDate(r.createdAt) ?? new Date(),
      updatedAt: toDate(r.updatedAt) ?? new Date(),
    }))
    await safeInsert('destinationReviews', destinationReviews, reviewsToInsert)
  }

  // 6. Метки
  console.log('\n📍 Восстановление меток...')
  if (Array.isArray(sourceMarks) && sourceMarks.length > 0) {
    const marksToInsert = sourceMarks.map((mark: any) => ({
      ...mark,
      startAt: toDate(mark.startAt),
      createdAt: toDate(mark.createdAt) ?? new Date(),
    }))
    await safeInsert('marks', marks, marksToInsert)
  }
  else if (sourceUsers.length > 0) {
    const marksMock = await loadMock('08.marks', 'MOCK_MARKS_DATA')
    if (!marksMock) {
      console.log('   ⏭️  Нет меток в дампе, а моки недоступны — пропускаем')
    }
    else {
      console.log('   ⚠️  Нет меток в дампе. Используем MOCK_MARKS_DATA...')
      const fallbackUserId = sourceUsers[0].id
      const marksToInsert = marksMock.map((mark: any) => ({
        ...mark,
        userId: fallbackUserId,
        startAt: toDate(mark.startAt),
        createdAt: new Date(),
      }))
      await safeInsert('marks', marks, marksToInsert)
    }
  }

  // 7. Путешествия
  if (Array.isArray(sourceTrips) && sourceTrips.length > 0)
    await restoreTrips(sourceTrips)

  // 8. Посты
  if (Array.isArray(sourcePosts) && sourcePosts.length > 0)
    await restorePosts(sourcePosts)

  // 9. Блоги
  if (Array.isArray(sourceBlogs) && sourceBlogs.length > 0)
    await restoreBlogs(sourceBlogs)

  console.log(`\n✅ База данных восстановлена за ${formatDuration(Date.now() - startTime)}!`)
  logStream?.end()
  process.exit(0)
}

seedFromJson().catch((e) => {
  console.error('❌ Критическая ошибка:', e)
  process.exit(1)
})
