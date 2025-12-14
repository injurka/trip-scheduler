/* eslint-disable no-console */
import process from 'node:process'
import { connectDB, db } from '../src/db'

async function checkData() {
  console.log('🧐 Начинаем проверку данных в SurrealDB...')

  try {
    await connectDB()

    console.group('\n📊 Общая статистика по таблицам:')

    const tables = [
      { name: 'users', label: '👤 Пользователи' },
      { name: 'trips', label: '✈️ Путешествия' },
      { name: 'days', label: '📅 Дни' },
      { name: 'activity', label: '🏃 Мероприятия' },
      { name: 'images', label: '🖼️ Изображения' },
      { name: 'memory', label: '📝 Воспоминания' },
      { name: 'sections', label: '📚 Секции' },
      { name: 'posts', label: '📝 Посты' },
      { name: 'participates_in', label: '🧑‍🤝‍🧑 Связи участников' },
      { name: 'saved', label: '🔖 Сохраненные посты' },
    ]

    const counts: Record<string, number> = {}

    for (const t of tables) {
      try {
        const [res] = await db.query<[{ count: number }][]>(`SELECT count() FROM \`${t.name}\` GROUP ALL`)
        const count = res[0]?.count || 0
        counts[t.name] = count
        console.log(`   - ${t.label}: ${count}`)
      }
      catch (e) {
        counts[t.name] = 0
        console.log(`   - ${t.label}: 0 (ошибка при запросе или таблица не существует)`)
      }
    }
    console.groupEnd()

    if (counts.trips > 0) {
      console.group('\n✅ Глубокая проверка первого путешествия:')

      const [trips] = await db.query<any[][]>(`
        SELECT *, 
          (SELECT count() FROM days WHERE tripId = $parent.id GROUP ALL)[0].count as dayCount,
          (SELECT count() FROM <-participates_in GROUP ALL)[0].count as participantCount
        FROM trips 
        LIMIT 1 
        FETCH owner
      `)

      const firstTrip = trips[0]

      if (firstTrip) {
        const userName = firstTrip.owner?.name || 'Неизвестен'

        console.log(`   - ID: "${firstTrip.id}"`)
        console.log(`   - Название: "${firstTrip.title}"`)
        console.log(`   - Автор: ${userName}`)
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
  }
  catch (error) {
    console.error('\n❌ Ошибка во время проверки данных:', error)
    process.exit(1)
  }
  finally {
    await db.close()
    console.log('👋 Соединение с базой данных закрыто.')
    process.exit(0)
  }
}

checkData()
