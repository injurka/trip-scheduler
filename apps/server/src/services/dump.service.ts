import { db } from 'db'
import { Logger } from '~/lib/logger'
import { s3Service } from './s3.service'

const logger = new Logger()

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
      Постов: ${allPosts.length}, Статей: ${allBlogs.length}, Метро: ${allMetro.length}`)

      const serializableData = {
        users: allUsers,
        trips: allTrips,
        posts: allPosts,
        blogs: allBlogs,
        metro: allMetro,
      }

      // 2. Сериализация в JSON и создание Buffer
      const jsonString = JSON.stringify(serializableData, null, 2)
      const buffer = Buffer.from(jsonString, 'utf-8')

      // 3. Формирование имени файла и загрузка в S3
      // Сохраняем в папку dumps в S3 с текущей датой
      const fileName = `dumps/db-dump-${new Date().toISOString().split('T')[0]}.json`

      await s3Service.uploadFile(fileName, buffer, 'application/json')

      logger.success(`✅ Дамп успешно создан и загружен в S3: ${fileName}`)
      return fileName
    }
    catch (error) {
      logger.error('❌ Ошибка при создании дампа:', error)
      throw error
    }
  },
}
