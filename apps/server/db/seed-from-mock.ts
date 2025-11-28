/* eslint-disable no-console */
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import url from 'node:url'
import prompts from 'prompts'
import { db } from './index'
import { MOCK_METRO_DATA } from './mock/02.metro'
import { SUBSCRIPTION_MOCK } from './mock/03.subscription'
import { LLM_MOCK } from './mock/04.llm'
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
  metroLines,
  metroLineStations,
  metroStations,
  metroSystems,
  plans,
  refreshTokens,
  tripImages,
  tripParticipants,
  trips,
  tripSections,
  users,
} from './schema'

async function copyStaticFiles() {
  const sourceDir = path.join(__dirname, 'mock/static')
  const destDir = path.join(process.cwd(), 'static')

  try {
    console.log(`🔄 Копирование статических файлов из ${sourceDir} в ${destDir}...`)
    // Проверяем существование исходной папки
    await fs.access(sourceDir)

    // Удаляем старую и копируем новую
    await fs.rm(destDir, { recursive: true, force: true })
    await fs.cp(sourceDir, destDir, { recursive: true })
    console.log('✅ Статические файлы успешно скопированы.')
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      console.warn(`⚠️  Исходная директория ${sourceDir} не найдена. Копирование пропущено.`)
    }
    else {
      console.error('❌ Ошибка при копировании статических файлов:', error)
    }
  }
}

/**
 * 1. Сканирует все mock-файлы (кроме метро и подписок).
 * 2. Загружает из них пользователей и путешествия.
 * 3. Строит интерактивный опрос.
 */
async function discoverAndSelectData() {
  const mockDirs = [path.join(__dirname, 'mock')]
  const discovered = {
    users: new Map<string, any>(),
    trips: new Map<string, any>(),
  }

  console.log('🔍 Поиск и загрузка доступных мок-данных...')

  for (const dir of mockDirs) {
    try {
      // Игнорируем файлы, которые не содержат пользовательских данных
      const files = (await fs.readdir(dir)).filter(f =>
        f.endsWith('.ts')
        && !f.startsWith('02.metro')
        && !f.startsWith('03.subscription'),
      )

      for (const file of files) {
        const filePath = path.join(dir, file)
        const module = await import(url.pathToFileURL(filePath).href)

        // 1. Загрузка Пользователей
        if (Array.isArray(module.MOCK_USER_DATA)) {
          module.MOCK_USER_DATA.forEach((user: any) =>
            discovered.users.set(user.id, user),
          )
        }

        // 2. Загрузка Путешествий
        if (module.MOCK_DATA) {
          const tripsSource = module.MOCK_DATA
          // Поддержка экспорта как массива или как объекта (ключ -> путешествие)
          const tripsData = Array.isArray(tripsSource) ? tripsSource : Object.values(tripsSource)

          for (const trip of tripsData as any[]) {
            if (!trip || !trip.id || !trip.title)
              continue
            discovered.trips.set(trip.id, trip)
          }
        }
      }
    }
    catch (e) {
      console.error(`\n❌ Ошибка при загрузке моков из директории ${dir}:`, e)
    }
  }

  if ([...discovered.users.values(), ...discovered.trips.values()].length === 0) {
    console.warn('⚠️ Моковые данные пользователей или путешествий не найдены.')
    return { selectedUsers: [], selectedTrips: [] }
  }

  const questions: prompts.PromptObject[] = [
    {
      type: discovered.users.size > 0 ? 'multiselect' : null,
      name: 'selectedUsers',
      message: 'Выберите ПОЛЬЗОВАТЕЛЕЙ для добавления',
      choices: [...discovered.users.values()].map(user => ({
        title: `${user.name} (${user.email})`,
        value: user,
        selected: true,
      })),
      hint: '- Пробел для выбора, Enter для подтверждения',
    },
    {
      type: discovered.trips.size > 0 ? 'multiselect' : null,
      name: 'selectedTrips',
      message: 'Выберите ПУТЕШЕСТВИЯ для добавления',
      choices: [...discovered.trips.values()].map(trip => ({
        title: trip.title,
        description: `(${trip.cities?.join(', ') || 'Города не указаны'})`,
        value: trip,
      })),
      hint: '- Пробел для выбора, Enter для подтверждения',
    },
  ]

  const response = await prompts(questions, {
    onCancel: () => {
      console.log('🚫 Операция отменена пользователем.')
      process.exit(0)
    },
  })

  return {
    selectedUsers: response.selectedUsers || [],
    selectedTrips: response.selectedTrips || [],
  }
}

async function seed() {
  await copyStaticFiles()
  console.log('🌱 Начало интерактивного заполнения базы данных...')

  const { selectedUsers, selectedTrips } = await discoverAndSelectData()

  console.log('\n🗑️  Очистка старых данных...')
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

  // Очистка метро
  await db.delete(metroLineStations)
  await db.delete(metroStations)
  await db.delete(metroLines)
  await db.delete(metroSystems)

  console.log('⭐ Создание тарифных планов...')
  const plansData = SUBSCRIPTION_MOCK.map(p => ({
    ...p,
    id: typeof p.id === 'string' ? Number.parseInt(p.id) : p.id, // Защита если ID вдруг строка
  }))

  await db.insert(plans).values(plansData)

  console.log('🤖 Заполнение цен на LLM модели...')
  await db.insert(llmModels).values(LLM_MOCK)

  if (MOCK_METRO_DATA) {
    console.log(`🚇 Вставка данных для ${MOCK_METRO_DATA.length} систем метро...`)
    for (const system of MOCK_METRO_DATA) {
      const [insertedSystem] = await db.insert(metroSystems).values({ id: system.id, city: system.city, country: system.country }).returning()

      for (const line of system.lines) {
        const [insertedLine] = await db.insert(metroLines).values({
          id: line.id,
          systemId: insertedSystem.id,
          name: line.name,
          color: line.color,
          lineNumber: line.lineNumber,
        }).returning()

        const stationsToInsert = line.stations.map((station: any) => ({
          id: station.id,
          systemId: insertedSystem.id,
          name: station.name,
        }))

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

  console.log('✈️  Подготовка данных для вставки...')
  const tripsToInsert: (typeof trips.$inferInsert)[] = []
  const daysToInsert: (typeof days.$inferInsert)[] = []
  const activitiesToInsert: (typeof activities.$inferInsert)[] = []
  const imagesToInsert: (typeof tripImages.$inferInsert)[] = []
  const memoriesToInsert: (typeof memories.$inferInsert)[] = []
  const participantsToInsert: (typeof tripParticipants.$inferInsert)[] = []
  const sectionsToInsert: (typeof tripSections.$inferInsert)[] = []

  for (const tripData of selectedTrips) {
    const {
      days: mockDays,
      images: mockImages,
      memories: mockMemories,
      participantIds,
      sections: mockSections,
      ...tripDetails
    } = tripData

    const formatDate = (d: string | Date) => d instanceof Date ? d.toISOString().split('T')[0] : new Date(d).toISOString().split('T')[0]

    tripsToInsert.push({
      ...tripDetails,
      startDate: formatDate(tripDetails.startDate),
      endDate: formatDate(tripDetails.endDate),
    })

    const allParticipantIds = new Set(participantIds || [])
    if (tripDetails.userId)
      allParticipantIds.add(tripDetails.userId)

    for (const userId of allParticipantIds) {
      participantsToInsert.push({
        tripId: tripDetails.id,
        userId: userId as string,
      })
    }

    if (mockSections) {
      sectionsToInsert.push(...mockSections.map((s: any) => ({
        ...s,
        tripId: tripDetails.id,
      })))
    }

    if (mockDays) {
      for (const mockDay of mockDays) {
        const { activities: mockActivities, ...dayDetails } = mockDay
        daysToInsert.push({
          ...dayDetails,
          date: formatDate(dayDetails.date),
          meta: dayDetails.meta ?? [],
          createdAt: dayDetails.createdAt ? new Date(dayDetails.createdAt) : new Date(),
          updatedAt: dayDetails.updatedAt ? new Date(dayDetails.updatedAt) : new Date(),
        })
        if (mockActivities) {
          activitiesToInsert.push(...mockActivities.map((a: any) => ({
            ...a,
            sections: a.sections || [],
            status: a.status || 'none',
            tag: a.tag || 'transport',
          })))
        }
      }
    }
    if (mockImages) {
      const processedImages = mockImages.map((image: any) => ({
        ...image,
        tripId: tripDetails.id,
        originalName: image.originalName || image.url.split('/').pop(),
      }))
      imagesToInsert.push(...processedImages)
    }
    if (mockMemories) {
      for (const mockMemory of mockMemories) {
        memoriesToInsert.push({
          ...mockMemory,
          tripId: tripDetails.id,
          timestamp: mockMemory.timestamp ? new Date(mockMemory.timestamp) : null,
        })
      }
    }
  }

  console.log(`\n✍️  Запись данных в базу...`)
  console.log(`   - Пользователей: ${selectedUsers.length}`)
  console.log(`   - Путешествий: ${tripsToInsert.length}`)

  if (selectedUsers.length > 0)
    await db.insert(users).values(selectedUsers.map((u: any) => ({ ...u, planId: plansData[0].id })))

  if (tripsToInsert.length > 0)
    await db.insert(trips).values(tripsToInsert)
  if (sectionsToInsert.length > 0)
    await db.insert(tripSections).values(sectionsToInsert)

  if (participantsToInsert.length > 0)
    await db.insert(tripParticipants).values(participantsToInsert).onConflictDoNothing()

  if (daysToInsert.length > 0)
    await db.insert(days).values(daysToInsert)
  if (imagesToInsert.length > 0)
    await db.insert(tripImages).values(imagesToInsert)
  if (activitiesToInsert.length > 0)
    await db.insert(activities).values(activitiesToInsert)
  if (memoriesToInsert.length > 0)
    await db.insert(memories).values(memoriesToInsert)

  console.log('\n🎉 База данных успешно заполнена выбранными данными!')
  process.exit(0)
}

seed().catch((e) => {
  console.error('❌ Ошибка при заполнении базы данных:', e)
  process.exit(1)
})
