/* eslint-disable no-console */
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import prompts from 'prompts'
import { db } from './index'
import { MOCK_METRO_DATA } from './mock/02.metro'
import { SUBSCRIPTION_MOCK } from './mock/03.subscription'
import { LLM_MOCK } from './mock/04.llm'
import { MOCK_MARKS_DATA } from './mock/08.marks'
import {
  activities,
  blogs,
  comments,
  days,
  emailVerificationTokens,
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
// Утилиты
// ─────────────────────────────────────────────────────────────

const MAX_PG_PARAMS = 65_535

/** Конвертирует любое значение в Date или null */
function toDate(value: string | Date | null | undefined): Date | null {
  if (!value)
    return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Конвертирует любое значение в строку YYYY-MM-DD или null */
function toDateString(value: string | Date | null | undefined): string | null {
  const d = toDate(value)
  return d ? d.toISOString().split('T')[0] : null
}

/** Форматирует миллисекунды в читаемую строку */
function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}мс` : `${(ms / 1000).toFixed(1)}с`
}

/**
 * Вставляет строки чанками с учётом лимита параметров PostgreSQL (65 535).
 * При ошибке чанка автоматически переходит на поштучную вставку.
 */
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
      `   ✅ [${label}] ${rows.length} записей${chunks.length > 1 ? ` (${chunks.length} чанков)` : ''
      } — ${formatDuration(Date.now() - start)}`,
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
        console.error(`   ❌ [${label}] Запись #${i}:`, JSON.stringify(rows[i], null, 2))
        console.error(`      Причина:`, err instanceof Error ? err.message : err)
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

  if (errors.length > 0) {
    console.error(`   ❌ [Trip #${index}] id=${trip.id ?? '?'}: ${errors.join(', ')}`)
  }
}

// ─────────────────────────────────────────────────────────────
// Выбор файла дампа
// ─────────────────────────────────────────────────────────────

async function discoverAndSelectDumpFile(): Promise<string | null> {
  const dumpDir = path.join(__dirname, 'dump')
  try {
    const allFiles = await fs.readdir(dumpDir)
    const jsonFilesWithStats = await Promise.all(
      allFiles
        .filter(file => file.endsWith('.json'))
        .map(async (file) => {
          const filePath = path.join(dumpDir, file)
          const stats = await fs.stat(filePath)
          return { name: file, path: filePath, time: stats.mtime.getTime() }
        }),
    )

    const sortedFiles = jsonFilesWithStats.sort((a, b) => b.time - a.time)
    if (sortedFiles.length === 0)
      return null

    const response = await prompts(
      {
        type: 'select',
        name: 'selectedDump',
        message: 'Выберите файл дампа для восстановления',
        choices: sortedFiles.map(file => ({
          title: file.name,
          description: `(изменён: ${new Date(file.time).toLocaleString()})`,
          value: file.path,
        })),
        hint: '- Стрелки для выбора, Enter для подтверждения',
      },
      {
        onCancel: () => {
          console.log('🚫 Операция отменена.')
          process.exit(0)
        },
      },
    )

    return response.selectedDump ?? null
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
    console.log('   ⚠️  В дампе нет данных метро. Используем MOCK_METRO_DATA...')
    for (const system of MOCK_METRO_DATA) {
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
      user: _user, // исключаем join-поле
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

  // FK-порядок: trips → sections/participants/days → activities/images/memories
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

  // FK-порядок: posts → elements/media/savedPosts (параллельно)
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
  const startTime = Date.now()
  console.log('🌱 Восстановление базы данных из JSON дампа...\n')

  // 1. Выбор файла
  const filePathArg = process.argv[2]
  let dumpFile: string | null

  if (filePathArg) {
    dumpFile = path.resolve(process.cwd(), filePathArg)
    console.log(`🔍 Используется файл: ${path.basename(dumpFile)}`)
  }
  else {
    dumpFile = await discoverAndSelectDumpFile()
    if (!dumpFile) {
      console.error('❌ Файлы дампа не найдены в `db/dump`.')
      console.log('ℹ️  Создайте дамп: `bun run db:dump`')
      process.exit(1)
    }
    console.log(`🔍 Выбран файл: ${path.basename(dumpFile)}`)
  }

  // 2. Чтение и парсинг
  let dumpData: any
  try {
    const fileContent = await fs.readFile(dumpFile, 'utf-8')
    const fileSizeKb = (Buffer.byteLength(fileContent, 'utf-8') / 1024).toFixed(1)
    dumpData = JSON.parse(fileContent)
    console.log(`📁 Размер файла: ${fileSizeKb} KB`)
  }
  catch (error) {
    console.error('❌ Ошибка чтения/парсинга файла дампа:', error)
    process.exit(1)
  }

  const {
    users: sourceUsers,
    trips: sourceTrips,
    posts: sourcePosts,
    blogs: sourceBlogs,
    metro: sourceMetro,
    marks: sourceMarks,
  } = dumpData

  if (!Array.isArray(sourceUsers)) {
    console.error('❌ Неверный формат дампа: отсутствует поле `users`.')
    process.exit(1)
  }

  // 3. Очистка (строго по FK: дочерние → родительские)
  console.log('\n🗑️  Очистка таблиц...')
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

  // 4. Справочники (независимы — параллельно)
  console.log('\n⭐ Восстановление справочников...')
  const plansData = SUBSCRIPTION_MOCK.map(p => ({ ...p, id: Number(p.id) }))
  await Promise.all([
    db.insert(plans).values(plansData).then(() => console.log(`   ✅ [plans] ${plansData.length} записей`)),
    db.insert(llmModels).values(LLM_MOCK).onConflictDoNothing().then(() => console.log(`   ✅ [llmModels] ${LLM_MOCK.length} записей`)),
  ])

  // 5. Метро
  await restoreMetro(Array.isArray(sourceMetro) ? sourceMetro : [])

  // 6. Пользователи (нужны раньше всего остального — FK source)
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

  // 7. Метки
  console.log('\n📍 Восстановление меток...')
  if (Array.isArray(sourceMarks) && sourceMarks.length > 0) {
    const marksToInsert = sourceMarks.map((mark: any) => ({
      ...mark,
      startAt: toDate(mark.startAt),
      createdAt: toDate(mark.createdAt) ?? new Date(),
    }))
    await safeInsert('marks', marks, marksToInsert)
  }
  else if (MOCK_MARKS_DATA && sourceUsers.length > 0) {
    console.log('   ⚠️  Нет меток в дампе. Используем MOCK_MARKS_DATA...')
    const fallbackUserId = sourceUsers[0].id
    const marksToInsert = MOCK_MARKS_DATA.map((mark: any) => ({
      ...mark,
      userId: fallbackUserId,
      startAt: toDate(mark.startAt),
      createdAt: new Date(),
    }))
    await safeInsert('marks', marks, marksToInsert)
  }

  // 8. Путешествия
  if (Array.isArray(sourceTrips) && sourceTrips.length > 0)
    await restoreTrips(sourceTrips)

  // 9. Посты
  if (Array.isArray(sourcePosts) && sourcePosts.length > 0)
    await restorePosts(sourcePosts)

  // 10. Блоги
  if (Array.isArray(sourceBlogs) && sourceBlogs.length > 0)
    await restoreBlogs(sourceBlogs)

  console.log(`\n✅ База данных восстановлена за ${formatDuration(Date.now() - startTime)}!`)
  process.exit(0)
}

seedFromJson().catch((e) => {
  console.error('❌ Критическая ошибка:', e)
  process.exit(1)
})
