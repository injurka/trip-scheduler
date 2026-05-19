/* eslint-disable no-console */
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import url from 'node:url'
import prompts from 'prompts'
import { v4 as uuidv4 } from 'uuid'
import { db } from './index'
import { MOCK_METRO_DATA } from './mock/02.metro'
import { SUBSCRIPTION_MOCK } from './mock/03.subscription'
import { LLM_MOCK } from './mock/04.llm'
import { MOCK_BLOG_DATA } from './mock/06.blog'
import { MOCK_COUNTRY_DATA } from './mock/07.country'

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

async function copyStaticFiles() {
  const sourceDir = path.join(__dirname, 'mock/static')
  const destDir = path.join(process.cwd(), 'static')

  try {
    console.log(`🔄 Копирование статических файлов из ${sourceDir} в ${destDir}...`)
    await fs.access(sourceDir)
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

async function discoverAndSelectData() {
  const mockDirs = [path.join(__dirname, 'mock')]
  const discovered = {
    users: new Map<string, any>(),
    trips: new Map<string, any>(),
    posts: new Map<string, any>(),
    marks: new Map<string, any>(),
    highlights: new Map<string, any>(),
    destinationReviews: new Map<string, any>(),
  }

  console.log('🔍 Поиск и загрузка доступных мок-данных...')

  for (const dir of mockDirs) {
    try {
      const files = (await fs.readdir(dir)).filter(f =>
        f.endsWith('.ts')
        && !f.startsWith('02.metro')
        && !f.startsWith('03.subscription')
        && !f.startsWith('04.llm')
        && !f.startsWith('07.country'),
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
          const tripsData = Array.isArray(tripsSource) ? tripsSource : Object.values(tripsSource)
          for (const trip of tripsData as any[]) {
            if (!trip || !trip.id || !trip.title)
              continue
            discovered.trips.set(trip.id, trip)
          }
        }

        // 3. Загрузка Постов
        if (module.MOCK_POST_DATA) {
          const postsSource = module.MOCK_POST_DATA
          const postsData = Array.isArray(postsSource) ? postsSource : Object.values(postsSource)
          for (const post of postsData as any[]) {
            if (!post || !post.id || !post.title)
              continue
            discovered.posts.set(post.id, post)
          }
        }

        // 4. Загрузка Меток
        if (module.MOCK_MARKS_DATA) {
          module.MOCK_MARKS_DATA.forEach((mark: any) =>
            discovered.marks.set(mark.id, mark),
          )
        }

        // 5. Загрузка Витрины (Highlights)
        if (module.MOCK_HIGHLIGHTS_DATA) {
          module.MOCK_HIGHLIGHTS_DATA.forEach((highlight: any) =>
            discovered.highlights.set(highlight.id, highlight),
          )
        }

        // 6. Загрузка Впечатлений (Destination Reviews) - ДОБАВЛЕНО
        if (module.MOCK_DESTINATION_REVIEWS_DATA) {
          module.MOCK_DESTINATION_REVIEWS_DATA.forEach((review: any) =>
            discovered.destinationReviews.set(review.id, review),
          )
        }
      }
    }
    catch (e) {
      console.error(`\n❌ Ошибка при загрузке моков из директории ${dir}:`, e)
    }
  }

  if (
    [
      ...discovered.users.values(),
      ...discovered.trips.values(),
      ...discovered.posts.values(),
      ...discovered.marks.values(),
      ...discovered.highlights.values(),
      ...discovered.destinationReviews.values(),
    ].length === 0
  ) {
    console.warn('⚠️ Моковые данные не найдены.')
    return {
      selectedUsers: [],
      selectedTrips: [],
      selectedPosts: [],
      selectedMarks: [],
      selectedHighlights: [],
      selectedDestinationReviews: [],
    }
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
    {
      type: discovered.posts.size > 0 ? 'multiselect' : null,
      name: 'selectedPosts',
      message: 'Выберите ПОСТЫ для добавления',
      choices: [...discovered.posts.values()].map(post => ({
        title: post.title,
        description: `(${post.country || ''})`,
        value: post,
        selected: true,
      })),
      hint: '- Пробел для выбора, Enter для подтверждения',
    },
    {
      type: discovered.marks.size > 0 ? 'multiselect' : null,
      name: 'selectedMarks',
      message: 'Выберите МЕТКИ (Карта Активностей) для добавления',
      choices: [...discovered.marks.values()].map(mark => ({
        title: mark.title,
        description: `(${mark.duration === 0 ? 'Статика/Место' : `Событие: ${mark.duration}ч`})`,
        value: mark,
        selected: true,
      })),
      hint: '- Пробел для выбора, Enter для подтверждения',
    },
    {
      type: discovered.highlights.size > 0 ? 'multiselect' : null,
      name: 'selectedHighlights',
      message: 'Выберите ФОТО ДЛЯ ВИТРИНЫ (Highlights) для добавления',
      choices: [...discovered.highlights.values()].map(h => ({
        title: `${h.city}, ${h.country}`,
        description: h.comment || '',
        value: h,
        selected: true,
      })),
      hint: '- Пробел для выбора, Enter для подтверждения',
    },
    {
      // ДОБАВЛЕНО
      type: discovered.destinationReviews.size > 0 ? 'multiselect' : null,
      name: 'selectedDestinationReviews',
      message: 'Выберите ВПЕЧАТЛЕНИЯ (Рейтинги) для добавления',
      choices: [...discovered.destinationReviews.values()].map(r => ({
        title: r.type === 'city' ? r.city : `Страна (${r.countryId})`,
        description: r.content ? `${r.content.substring(0, 40)}...` : '',
        value: r,
        selected: true,
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
    selectedPosts: response.selectedPosts || [],
    selectedMarks: response.selectedMarks || [],
    selectedHighlights: response.selectedHighlights || [],
    selectedDestinationReviews: response.selectedDestinationReviews || [], // ДОБАВЛЕНО
  }
}

async function seed() {
  await copyStaticFiles()
  console.log('🌱 Начало интерактивного заполнения базы данных...')

  const {
    selectedUsers,
    selectedTrips,
    selectedPosts,
    selectedMarks,
    selectedHighlights,
    selectedDestinationReviews,
  } = await discoverAndSelectData()

  console.log('\n🗑️  Очистка старых данных...')

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
  await db.delete(memories)
  await db.delete(activities)
  await db.delete(days)
  await db.delete(comments)
  await db.delete(tripSections)
  await db.delete(tripImages)
  await db.delete(tripParticipants)
  await db.delete(trips)
  await db.delete(marks)
  await db.delete(refreshTokens)
  await db.delete(emailVerificationTokens)
  await db.delete(users)
  await db.delete(plans)

  await db.delete(metroLineStations)
  await db.delete(metroStations)
  await db.delete(metroLines)
  await db.delete(metroSystems)

  console.log(`🌍 Заполнение справочника стран...`)

  const countriesToInsert = MOCK_COUNTRY_DATA

  if (countriesToInsert.length > 0) {
    await db.insert(countries).values(countriesToInsert).onConflictDoNothing()
    console.log(`   ✅ Добавлено стран: ${countriesToInsert.length}`)
  }

  console.log('⭐ Создание тарифных планов...')
  const plansData = SUBSCRIPTION_MOCK.map(p => ({
    ...p,
    id: typeof p.id === 'string' ? Number.parseInt(p.id) : p.id,
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
  const postsToInsert: (typeof posts.$inferInsert)[] = []
  const elementsToInsert: (typeof postElements.$inferInsert)[] = []
  const postMediaToInsert: (typeof postMedia.$inferInsert)[] = []
  const marksToInsert: (typeof marks.$inferInsert)[] = []
  const highlightsToInsert: (typeof highlights.$inferInsert)[] = []
  const destinationReviewsToInsert: (typeof destinationReviews.$inferInsert)[] = [] // ДОБАВЛЕНО

  // --- TRIPS PROCESSING ---
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

  // --- POSTS PROCESSING ---
  for (const postData of selectedPosts) {
    const { timelineItems, elements, media, ...postDetails } = postData
    const items = elements || timelineItems || []

    postsToInsert.push({
      ...postDetails,
      createdAt: postDetails.createdAt ? new Date(postDetails.createdAt) : new Date(),
      updatedAt: new Date(),
    })

    if (items) {
      for (const item of items) {
        const { media: itemMedia, ...itemDetails } = item
        elementsToInsert.push({
          ...itemDetails,
          postId: postDetails.id,
        })

        if (itemMedia) {
          postMediaToInsert.push(...itemMedia.map((m: any) => ({
            ...m,
            postId: postDetails.id,
            elementId: item.id,
          })))
        }
      }
    }

    if (media) {
      postMediaToInsert.push(...media.map((m: any) => ({
        ...m,
        postId: postDetails.id,
        elementId: null,
      })))
    }
  }

  // --- MARKS PROCESSING ---
  for (const mark of selectedMarks) {
    marksToInsert.push({
      ...mark,
      startAt: mark.startAt ? new Date(mark.startAt) : null,
      createdAt: new Date(),
    })
  }

  // --- HIGHLIGHTS PROCESSING ---
  for (const h of selectedHighlights) {
    highlightsToInsert.push({
      ...h,
      createdAt: h.createdAt ? new Date(h.createdAt) : new Date(),
    })
  }

  // --- DESTINATION REVIEWS PROCESSING ---
  for (const r of selectedDestinationReviews) {
    destinationReviewsToInsert.push({
      ...r,
      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
    })
  }

  console.log(`\n✍️  Запись данных в базу...`)
  console.log(`   - Пользователей: ${selectedUsers.length}`)
  console.log(`   - Путешествий: ${tripsToInsert.length}`)
  console.log(`   - Постов: ${postsToInsert.length}`)
  console.log(`   - Меток на карте: ${marksToInsert.length}`)
  console.log(`   - Фото в витрину: ${highlightsToInsert.length}`)
  console.log(`   - Впечатлений: ${destinationReviewsToInsert.length}`) // ДОБАВЛЕНО

  console.log('📰 Заполнение блога...')
  const blogsToInsert = MOCK_BLOG_DATA.map(blog => ({
    ...blog,
    publishedAt: new Date(blog.publishedAt),
    createdAt: new Date(),
    updatedAt: new Date(),
  }))
  await db.insert(blogs).values(blogsToInsert)

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
  if (postsToInsert.length > 0)
    await db.insert(posts).values(postsToInsert)
  if (elementsToInsert.length > 0)
    await db.insert(postElements).values(elementsToInsert)
  if (postMediaToInsert.length > 0)
    await db.insert(postMedia).values(postMediaToInsert)
  if (marksToInsert.length > 0)
    await db.insert(marks).values(marksToInsert)
  if (highlightsToInsert.length > 0)
    await db.insert(highlights).values(highlightsToInsert)
  if (destinationReviewsToInsert.length > 0)
    await db.insert(destinationReviews).values(destinationReviewsToInsert)

  console.log('\n🎉 База данных успешно заполнена выбранными данными!')
  process.exit(0)
}

seed().catch((e) => {
  console.error('❌ Ошибка при заполнении базы данных:', e)
  process.exit(1)
})
