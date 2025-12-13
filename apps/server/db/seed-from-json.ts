/* eslint-disable no-console */
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import prompts from 'prompts'
import { connectDB, db, toId } from '../src/db'
import { MOCK_METRO_DATA } from './mock/02.metro'
import { LLM_MOCK } from './mock/04.llm'

async function discoverAndSelectDumpFile(): Promise<string | null> {
  const dumpDir = path.join(process.cwd(), 'db', 'dump')

  try {
    const allFiles = await fs.readdir(dumpDir)
    const jsonFilesWithStats = await Promise.all(
      allFiles
        .filter(file => file.endsWith('.json'))
        .map(async (file) => {
          const filePath = path.join(dumpDir, file)
          const stats = await fs.stat(filePath)
          return {
            name: file,
            path: filePath,
            time: stats.mtime.getTime(),
          }
        }),
    )

    const sortedFiles = jsonFilesWithStats.sort((a, b) => b.time - a.time)
    if (sortedFiles.length === 0)
      return null

    const response = await prompts(
      {
        type: 'select',
        name: 'selectedDump',
        message: 'Выберите файл дампа для восстановления',
        choices: sortedFiles.map(file => ({
          title: file.name,
          description: `(создан: ${new Date(file.time).toLocaleString()})`,
          value: file.path,
        })),
      },
      { onCancel: () => process.exit(0) },
    )

    return response.selectedDump
  }
  catch {
    return null
  }
}

async function seedFromJson() {
  console.log('🌱 Начало заполнения базы данных из JSON дампа...')

  await connectDB()

  const filePathArg = process.argv[2]
  let dumpFile: string | null

  if (filePathArg) {
    dumpFile = path.resolve(process.cwd(), filePathArg)
  }
  else {
    dumpFile = await discoverAndSelectDumpFile()
    if (!dumpFile) {
      console.error('❌ Не найдены файлы дампа.')
      process.exit(1)
    }
  }

  let dumpData
  try {
    const fileContent = await fs.readFile(dumpFile!, 'utf-8')
    dumpData = JSON.parse(fileContent)
  }
  catch (error) {
    console.error(`❌ Ошибка при чтении файла дампа:`, error)
    process.exit(1)
  }

  const { users, trips, posts } = dumpData

  console.log('🗑️  Очистка всех данных...')
  await db.query(`
    REMOVE TABLE user; 
    REMOVE TABLE trip; 
    REMOVE TABLE day; 
    REMOVE TABLE activity; 
    REMOVE TABLE trip_section; 
    REMOVE TABLE trip_image; 
    REMOVE TABLE memory; 
    REMOVE TABLE post; 
    REMOVE TABLE participates_in; 
    REMOVE TABLE saved;
    REMOVE TABLE metro_system;
    REMOVE TABLE llm_models;
  `)

  console.log('🤖 Восстановление LLM моделей...')
  for (const m of LLM_MOCK) {
    await db.create(toId('llm_models', m.id), m)
  }

  console.log('🚇 Восстановление данных Метро...')
  if (MOCK_METRO_DATA) {
    for (const system of MOCK_METRO_DATA) {
      await db.create(toId('metro_system', system.id), system)
    }
  }

  console.log('👤 Восстановление пользователей...')
  if (users) {
    for (const u of users) {
      await db.create(toId('user', u.id), {
        ...u,
        id: toId('user', u.id),
      })
    }
  }

  console.log('✈️  Восстановление путешествий...')
  if (trips) {
    for (const t of trips) {
      const { days, sections, images, memories, participants, ...tripMeta } = t
      const tripId = toId('trip', t.id)

      await db.create(tripId, {
        ...tripMeta,
        id: tripId,
        user: toId('user', t.userId),
      })

      // Participants Graph
      if (participants) {
        for (const p of participants) {
          if (p.userId !== t.userId) { // Владельца не линкуем дважды, если не хотим
            await db.query(`RELATE ${toId('user', p.userId)}->participates_in->${tripId}`)
          }
        }
      }

      // Sub-entities
      if (sections) {
        for (const s of sections) await db.create(toId('trip_section', s.id), { ...s, id: toId('trip_section', s.id), tripId })
      }
      if (images) {
        for (const i of images) await db.create(toId('trip_image', i.id), { ...i, id: toId('trip_image', i.id), tripId })
      }
      if (memories) {
        for (const m of memories) {
          await db.create(toId('memory', m.id), {
            ...m,
            id: toId('memory', m.id),
            tripId,
            imageId: m.imageId ? toId('trip_image', m.imageId) : undefined,
          })
        }
      }
      if (days) {
        for (const d of days) {
          const dayId = toId('day', d.id)
          const { activities, ...dayMeta } = d
          await db.create(dayId, { ...dayMeta, id: dayId, tripId })

          if (activities) {
            for (const a of activities) {
              await db.create(toId('activity', a.id), { ...a, id: toId('activity', a.id), dayId })
            }
          }
        }
      }
    }
  }

  console.log('📝 Восстановление постов...')
  if (posts) {
    for (const p of posts) {
      const { savedBy, ...postMeta } = p
      const postId = toId('post', p.id)

      await db.create(postId, {
        ...postMeta,
        id: postId,
        user: toId('user', p.userId),
      })

      if (savedBy) {
        for (const s of savedBy) {
          await db.query(`RELATE ${toId('user', s.userId)}->saved->${postId}`)
        }
      }
    }
  }

  console.log('✅ База данных восстановлена.')
  process.exit(0)
}

seedFromJson()
