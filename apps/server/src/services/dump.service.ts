import fs from 'node:fs/promises'
import path from 'node:path'
import { db } from 'db'
import { Logger } from '~/lib/logger'
import { s3Service } from './s3.service'

const logger = new Logger()

export type DumpTarget = 'local' | 's3' | 'both'

async function writeJson(target: DumpTarget, localPath: string, s3Key: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2)
  const tasks: Promise<any>[] = []

  if (target === 'local' || target === 'both') {
    tasks.push(
      fs.mkdir(path.dirname(localPath), { recursive: true })
        .then(() => fs.writeFile(localPath, json, 'utf-8')),
    )
  }

  if (target === 's3' || target === 'both') {
    tasks.push(s3Service.uploadFile(s3Key, Buffer.from(json, 'utf-8'), 'application/json'))
  }

  await Promise.all(tasks)
}

export const dumpService = {
  async generateAndUploadDump(target: DumpTarget = 'both') {
    logger.info(`🎬 Начало создания дампа базы данных (Target: ${target})...`)

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
      const baseDir = path.resolve(__dirname, '../../db/dump', dateFolder)
      const s3Prefix = `dumps/${dateFolder}`
      let totalFiles = 0

      // 2. users/ — один файл со всеми пользователями
      await writeJson(
        target,
        path.join(baseDir, 'users', 'all.json'),
        `${s3Prefix}/users/all.json`,
        allUsers,
      )
      totalFiles += 1
      logger.info(`   📁 users/all.json (${allUsers.length} пользователей)`)

      // 3. trips/ — по файлу на каждое путешествие
      await Promise.all(
        allTrips.map(trip =>
          writeJson(
            target,
            path.join(baseDir, 'trips', `${trip.id}.json`),
            `${s3Prefix}/trips/${trip.id}.json`,
            trip,
          ),
        ),
      )
      totalFiles += allTrips.length
      logger.info(`   📁 trips/ (${allTrips.length} файлов)`)

      // 4. posts/ — по файлу на каждый пост
      await Promise.all(
        allPosts.map(post =>
          writeJson(
            target,
            path.join(baseDir, 'posts', `${post.id}.json`),
            `${s3Prefix}/posts/${post.id}.json`,
            post,
          ),
        ),
      )
      totalFiles += allPosts.length
      logger.info(`   📁 posts/ (${allPosts.length} файлов)`)

      // 5. blogs/ — по файлу на каждый блог
      await Promise.all(
        allBlogs.map(blog =>
          writeJson(
            target,
            path.join(baseDir, 'blogs', `${blog.id}.json`),
            `${s3Prefix}/blogs/${blog.id}.json`,
            blog,
          ),
        ),
      )
      totalFiles += allBlogs.length
      logger.info(`   📁 blogs/ (${allBlogs.length} файлов)`)

      // 6. metro/ — по файлу на каждый город
      await Promise.all(
        allMetro.map(system =>
          writeJson(
            target,
            path.join(baseDir, 'metro', `${system.city}.json`),
            `${s3Prefix}/metro/${system.city}.json`,
            system,
          ),
        ),
      )
      totalFiles += allMetro.length
      logger.info(`   📁 metro/ (${allMetro.length} файлов)`)

      logger.success(`✅ Дамп создан: ${totalFiles} файлов`)
      if (target === 'local' || target === 'both')
        logger.success(`   💾 Локально: ${baseDir}`)
      if (target === 's3' || target === 'both')
        logger.success(`   ☁️  S3: ${s3Prefix}/`)

      return {
        baseDir: target !== 's3' ? baseDir : undefined,
        s3Prefix: target !== 'local' ? s3Prefix : undefined,
      }
    }
    catch (error) {
      logger.error('❌ Ошибка при создании дампа:', error)
      throw error
    }
  },
}
