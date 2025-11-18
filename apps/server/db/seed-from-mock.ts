/* eslint-disable no-console */
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import url from 'node:url'
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
    await fs.rm(destDir, { recursive: true, force: true })
    console.log('🚮 Старая директория static удалена.')
    await fs.cp(sourceDir, destDir, { recursive: true })
    console.log('✅ Статические файлы успешно скопированы.')
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      console.warn(`⚠️  Исходная директория ${sourceDir} не найдена. Копирование пропущено.`)
    else
      console.error('❌ Ошибка при копировании статических файлов:', error)
  }
}

/**
 * 1. Сканирует все mock-файлы.
 * 2. Загружает из них ВСЕ данные.
 * 3. ПРОВЕРЯЕТ, что загруженные данные корректны, и сообщает об ошибках.
 * 4. Строит интерактивный опрос на основе найденных СУЩНОСТЕЙ.
 */
async function discoverAndSelectData() {
  const mockDirs = [path.join(__dirname, 'mock')]
  const discovered = {
    users: new Map<string, any>(),
    trips: new Map<string, any>(),
    communities: new Map<string, any>(),
    members: [] as any[],
  }

  console.log('🔍 Поиск и загрузка доступных мок-данных...')
  for (const dir of mockDirs) {
    try {
      const files = (await fs.readdir(dir)).filter(f => f.endsWith('.ts'))
      for (const file of files) {
        const filePath = path.join(dir, file)
        const module = await import(url.pathToFileURL(filePath).href)

        // 1. Загрузка Пользователей
        if (Array.isArray(module.MOCK_USER_DATA)) {
          module.MOCK_USER_DATA.forEach((user: any) =>
            discovered.users.set(user.id, user),
          )
        }

        // 2. Загрузка Сообществ
        if (Array.isArray(module.MOCK_COMMUNITIES_DATA)) {
          module.MOCK_COMMUNITIES_DATA.forEach((community: any) =>
            discovered.communities.set(community.id, community),
          )
        }
        if (Array.isArray(module.MOCK_COMMUNITY_MEMBERS_DATA)) {
          discovered.members.push(...module.MOCK_COMMUNITY_MEMBERS_DATA)
        }

        // 3. Загрузка Путешествий с улучшенной проверкой
        if (module.MOCK_DATA) {
          const tripsSource = module.MOCK_DATA
          const tripsData = Array.isArray(tripsSource) ? tripsSource : Object.entries(tripsSource)

          for (const item of tripsData) {
            // Определяем ключ (название) и значение (объект путешествия)
            const [key, trip] = Array.isArray(item) ? item : [item.id, item]

            if (!trip || !trip.id || !trip.title) {
              console.warn(`\n⚠️  ПРЕДУПРЕЖДЕНИЕ: В файле "${path.basename(filePath)}" найден некорректный или пустой экспорт путешествия с ключом "${key}". Проверьте импорты и структуру данных в этом файле.`)
              continue
            }

            discovered.trips.set(trip.id, trip)
          }
        }
      }
    }
    catch (e) {
      console.error(`\n❌ Ошибка при загрузке моков из директории ${dir}:`, e)
    }
  }

  if ([...discovered.users.values(), ...discovered.trips.values(), ...discovered.communities.values()].length === 0) {
    console.warn('⚠️ Моковые данные для выбора не найдены.')
    return { selectedUsers: [], selectedTrips: [], selectedCommunities: [], selectedMembers: [] }
  }

  const response = await prompts([
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
    {
      type: discovered.communities.size > 0 ? 'multiselect' : null,
      name: 'selectedCommunities',
      message: 'Выберите СООБЩЕСТВА для добавления',
      choices: [...discovered.communities.values()].map(community => ({
        title: community.name,
        value: community,
      })),
      hint: '- Пробел для выбора, Enter для подтверждения',
    },
  ], {
    onCancel: () => {
      console.log('🚫 Операция отменена пользователем.')
      process.exit(0)
    },
  })

  const selectedCommunityIds = new Set((response.selectedCommunities || []).map((c: any) => c.id))
  const selectedMembers = discovered.members.filter(member => selectedCommunityIds.has(member.communityId))

  return {
    selectedUsers: response.selectedUsers || [],
    selectedTrips: response.selectedTrips || [],
    selectedCommunities: response.selectedCommunities || [],
    selectedMembers,
  }
}

async function seed() {
  await copyStaticFiles()
  console.log('🌱 Начало интерактивного заполнения базы данных...')

  const { selectedUsers, selectedTrips, selectedCommunities, selectedMembers } = await discoverAndSelectData()

  if (selectedUsers.length === 0 && selectedTrips.length === 0 && selectedCommunities.length === 0) {
    console.warn('\n⚠️ Данные не выбраны. Заполнение базы данных пропущено.')
    process.exit(0)
  }

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
  await db.delete(metroLineStations)
  await db.delete(metroStations)
  await db.delete(metroLines)
  await db.delete(metroSystems)

  console.log('⭐ Создание тарифных планов...')
  await db.insert(plans).values([
    { id: FREE_PLAN_ID, name: 'Базовый', maxTrips: 1, maxStorageBytes: ONE_GIGABYTE_IN_BYTES, monthlyLlmCredits: 100000, isDeveloping: false },
    { id: 2, name: 'Про', maxTrips: 10, maxStorageBytes: 20 * ONE_GIGABYTE_IN_BYTES, monthlyLlmCredits: 1000000, isDeveloping: false },
    { id: 3, name: 'Командный', maxTrips: 999, maxStorageBytes: 100 * ONE_GIGABYTE_IN_BYTES, monthlyLlmCredits: 5000000, isDeveloping: true },
  ])

  console.log('🤖 Заполнение цен на LLM модели...')
  await db.insert(llmModels).values([
    { id: 'gemini-2.5-pro', costPerMillionInputTokens: 1.25, costPerMillionOutputTokens: 10.0 },
    { id: 'claude-sonnet-4-5', costPerMillionInputTokens: 3.3, costPerMillionOutputTokens: 16.5 },
    { id: 'gpt-5-codex', costPerMillionInputTokens: 1.25, costPerMillionOutputTokens: 10.0 },
    { id: 'o3', costPerMillionInputTokens: 2.0, costPerMillionOutputTokens: 8.0 },
    { id: 'o4-mini', costPerMillionInputTokens: 1.1, costPerMillionOutputTokens: 4.4 },
    { id: 'gpt-4.1', costPerMillionInputTokens: 2.0, costPerMillionOutputTokens: 8.0 },
    { id: 'gemini-flash-latest', costPerMillionInputTokens: 0.5, costPerMillionOutputTokens: 1.5 },
  ])

  const metroData = (await import(url.pathToFileURL(path.join(__dirname, 'mock/metro.data.ts')).href)).MOCK_METRO_DATA

  if (metroData) {
    console.log(`🚇 Вставка данных для ${metroData.length} систем метро...`)
    for (const system of metroData) {
      const [insertedSystem] = await db.insert(metroSystems).values({ id: system.id, city: system.city, country: system.country }).returning()
      for (const line of system.lines) {
        const [insertedLine] = await db.insert(metroLines).values({ id: line.id, systemId: insertedSystem.id, name: line.name, color: line.color, lineNumber: line.lineNumber }).returning()
        const stationsToInsert = line.stations.map((station: any) => ({ id: station.id, systemId: insertedSystem.id, name: station.name }))
        if (stationsToInsert.length > 0) {
          // Вставка станций с обработкой конфликтов (если станция уже существует)
          await db.insert(metroStations).values(stationsToInsert).onConflictDoNothing()
        }

        const lineStationsToInsert = line.stations.map((station: any, index: number) => ({
          lineId: insertedLine.id,
          stationId: station.id,
          order: index,
        }))

        if (lineStationsToInsert.length > 0) {
          await db.insert(metroLineStations).values(lineStationsToInsert)
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

    tripsToInsert.push({
      ...tripDetails,
      startDate: new Date(tripDetails.startDate).toISOString().split('T')[0],
      endDate: new Date(tripDetails.endDate).toISOString().split('T')[0],
    })

    const allParticipantIds = new Set(participantIds || [])
    allParticipantIds.add(tripDetails.userId)

    for (const userId of allParticipantIds) {
      participantsToInsert.push({
        tripId: tripDetails.id,
        userId: userId as string,
      })
    }

    if (mockSections)
      sectionsToInsert.push(...mockSections)

    if (mockDays) {
      for (const mockDay of mockDays) {
        const { activities: mockActivities, ...dayDetails } = mockDay
        daysToInsert.push({
          ...dayDetails,
          date: new Date(dayDetails.date).toISOString().split('T')[0],
          meta: dayDetails.meta ?? [],
          createdAt: dayDetails.createdAt ? new Date(dayDetails.createdAt) : new Date(),
          updatedAt: dayDetails.updatedAt ? new Date(dayDetails.updatedAt) : new Date(),
        })
        if (mockActivities) {
          activitiesToInsert.push(...mockActivities)
        }
      }
    }
    if (mockImages) {
      const processedImages = mockImages.map((image: any) => ({
        ...image,
        originalName: image.originalName || image.url.split('/').pop(),
      }))
      imagesToInsert.push(...processedImages)
    }
    if (mockMemories) {
      for (const mockMemory of mockMemories) {
        memoriesToInsert.push({
          ...mockMemory,
          timestamp: mockMemory.timestamp ? new Date(mockMemory.timestamp) : null,
        })
      }
    }
  }

  console.log(`\n✅ Подготовлено к вставке: ${selectedUsers.length} пользователей, ${selectedTrips.length} путешествий, ${selectedCommunities.length} сообществ.`)
  console.log('✍️  Запись данных в базу...')

  if (selectedUsers.length > 0)
    await db.insert(users).values(selectedUsers.map((u: any) => ({ ...u, planId: 3 })))

  if (selectedCommunities.length > 0) {
    await db.insert(communities).values(selectedCommunities)
    if (selectedMembers.length > 0)
      await db.insert(communityMembers).values(selectedMembers)
  }

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

  console.log('\n🎉 База данных успешно заполнена выбранными данными!')
  process.exit(0)
}

seed().catch((e) => {
  console.error('❌ Ошибка при заполнении базы данных:', e)
  process.exit(1)
})
