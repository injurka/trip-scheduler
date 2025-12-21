/* eslint-disable no-console */
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { db } from './index'

async function createDump() {
  console.log('🎬 Начало создания дампа базы данных...')

  try {
    // 1. Загрузка пользователей
    const allUsers = await db.query.users.findMany()

    // 2. Загрузка путешествий
    const allTrips = await db.query.trips.findMany({
      with: {
        user: true,
        days: {
          orderBy: (days, { asc }) => [asc(days.date)],
          with: {
            activities: {
              orderBy: (activities, { asc }) => [asc(activities.startTime)],
            },
          },
        },
        images: {
          orderBy: (images, { desc }) => [desc(images.createdAt)],
        },
        memories: {
          orderBy: (memories, { asc }) => [asc(memories.timestamp)],
        },
        participants: true,
        sections: {
          orderBy: (sections, { asc }) => [asc(sections.order)],
        },
      },
      orderBy: (trips, { desc }) => [desc(trips.createdAt)],
    })

    // 3. Загрузка постов
    const allPosts = await db.query.posts.findMany({
      with: {
        elements: {
          orderBy: (elements, { asc }) => [asc(elements.order)],
        },
        media: true,
        savedBy: true,
      },
      orderBy: (posts, { desc }) => [desc(posts.createdAt)],
    })

    // 4. Загрузка блога
    const allBlogs = await db.query.blogs.findMany()

    // 5. Загрузка метро (системы -> линии -> станции)
    const allMetro = await db.query.metroSystems.findMany({
      with: {
        lines: {
          with: {
            lineStations: {
              orderBy: (lineStations, { asc }) => [asc(lineStations.order)],
              with: {
                station: true,
              },
            },
          },
        },
      },
    })

    console.log(`🔍 Найдено:`)
    console.log(`   - Пользователей: ${allUsers.length}`)
    console.log(`   - Путешествий: ${allTrips.length}`)
    console.log(`   - Постов: ${allPosts.length}`)
    console.log(`   - Статей блога: ${allBlogs.length}`)
    console.log(`   - Систем метро: ${allMetro.length}`)

    const serializableData = {
      users: allUsers,
      trips: allTrips,
      posts: allPosts,
      blogs: allBlogs,
      metro: allMetro,
    }

    const dumpDir = path.join(__dirname, 'dump')
    await fs.mkdir(dumpDir, { recursive: true })
    const dumpFile = path.join(dumpDir, `${new Date().toISOString()}.json`)

    await fs.writeFile(dumpFile, JSON.stringify(serializableData, null, 2))

    console.log(`✅ Дамп успешно создан и сохранен в: ${dumpFile}`)
  }
  catch (error) {
    console.error('❌ Ошибка при создании дампа:', error)
    process.exit(1)
  }
  finally {
    console.log('👋 Завершение работы.')
    process.exit(0)
  }
}

createDump()
