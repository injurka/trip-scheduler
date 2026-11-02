import type { PgTable } from 'drizzle-orm/pg-core'
/* eslint-disable no-console */
import process from 'node:process'
import { sql } from 'drizzle-orm'
import { db } from './index'
import {
  activities,
  blogs,
  days,
  memories,
  postElements,
  postMedia,
  posts,
  savedPosts,
  tripImages,
  tripParticipants,
  trips,
  tripSections,
  users,
} from './schema'

/**
 * Вспомогательная функция для подсчета записей в таблице.
 * @param table - Схема таблицы из Drizzle.
 * @param tableName - Человекочитаемое имя таблицы для вывода.
 * @returns Объект с именем и количеством записей.
 */
async function getTableCount(table: PgTable, tableName: string): Promise<{ name: string, count: number }> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(table)
  return { name: tableName, count: result.count }
}

async function checkData() {
  console.log('🧐 Начинаем расширенную проверку данных в базе...')

  try {
    console.group('\n📊 Общая статистика по таблицам:')

    const counts = await Promise.all([
      getTableCount(users, '👤 Пользователи'),
      getTableCount(trips, '✈️ Путешествия'),
      getTableCount(days, '📅 Дни'),
      getTableCount(activities, '🏃 Мероприятия'),
      getTableCount(tripImages, '🖼️ Изображения путешествий'),
      getTableCount(memories, '📝 Воспоминания'),
      getTableCount(tripSections, '📚 Секции путешествий'),
      getTableCount(tripParticipants, '🧑‍🤝‍🧑 Участники путешествий'),
      getTableCount(posts, '📝 Посты'),
      getTableCount(postElements, '🧩 Элементы постов'),
      getTableCount(postMedia, '🎬 Медиа постов'),
      getTableCount(savedPosts, '🔖 Сохраненные посты'),
      getTableCount(blogs, '📰 Блог (Новости)'),
    ])

    counts.forEach(({ name, count }) => {
      console.log(`   - ${name}: ${count}`)
    })
    console.groupEnd()

    const tripCount = counts.find(c => c.name.includes('Путешествия'))?.count ?? 0
    if (tripCount > 0) {
      console.group('\n✅ Глубокая проверка первого путешествия:')
      const firstTrip = await db.query.trips.findFirst({
        with: {
          user: { columns: { name: true } },
          days: { with: { activities: { columns: { id: true } } } },
          participants: { columns: { userId: true } },
          images: { columns: { id: true } },
        },
      })

      if (firstTrip) {
        console.log(`   - Название: "${firstTrip.title}"`)
        console.log(`   - Автор: ${firstTrip.user.name}`)
        console.log(`   - Количество дней: ${firstTrip.days.length}`)
        const totalActivities = firstTrip.days.reduce((acc, day) => acc + day.activities.length, 0)
        console.log(`   - Общее количество мероприятий: ${totalActivities}`)
        console.log(`   - Количество участников: ${firstTrip.participants.length}`)
        console.log(`   - Количество изображений: ${firstTrip.images.length}`)
      }
      else {
        console.log('   - Не удалось загрузить данные о первом путешествии.')
      }
      console.groupEnd()
    }

    const postCount = counts.find(c => c.name.includes('Посты'))?.count ?? 0
    if (postCount > 0) {
      console.group('\n✅ Глубокая проверка первого поста:')
      const firstPost = await db.query.posts.findFirst({
        with: {
          user: { columns: { name: true } },
          elements: true,
          media: true,
        },
      })

      if (firstPost) {
        console.log(`   - Заголовок: "${firstPost.title}"`)
        console.log(`   - Автор: ${firstPost.user.name}`)
        console.log(`   - Статус: ${firstPost.status}`)
        console.log(`   - Элементов контента: ${firstPost.elements.length}`)
        console.log(`   - Медиа файлов: ${firstPost.media.length}`)
      }
      else {
        console.log('   - Не удалось загрузить данные о первом посте.')
      }
      console.groupEnd()
    }

    console.log('\n🎉 Проверка данных успешно завершена.')
  }
  catch (error) {
    console.error('\n❌ Ошибка во время проверки данных:', error)
    process.exit(1)
  }
}

checkData()
