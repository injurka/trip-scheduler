/* eslint-disable no-console */
import { RecordId } from 'surrealdb'
import { connectDB, db } from '~/db'
import { initSchema } from './init-schema'
import { MOCK_USER_DATA } from './mock/00.users'
import { MOCK_DATA as MOCK_TRIPS_DATA } from './mock/01.trips'
import { MOCK_METRO_DATA } from './mock/02.metro'
import { SUBSCRIPTION_MOCK } from './mock/03.subscription'
import { LLM_MOCK } from './mock/04.llm'
import { MOCK_POST_DATA } from './mock/05.posts'

/**
 * Хелпер для преобразования строкового ID в RecordId SurrealDB.
 */
function toId(table: string, id: string | undefined | null): RecordId | undefined {
  if (!id)
    return undefined
  return new RecordId(table, id)
}

/**
 * Очистка базы данных перед заполнением
 */
async function resetDatabase() {
  console.log('🧨 Очистка базы данных...')
  try {
    const result = await db.query<[{ tables: Record<string, string> }]>('INFO FOR DB')
    const tables = Object.keys(result[0]?.tables || {})
    if (tables.length === 0)
      return

    const query = tables.map(t => `REMOVE TABLE \`${t}\``).join(';')
    await db.query(query)
    console.log(`✅ Удалено таблиц: ${tables.length}`)
  }
  catch (error) {
    console.error('⚠️ Ошибка при очистке (возможно, база новая):', error)
  }
}

/**
 * Загрузка простых таблиц
 */
async function seedSimpleTables() {
  console.log('⏳ Загрузка справочников и пользователей...')

  for (const user of MOCK_USER_DATA) {
    // Убираем id из тела объекта
    const { id: _id, ...userData } = user
    await db.create(new RecordId('users', user.id), userData)
  }

  for (const metro of MOCK_METRO_DATA) {
    const { id: _id, ...metroData } = metro
    await db.create(new RecordId('metro_systems', metro.id), metroData)
  }

  for (const sub of SUBSCRIPTION_MOCK) {
    const { id: _id, ...subData } = sub
    await db.create(new RecordId('subscriptions', sub.id), subData)
  }

  for (const model of LLM_MOCK) {
    const { id: _id, ...modelData } = model
    await db.create(new RecordId('llm_models', model.id), modelData)
  }
  console.log('✅ Справочники загружены.')
}

/**
 * Загрузка путешествий со всей иерархией
 */
async function seedTrips() {
  const trips = Object.values(MOCK_TRIPS_DATA)
  console.log(`⏳ Загрузка ${trips.length} путешествий...`)

  for (const trip of trips) {
    // 1. Деструктуризация: извлекаем id (чтобы не попал в body), вложенные массивы и спец. поля
    const { id: _tripId, days, images, sections, participantIds, userId, ...tripMeta } = trip as any
    const tripRecordId = new RecordId('trips', trip.id)

    // 2. Создаем поездку
    await db.create(tripRecordId, {
      ...tripMeta,
      userId: toId('users', userId),
    })

    // 3. Графовые связи участников
    if (participantIds && participantIds.length > 0) {
      for (const pId of participantIds) {
        await db.query(`RELATE ${toId('users', pId)}->participates_in->${tripRecordId} SET joined_at = time::now()`)
      }
    }

    // 4. Дни и активности
    if (days?.length) {
      for (const day of days) {
        const { id: _dayId, activities, ...dayMeta } = day
        const dayRecordId = new RecordId('days', day.id)

        await db.create(dayRecordId, {
          ...dayMeta,
          tripId: tripRecordId,
        })

        if (activities?.length) {
          for (const activity of activities) {
            const { id: _actId, sections: actSections, ...actMeta } = activity
            const activityRecordId = new RecordId('activities', activity.id)

            await db.create(activityRecordId, {
              ...actMeta,
              dayId: dayRecordId,
            })

            if (actSections?.length) {
              for (const section of actSections) {
                const { id: _sectId, ...sectionData } = section
                await db.create(new RecordId('activity_sections', crypto.randomUUID()), {
                  ...sectionData,
                  activityId: activityRecordId,
                })
              }
            }
          }
        }
      }
    }

    // 5. Изображения
    if (images?.length) {
      for (const image of images) {
        const { id: _imgId, ...imageData } = image
        await db.create(new RecordId('images', image.id), {
          ...imageData,
          tripId: tripRecordId,
        })
      }
    }

    // 6. Секции поездки
    if (sections?.length) {
      for (const section of sections) {
        const { id: _sectId, ...sectionData } = section
        await db.create(new RecordId('trip_sections', crypto.randomUUID()), {
          ...sectionData,
          tripId: tripRecordId,
        })
      }
    }

    console.log(`   - Trip "${tripMeta.title}" loaded.`)
  }
  console.log('✅ Путешествия загружены.')
}

/**
 * Загрузка постов
 */
async function seedPosts() {
  if (MOCK_POST_DATA.length === 0)
    return

  console.log(`⏳ Загрузка ${MOCK_POST_DATA.length} постов...`)

  for (const post of MOCK_POST_DATA) {
    const { id: _postId, elements, media, userId, ...postMeta } = post
    const postRecordId = new RecordId('posts', post.id)

    await db.create(postRecordId, {
      ...postMeta,
      userId: toId('users', userId),
    })

    if (elements?.length) {
      for (const element of elements) {
        const { id: _elId, ...elData } = element
        await db.create(new RecordId('post_elements', element.id), {
          ...elData,
          postId: postRecordId,
        })
      }
    }

    if (media?.length) {
      for (const mediaItem of media) {
        const { id: _medId, ...medData } = mediaItem
        await db.create(new RecordId('post_media', mediaItem.id), {
          ...medData,
          postId: postRecordId,
        })
      }
    }
  }
  console.log('✅ Посты загружены.')
}

// --- Main ---

async function main() {
  try {
    await connectDB()

    await resetDatabase()
    await initSchema()

    await seedSimpleTables()
    await seedTrips()
    await seedPosts()

    console.log('\n🚀 SEEDING COMPLETE! 🚀')
  }
  catch (error) {
    console.error('❌ Error seeding database:', error)
  }
  finally {
    await db.close()
    process.exit()
  }
}

main()
