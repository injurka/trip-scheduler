// File: seed-from-json.ts
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

/**
 * Сканирует директорию 'dump', находит все JSON-дампы и предлагает пользователю
 * выбрать один для восстановления.
 */
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
          return {
            name: file,
            path: filePath,
            time: stats.mtime.getTime(),
          }
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
          description: `(создан: ${new Date(file.time).toLocaleString()})`,
          value: file.path,
        })),
        hint: '- Используйте стрелки для выбора, Enter для подтверждения',
      },
      {
        onCancel: () => {
          console.log('🚫 Операция отменена пользователем.')
          process.exit(0)
        },
      },
    )

    return response.selectedDump
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return null
    throw error
  }
}

async function seedFromJson() {
  console.log('🌱 Начало заполнения базы данных из JSON дампа...')

  const filePathArg = process.argv[2]
  let dumpFile: string | null

  if (filePathArg) {
    dumpFile = path.resolve(process.cwd(), filePathArg)
    console.log(`🔍 Используется указанный файл дампа: ${path.basename(dumpFile)}`)
  }
  else {
    dumpFile = await discoverAndSelectDumpFile()
    if (!dumpFile) {
      console.error('❌ Не найдены файлы дампа в директории `db/dump`.')
      console.log('ℹ️  Сначала создайте дамп с помощью команды `bun run db:dump`.')
      process.exit(1)
    }
    console.log(`🔍 Выбран файл дампа: ${path.basename(dumpFile)}`)
  }

  let dumpData
  try {
    const fileContent = await fs.readFile(dumpFile, 'utf-8')
    dumpData = JSON.parse(fileContent)
  }
  catch (error) {
    console.error(`❌ Ошибка при чтении или парсинге файла дампа ${dumpFile}:`, error)
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
    console.warn('⚠️ Файл дампа имеет неверный формат (отсутствуют users). Заполнение базы данных пропущено.')
    process.exit(0)
  }

  console.log('🗑️  Очистка всех данных...')
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

  console.log('⭐ Восстановление тарифных планов (Plans)...')
  const plansData = SUBSCRIPTION_MOCK.map(p => ({ ...p, id: Number(p.id) }))
  await db.insert(plans).values(plansData)

  console.log('🤖 Восстановление LLM моделей...')
  await db.insert(llmModels).values(LLM_MOCK).onConflictDoNothing()

  console.log('🚇 Восстановление данных Метро...')
  if (sourceMetro && Array.isArray(sourceMetro) && sourceMetro.length > 0) {
    console.log(`   📂 Найдено систем метро в дампе: ${sourceMetro.length}. Восстанавливаем...`)

    for (const system of sourceMetro) {
      await db.insert(metroSystems)
        .values({ id: system.id, city: system.city, country: system.country })
        .onConflictDoNothing()

      if (system.lines && Array.isArray(system.lines)) {
        for (const line of system.lines) {
          await db.insert(metroLines)
            .values({
              id: line.id,
              systemId: system.id,
              name: line.name,
              color: line.color,
              lineNumber: line.lineNumber,
            })
            .onConflictDoNothing()

          if (line.lineStations && Array.isArray(line.lineStations)) {
            for (const ls of line.lineStations) {
              if (ls.station) {
                await db.insert(metroStations)
                  .values({
                    id: ls.station.id,
                    systemId: system.id,
                    name: ls.station.name,
                  })
                  .onConflictDoNothing()

                await db.insert(metroLineStations)
                  .values({
                    lineId: line.id,
                    stationId: ls.station.id,
                    order: ls.order,
                  })
                  .onConflictDoNothing()
              }
            }
          }
        }
      }
    }
  }
  else if (MOCK_METRO_DATA) {
    console.log('   ⚠️ В дампе нет данных метро. Используем встроенный MOCK_METRO_DATA.')
    for (const system of MOCK_METRO_DATA) {
      const [insertedSystem] = await db.insert(metroSystems).values({ id: system.id, city: system.city, country: system.country }).returning()
      for (const line of system.lines) {
        const [insertedLine] = await db.insert(metroLines).values({ id: line.id, systemId: insertedSystem.id, name: line.name, color: line.color, lineNumber: line.lineNumber }).returning()

        const stationsToInsert = line.stations.map((station: any) => ({ id: station.id, systemId: insertedSystem.id, name: station.name }))
        if (stationsToInsert.length > 0) {
          await db.insert(metroStations).values(stationsToInsert).onConflictDoNothing()
        }

        const lineStationsToInsert = line.stations.map((station: any, index: number) => ({
          lineId: insertedLine.id,
          stationId: station.id,
          order: index,
        }))
        if (lineStationsToInsert.length > 0) {
          await db.insert(metroLineStations).values(lineStationsToInsert).onConflictDoNothing()
        }
      }
    }
  }

  console.log('✈️  Восстановление пользовательских данных...')
  if (sourceUsers.length > 0) {
    console.log(`👤 Вставка ${sourceUsers.length} пользователей...`)
    const usersToInsert = sourceUsers.map((user: any) => ({
      ...user,
      emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
      llmCreditsPeriodStartDate: user.llmCreditsPeriodStartDate ? new Date(user.llmCreditsPeriodStartDate) : null,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
    }))
    await db.insert(users).values(usersToInsert)
  }

  console.log('📍 Восстановление меток (Marks)...')
  if (sourceMarks && Array.isArray(sourceMarks) && sourceMarks.length > 0) {
    console.log(`   📂 Найдено меток в дампе: ${sourceMarks.length}. Восстанавливаем...`)
    const marksToInsert = sourceMarks.map((mark: any) => ({
      ...mark,
      startAt: mark.startAt ? new Date(mark.startAt) : null,
      createdAt: mark.createdAt ? new Date(mark.createdAt) : new Date(),
    }))
    await db.insert(marks).values(marksToInsert)
  }
  else if (MOCK_MARKS_DATA && sourceUsers.length > 0) {
    console.log('   ⚠️ В дампе нет меток. Используем встроенный MOCK_MARKS_DATA.')
    // Берем ID первого попавшегося юзера из дампа, чтобы не было ошибки внешнего ключа
    const fallbackUserId = sourceUsers[0].id
    const marksToInsert = MOCK_MARKS_DATA.map((mark: any) => ({
      ...mark,
      userId: fallbackUserId,
      startAt: mark.startAt ? new Date(mark.startAt) : null,
      createdAt: new Date(),
    }))
    await db.insert(marks).values(marksToInsert)
  }

  // --- TRIPS ---
  if (sourceTrips && Array.isArray(sourceTrips)) {
    const tripsToInsert: (typeof trips.$inferInsert)[] = []
    const daysToInsert: (typeof days.$inferInsert)[] = []
    const activitiesToInsert: (typeof activities.$inferInsert)[] = []
    const imagesToInsert: (typeof tripImages.$inferInsert)[] = []
    const memoriesToInsert: (typeof memories.$inferInsert)[] = []
    const sectionsToInsert: (typeof tripSections.$inferInsert)[] = []
    const participantsToInsert: (typeof tripParticipants.$inferInsert)[] = []

    const toDateString = (d: string | Date) => new Date(d).toISOString().split('T')[0]

    for (const tripData of sourceTrips) {
      const { days: tripDays, images: tripImagesData, memories: tripMemories, sections, participants, user, ...tripDetails } = tripData

      tripsToInsert.push({
        ...tripDetails,
        startDate: toDateString(tripDetails.startDate),
        endDate: toDateString(tripDetails.endDate),
        createdAt: new Date(tripDetails.createdAt),
        updatedAt: new Date(tripDetails.updatedAt),
      })

      if (sections) {
        sectionsToInsert.push(...sections.map((section: any) => ({
          ...section,
          createdAt: new Date(section.createdAt),
          updatedAt: new Date(section.updatedAt),
        })))
      }

      if (participants)
        participantsToInsert.push(...participants)

      if (tripDays) {
        for (const day of tripDays) {
          const { activities: dayActivities, ...dayDetails } = day
          daysToInsert.push({
            ...dayDetails,
            date: toDateString(day.date),
            createdAt: new Date(dayDetails.createdAt),
            updatedAt: new Date(dayDetails.updatedAt),
          })
          if (dayActivities) {
            activitiesToInsert.push(...dayActivities.map((activity: any) => ({
              ...activity,
              createdAt: activity.createdAt ? new Date(activity.createdAt) : new Date(),
              updatedAt: activity.updatedAt ? new Date(activity.updatedAt) : new Date(),
            })))
          }
        }
      }

      if (tripImagesData) {
        imagesToInsert.push(...tripImagesData.map((image: any) => ({
          ...image,
          createdAt: image.createdAt ? new Date(image.createdAt) : new Date(),
          takenAt: image.takenAt ? new Date(image.takenAt) : null,
        })))
      }

      if (tripMemories) {
        memoriesToInsert.push(...tripMemories.map((memory: any) => ({
          ...memory,
          timestamp: memory.timestamp ? new Date(memory.timestamp) : null,
          createdAt: memory.createdAt ? new Date(memory.createdAt) : new Date(),
          updatedAt: memory.updatedAt ? new Date(memory.updatedAt) : new Date(),
        })))
      }
    }

    console.log(`✈️  Вставка ${tripsToInsert.length} путешествий и связанных данных...`)
    if (tripsToInsert.length > 0)
      await db.insert(trips).values(tripsToInsert)
    if (sectionsToInsert.length > 0)
      await db.insert(tripSections).values(sectionsToInsert)
    if (participantsToInsert.length > 0)
      await db.insert(tripParticipants).values(participantsToInsert)
    if (daysToInsert.length > 0)
      await db.insert(days).values(daysToInsert)
    if (imagesToInsert.length > 0)
      await db.insert(tripImages).values(imagesToInsert)
    if (activitiesToInsert.length > 0)
      await db.insert(activities).values(activitiesToInsert)
    if (memoriesToInsert.length > 0)
      await db.insert(memories).values(memoriesToInsert)
  }

  // --- POSTS ---
  if (sourcePosts && Array.isArray(sourcePosts)) {
    const postsToInsert: (typeof posts.$inferInsert)[] = []
    const elementsToInsert: (typeof postElements.$inferInsert)[] = []
    const mediaToInsert: (typeof postMedia.$inferInsert)[] = []
    const savedPostsToInsert: (typeof savedPosts.$inferInsert)[] = []

    for (const postData of sourcePosts) {
      const { elements, media, savedBy, ...postDetails } = postData

      postsToInsert.push({
        ...postDetails,
        createdAt: new Date(postDetails.createdAt),
        updatedAt: new Date(postDetails.updatedAt),
      })

      if (elements) {
        elementsToInsert.push(...elements.map((el: any) => ({
          ...el,
          createdAt: new Date(el.createdAt),
          updatedAt: new Date(el.updatedAt),
        })))
      }

      if (media) {
        mediaToInsert.push(...media.map((m: any) => ({
          ...m,
          createdAt: new Date(m.createdAt),
          takenAt: m.takenAt ? new Date(m.takenAt) : null,
        })))
      }

      if (savedBy) {
        savedPostsToInsert.push(...savedBy.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
        })))
      }
    }

    console.log(`📝 Вставка ${postsToInsert.length} постов и связанных данных...`)
    if (postsToInsert.length > 0)
      await db.insert(posts).values(postsToInsert)
    if (elementsToInsert.length > 0)
      await db.insert(postElements).values(elementsToInsert)
    if (mediaToInsert.length > 0)
      await db.insert(postMedia).values(mediaToInsert)
    if (savedPostsToInsert.length > 0)
      await db.insert(savedPosts).values(savedPostsToInsert)
  }

  if (sourceBlogs && Array.isArray(sourceBlogs)) {
    const blogsToInsert = sourceBlogs.map((blog: any) => ({
      ...blog,
      publishedAt: blog.publishedAt ? new Date(blog.publishedAt) : null,
      createdAt: new Date(blog.createdAt),
      updatedAt: new Date(blog.updatedAt),
    }))

    console.log(`📰 Вставка ${blogsToInsert.length} статей блога...`)
    if (blogsToInsert.length > 0) {
      await db.insert(blogs).values(blogsToInsert)
    }
  }

  console.log('✅ База данных успешно восстановлена из JSON дампа!')
  process.exit(0)
}

seedFromJson().catch((e) => {
  console.error('❌ Ошибка при заполнении базы данных из JSON:', e)
  process.exit(1)
})
