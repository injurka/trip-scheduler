/* eslint-disable no-console */
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { connectDB, db } from '../src/db'

async function createDump() {
  console.log('🎬 Начало создания дампа базы данных...')

  try {
    await connectDB()

    // 1. Загрузка пользователей
    const [allUsers] = await db.query('SELECT * FROM user')

    // 2. Загрузка путешествий (со всем вложенным)
    // Мы денормализуем структуру для дампа, чтобы seed скрипт мог легко восстановить
    // Участников получаем отдельно, чтобы восстановить ребра
    const [allTrips] = await db.query(`
      SELECT *,
      (SELECT * FROM day WHERE tripId = $parent.id) as days,
      (SELECT * FROM trip_section WHERE tripId = $parent.id) as sections,
      (SELECT * FROM trip_image WHERE tripId = $parent.id) as images,
      (SELECT * FROM memory WHERE tripId = $parent.id) as memories,
      (SELECT in as userId FROM <-participates_in) as participants
      FROM trip
    `)

    // Для вложенности active в days, нужно пройтись циклом или сделать сложный запрос.
    // Сделаем доп. запрос для activities и вмержим их в JS
    const [allActivities] = await db.query('SELECT * FROM activity')

    // Мэппинг активностей к дням
    const tripsWithData = (allTrips as any[]).map((trip: any) => {
      trip.days = trip.days.map((day: any) => ({
        ...day,
        activities: (allActivities as any[]).filter(a => a.dayId === day.id),
      }))
      return trip
    })

    // 3. Загрузка постов
    const [allPosts] = await db.query(`
        SELECT *,
        (SELECT in as userId FROM <-saved) as savedBy
        FROM post
    `)

    console.log(`🔍 Найдено:`)
    console.log(`   - Пользователей: ${allUsers.length}`)
    console.log(`   - Путешествий: ${tripsWithData.length}`)
    console.log(`   - Постов: ${allPosts.length}`)

    const serializableData = {
      users: allUsers,
      trips: tripsWithData,
      posts: allPosts,
    }

    const dumpDir = path.join(process.cwd(), 'db', 'dump')
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
    process.exit(0)
  }
}

createDump()
