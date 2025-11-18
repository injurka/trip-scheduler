/* eslint-disable no-console */
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { db } from './index'

async function createDump() {
  console.log('🎬 Начало создания дампа базы данных...')

  try {
    const allUsers = await db.query.users.findMany()
    const allCommunities = await db.query.communities.findMany()
    const allCommunityMembers = await db.query.communityMembers.findMany()

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

    console.log(`🔍 Найдено ${allUsers.length} пользователей, ${allCommunities.length} сообществ и ${allTrips.length} путешествий для дампа.`)

    const serializableData = {
      users: allUsers,
      communities: allCommunities,
      communityMembers: allCommunityMembers,
      trips: allTrips,
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
