/* eslint-disable no-console */
import process from 'node:process'
import { connectDB, db } from '../src/db'

async function checkData() {
  console.log('🧐 Начинаем проверку данных в SurrealDB...')

  try {
    await connectDB()

    console.group('\n📊 Общая статистика по таблицам:')

    const tables = [
      { name: 'user', label: '👤 Пользователи' },
      { name: 'trip', label: '✈️ Путешествия' },
      { name: 'day', label: '📅 Дни' },
      { name: 'activity', label: '🏃 Мероприятия' },
      { name: 'trip_image', label: '🖼️ Изображения' },
      { name: 'memory', label: '📝 Воспоминания' },
      { name: 'trip_section', label: '📚 Секции' },
      { name: 'post', label: '📝 Посты' },
      { name: 'participates_in', label: '🧑‍🤝‍🧑 Связи участников' },
      { name: 'saved', label: '🔖 Сохраненные посты' },
    ]

    const counts: Record<string, number> = {}

    for (const t of tables) {
      const [res] = await db.query<[{ count: number }][]>(`SELECT count() FROM \`${t.name}\` GROUP ALL`)
      const count = res[0]?.count || 0
      counts[t.name] = count
      console.log(`   - ${t.label}: ${count}`)
    }
    console.groupEnd()

    // Проверка путешествий
    if (counts.trip > 0) {
      console.group('\n✅ Глубокая проверка первого путешествия:')
      const [trips] = await db.query<any[][]>(`
        SELECT *, 
          user.name as ownerName,
          (SELECT count() FROM day WHERE tripId = $parent.id GROUP ALL)[0].count as dayCount,
          (SELECT count() FROM <-participates_in GROUP ALL)[0].count as participantCount
        FROM trip 
        LIMIT 1 
        FETCH user
      `)

      const firstTrip = trips[0]

      if (firstTrip) {
        const userName = typeof firstTrip.user === 'object' ? firstTrip.user?.name : 'Не загружен (ID)'

        console.log(`   - ID: "${firstTrip.id}"`)
        console.log(`   - Название: "${firstTrip.title}"`)
        console.log(`   - Автор: ${userName || 'Неизвестен'}`)
        console.log(`   - Количество дней: ${firstTrip.dayCount || 0}`)
        console.log(`   - Количество участников: ${firstTrip.participantCount || 0}`)
      }
      else {
        console.log('   - Не удалось загрузить данные о первом путешествии.')
      }
      console.groupEnd()
    }
    else {
      console.log('\n⚠️ Путешествия не найдены.')
    }

    console.log('\n🎉 Проверка данных завершена.')
    process.exit(0)
  }
  catch (error) {
    console.error('\n❌ Ошибка во время проверки данных:', error)
    process.exit(1)
  }
}

checkData()
