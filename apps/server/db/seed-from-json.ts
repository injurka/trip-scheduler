/* eslint-disable no-console */
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import prompts from 'prompts'
import { FREE_PLAN_ID, ONE_GIGABYTE_IN_BYTES } from '~/lib/constants'
import { db } from './index'
import {
  activities,
  comments,
  communities,
  communityMembers,
  days,
  emailVerificationTokens,
  llmModels,
  llmTokenUsage,
  memories,
  plans,
  refreshTokens,
  tripImages,
  tripParticipants,
  trips,
  tripSections,
  users,
} from './schema'

/**
 * Сканирует директорию 'dump', находит все JSON-дампы и предлагает пользователю
 * выбрать один для восстановления.
 * @returns Полный путь к выбранному файлу или null, если файлы не найдены.
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
            time: stats.mtime.getTime(), // Используем время модификации
          }
        }),
    )

    // Сортируем файлы по времени, самые новые вверху
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
    // Если директория 'dump' не существует, вернем null
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

  const { users: sourceUsers, communities: sourceCommunities, communityMembers: sourceMembers, trips: sourceTrips } = dumpData

  if (!Array.isArray(sourceTrips) || !Array.isArray(sourceUsers)) {
    console.warn('⚠️ Файл дампа имеет неверный формат. Заполнение базы данных пропущено.')
    process.exit(0)
  }

  console.log('🗑️  Очистка старых данных...')
  await db.delete(llmTokenUsage)
  await db.delete(llmModels)
  await db.delete(memories)
  await db.delete(activities)
  await db.delete(days)
  await db.delete(comments)
  await db.delete(tripSections)
  await db.delete(tripImages)
  await db.delete(tripParticipants)
  await db.delete(trips)
  await db.delete(communityMembers)
  await db.delete(communities)
  await db.delete(refreshTokens)
  await db.delete(emailVerificationTokens)
  await db.delete(users)
  await db.delete(plans)

  console.log('⭐ Создание тарифных планов...')
  await db.insert(plans).values([
    { id: FREE_PLAN_ID, name: 'Базовый', maxTrips: 1, maxStorageBytes: ONE_GIGABYTE_IN_BYTES, monthlyLlmCredits: 100000, isDeveloping: false },
    { id: 2, name: 'Про', maxTrips: 10, maxStorageBytes: 20 * ONE_GIGABYTE_IN_BYTES, monthlyLlmCredits: 1000000, isDeveloping: false },
    { id: 3, name: 'Командный', maxTrips: 999, maxStorageBytes: 100 * ONE_GIGABYTE_IN_BYTES, monthlyLlmCredits: 5000000, isDeveloping: true },
  ])

  console.log('🤖 Заполнение цен на LLM модели...')
  await db.insert(llmModels).values([
    { id: 'gemini-2.5-pro', costPerMillionInputTokens: 1.25, costPerMillionOutputTokens: 10.0 },
    { id: 'gemini-flash-latest', costPerMillionInputTokens: 0.5, costPerMillionOutputTokens: 1.5 },
    { id: 'claude-sonnet-4-5', costPerMillionInputTokens: 3.3, costPerMillionOutputTokens: 16.5 },
    { id: 'gpt-5-codex', costPerMillionInputTokens: 1.25, costPerMillionOutputTokens: 10.0 },
    { id: 'o3', costPerMillionInputTokens: 2.0, costPerMillionOutputTokens: 8.0 },
    { id: 'o4-mini', costPerMillionInputTokens: 1.1, costPerMillionOutputTokens: 4.4 },
    { id: 'gpt-4.1', costPerMillionInputTokens: 2.0, costPerMillionOutputTokens: 8.0 },
  ])

  console.log('✈️  Подготовка данных для вставки...')

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

  if (sourceCommunities.length > 0) {
    console.log(`🏘️  Вставка ${sourceCommunities.length} сообществ...`)
    const communitiesToInsert = sourceCommunities.map((community: any) => ({
      ...community,
      createdAt: new Date(community.createdAt),
      updatedAt: new Date(community.updatedAt),
    }))
    await db.insert(communities).values(communitiesToInsert)
  }

  if (sourceMembers.length > 0) {
    console.log(`👥 Вставка ${sourceMembers.length} участников сообществ...`)
    const membersToInsert = sourceMembers.map((member: any) => ({
      ...member,
      joinedAt: new Date(member.joinedAt),
    }))
    await db.insert(communityMembers).values(membersToInsert)
  }

  const tripsToInsert: (typeof trips.$inferInsert)[] = []
  const daysToInsert: (typeof days.$inferInsert)[] = []
  const activitiesToInsert: (typeof activities.$inferInsert)[] = []
  const imagesToInsert: (typeof tripImages.$inferInsert)[] = []
  const memoriesToInsert: (typeof memories.$inferInsert)[] = []
  const sectionsToInsert: (typeof tripSections.$inferInsert)[] = []
  const participantsToInsert: (typeof tripParticipants.$inferInsert)[] = []

  for (const tripData of sourceTrips) {
    const { days: tripDays, images: tripImagesData, memories: tripMemories, sections, participants, user, ...tripDetails } = tripData

    tripsToInsert.push({
      ...tripDetails,
      startDate: new Date(tripDetails.startDate),
      endDate: new Date(tripDetails.endDate),
      createdAt: new Date(tripDetails.createdAt),
      updatedAt: new Date(tripDetails.updatedAt),
    })

    if (sections) {
      const processedSections = sections.map((section: any) => ({
        ...section,
        createdAt: new Date(section.createdAt),
        updatedAt: new Date(section.updatedAt),
      }))
      sectionsToInsert.push(...processedSections)
    }

    if (participants)
      participantsToInsert.push(...participants)

    if (tripDays) {
      for (const day of tripDays) {
        const { activities: dayActivities, ...dayDetails } = day
        daysToInsert.push({
          ...dayDetails,
          date: new Date(day.date),
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

  console.log(`✈️  Вставка ${tripsToInsert.length} путешествий и всех связанных данных...`)

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

  console.log('✅ База данных успешно заполнена из JSON дампа!')
  process.exit(0)
}

seedFromJson().catch((e) => {
  console.error('❌ Ошибка при заполнении базы данных из JSON:', e)
  process.exit(1)
})
