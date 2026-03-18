import { db } from 'db'
import { Logger } from '~/lib/logger'
import { s3Service } from './s3.service'

const logger = new Logger()

async function uploadJson(key: string, data: unknown): Promise<void> {
  const buffer = Buffer.from(JSON.stringify(data, null, 2), 'utf-8')
  await s3Service.uploadFile(key, buffer, 'application/json')
}

export const dumpService = {
  async generateAndUploadDump() {
    logger.info('🎬 Начало создания дампа базы данных...')

    try {
      // 1. Загрузка данных
      const [allUsers, allTrips, allPosts, allBlogs, allMetro] = await Promise.all([
        db.query.users.findMany(),
        db.query.trips.findMany({
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
            images: { orderBy: (images, { desc }) => [desc(images.createdAt)] },
            memories: { orderBy: (memories, { asc }) => [asc(memories.timestamp)] },
            participants: true,
            sections: { orderBy: (sections, { asc }) => [asc(sections.order)] },
          },
          orderBy: (trips, { desc }) => [desc(trips.createdAt)],
        }),
        db.query.posts.findMany({
          with: {
            elements: { orderBy: (elements, { asc }) => [asc(elements.order)] },
            media: true,
            savedBy: true,
          },
          orderBy: (posts, { desc }) => [desc(posts.createdAt)],
        }),
        db.query.blogs.findMany(),
        db.query.metroSystems.findMany({
          with: {
            lines: {
              with: {
                lineStations: {
                  orderBy: (lineStations, { asc }) => [asc(lineStations.order)],
                  with: { station: true },
                },
              },
            },
          },
        }),
      ])

      logger.info(`🔍 Найдено для дампа:
      Пользователей: ${allUsers.length}, Путешествий: ${allTrips.length},
      Постов: ${allPosts.length}, Статей: ${allBlogs.length}, Метро систем: ${allMetro.length}`)

      const dateFolder = new Date().toISOString().split('T')[0]
      const basePrefix = `dumps/${dateFolder}`
      let totalFiles = 0

      // 2. users/ — один файл со всеми пользователями
      await uploadJson(`${basePrefix}/users/all.json`, allUsers)
      totalFiles += 1
      logger.info(`   📁 users/all.json (${allUsers.length} пользователей)`)

      // 3. trips/ — по файлу на каждое путешествие
      await Promise.all(
        allTrips.map(trip => uploadJson(`${basePrefix}/trips/${trip.id}.json`, trip)),
      )
      totalFiles += allTrips.length
      logger.info(`   📁 trips/ (${allTrips.length} файлов)`)

      // 4. posts/ — по файлу на каждый пост
      await Promise.all(
        allPosts.map(post => uploadJson(`${basePrefix}/posts/${post.id}.json`, post)),
      )
      totalFiles += allPosts.length
      logger.info(`   📁 posts/ (${allPosts.length} файлов)`)

      // 5. blogs/ — по файлу на каждый блог
      await Promise.all(
        allBlogs.map(blog => uploadJson(`${basePrefix}/blogs/${blog.id}.json`, blog)),
      )
      totalFiles += allBlogs.length
      logger.info(`   📁 blogs/ (${allBlogs.length} файлов)`)

      // 6. metro/ — по файлу на каждый город
      await Promise.all(
        allMetro.map(system => uploadJson(`${basePrefix}/metro/${system.city}.json`, system)),
      )
      totalFiles += allMetro.length
      logger.info(`   📁 metro/ (${allMetro.length} файлов)`)

      logger.success(`✅ Дамп создан: ${totalFiles} файлов → s3://${basePrefix}/`)
      return basePrefix
    }
    catch (error) {
      logger.error('❌ Ошибка при создании дампа:', error)
      throw error
    }
  },
}
