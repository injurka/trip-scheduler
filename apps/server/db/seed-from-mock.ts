/* eslint-disable no-console */
import { RecordId } from 'surrealdb'
import { connectDB, db } from '~/db'
import { MOCK_USER_DATA } from './mock/00.users'
import { MOCK_DATA as MOCK_TRIPS_DATA } from './mock/01.trips'
import { MOCK_METRO_DATA } from './mock/02.metro'
import { SUBSCRIPTION_MOCK } from './mock/03.subscription'
import { LLM_MOCK } from './mock/04.llm'
import { MOCK_POST_DATA } from './mock/05.posts'

// --- Вспомогательная функция для массовой вставки ---

/**
 * Обобщенная функция для загрузки данных в указанную таблицу.
 * @param tableName - Название таблицы в БД.
 * @param data - Массив объектов для вставки.
 * @param description - Описание данных для логгирования.
 */
async function seedTable<T extends { id: string }>(tableName: string, data: T[], description: string) {
  if (!data || data.length === 0) {
    console.log(`⚪ Пропуск '${description}', данные не найдены.`)
    return
  }

  console.log(`⏳ Загрузка '${description}'...`)
  try {
    // Используем последовательный цикл вместо Promise.all для избежания конфликтов записи
    for (const item of data) {
      await db.create(new RecordId(tableName, item.id), item)
    }
    console.log(`✅ Загружено ${data.length} записей в таблицу '${tableName}'.`)
  }
  catch (error) {
    console.error(`❌ Ошибка при загрузке '${description}':`, error)
    throw error // Прерываем выполнение, если что-то пошло не так
  }
}

// --- Функции для загрузки сложных, вложенных данных ---

/**
 * Загружает данные о путешествиях и все связанные с ними сущности.
 */
async function seedTrips() {
  const trips = Object.values(MOCK_TRIPS_DATA)
  if (trips.length === 0) {
    console.log('⚪ Пропуск путешествий, данные не найдены.')
    return
  }

  console.log(`⏳ Загрузка ${trips.length} путешествий и связанных данных...`)

  for (const trip of trips) {
    const { days, images, sections, ...tripData } = trip
    await db.create(new RecordId('trips', tripData.id), tripData)
    console.log(`   - Создано путешествие: ${tripData.title}`)

    if (days?.length) {
      for (const day of days) {
        await db.create(new RecordId('days', day.id), day)
      }
      console.log(`     - Загружено ${days.length} дней`)
    }

    if (images?.length) {
      for (const image of images) {
        await db.create(new RecordId('images', image.id), image)
      }
      console.log(`     - Загружено ${images.length} изображений`)
    }

    if (sections?.length) {
      for (const section of sections) {
        await db.create(new RecordId('sections', section.id), section)
      }
      console.log(`     - Загружено ${sections.length} секций`)
    }
  }

  console.log('✅ Все путешествия успешно загружены.')
}

/**
 * Загружает посты и связанные с ними элементы и медиа.
 */
async function seedPosts() {
  if (MOCK_POST_DATA.length === 0) {
    console.log('⚪ Пропуск постов, данные не найдены.')
    return
  }

  console.log(`⏳ Загрузка ${MOCK_POST_DATA.length} постов и связанных данных...`)

  for (const post of MOCK_POST_DATA) {
    const { elements, media, ...postData } = post
    await db.create(new RecordId('posts', postData.id), postData)
    console.log(`   - Создан пост: ${postData.title}`)

    if (elements?.length) {
      for (const element of elements) {
        await db.create(new RecordId('post_elements', element.id), element)
      }
      console.log(`     - Загружено ${elements.length} элементов поста`)
    }

    if (media?.length) {
      for (const mediaItem of media) {
        await db.create(new RecordId('post_media', mediaItem.id), mediaItem)
      }
      console.log(`     - Загружено ${media.length} медиа-файлов`)
    }
  }

  console.log('✅ Все посты успешно загружены.')
}

// --- Основная функция скрипта ---

async function seedDatabase() {
  try {
    await connectDB()
    console.log('🚀 Начинаем загрузку моковых данных в базу...')

    // Используем простые загрузчики для плоских данных
    await seedTable('users', MOCK_USER_DATA, 'Пользователи')
    await seedTable('metro_systems', MOCK_METRO_DATA, 'Схемы метро')
    await seedTable('subscriptions', SUBSCRIPTION_MOCK, 'Тарифные планы')
    await seedTable('llm_models', LLM_MOCK, 'Модели LLM')

    // Используем сложные загрузчики для данных с вложенностью
    await seedTrips()
    await seedPosts()

    console.log('\n🎉 Все данные успешно загружены!')
  }
  catch (error) {
    console.error('\n❌ Произошла критическая ошибка во время загрузки данных:', error)
  }
  finally {
    await db.close()
    console.log('👋 Соединение с базой данных закрыто.')
    process.exit()
  }
}

seedDatabase()
