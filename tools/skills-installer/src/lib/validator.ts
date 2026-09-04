import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

export interface ValidationItem {
  status: 'pass' | 'warn' | 'fail'
  message: string
  details?: string
}

export interface TripValidationReport {
  tripName: string
  tripPath: string
  score: number // 0-100
  passedChecks: number
  totalChecks: number
  items: ValidationItem[]
  readinessForImporter: 'ready' | 'mostly-ready' | 'needs-work'
}

export function validateTripFolder(tripPath: string): TripValidationReport {
  const items: ValidationItem[] = []
  const folderName = basename(tripPath)
  const tripName = folderName.replace(/^--\s*/, '')

  let passed = 0
  let total = 0

  function check(status: 'pass' | 'warn' | 'fail', message: string, details?: string) {
    total++
    if (status === 'pass') {
      passed++
    }
    items.push({ status, message, details })
  }

  // 1. Проверка корневого хаба
  const hubCandidate = join(tripPath, `${folderName}.md`)
  const hubCandidate2 = join(tripPath, `${tripName}.md`)
  const hubFile = existsSync(hubCandidate) ? hubCandidate : existsSync(hubCandidate2) ? hubCandidate2 : null

  if (hubFile) {
    check('pass', `Корневой хаб найден: ${basename(hubFile)}`)
    const hubContent = readFileSync(hubFile, 'utf-8')

    if (/##\s*(?:📝\s*)?Краткое описание/i.test(hubContent)) {
      check('pass', 'Раздел «## 📝 Краткое описание» присутствует (нужен для карточки тура)')
    }
    else {
      check('warn', 'Отсутствует раздел «## 📝 Краткое описание»', 'obsidian-importer использует его для descriptionShort')
    }

    if (/##\s*(?:🗺️\s*)?Ключевые параметры/i.test(hubContent)) {
      check('pass', 'Раздел «## 🗺️ Ключевые параметры» присутствует')
    }
    else {
      check('warn', 'Желателен раздел «## 🗺️ Ключевые параметры» со сметой и отелями')
    }
  }
  else {
    check('fail', `Не найден корневой хаб ${folderName}.md или ${tripName}.md`, 'Необходим для заголовка и концепции тура')
  }

  // 2. Проверка раздела 02 - Маршрутный план
  const itineraryDir = join(tripPath, '02 - Маршрутный план')
  if (existsSync(itineraryDir) && statSync(itineraryDir).isDirectory()) {
    const dayFiles = readdirSync(itineraryDir).filter(f => f.endsWith('.md') && !f.includes('Маршрутный план.md'))
    if (dayFiles.length > 0) {
      check('pass', `Найдено ${dayFiles.length} дневных заметок в «02 - Маршрутный план/»`)

      let daysWithPhase = 0
      let daysWithTimeRegex = 0
      let daysWithMaps = 0
      let daysWithFinance = 0

      for (const dayFile of dayFiles) {
        const content = readFileSync(join(itineraryDir, dayFile), 'utf-8')
        if (/>\s*\*\*(?:Фаза тура|Фаза|Phase):\*\*/i.test(content) || />\s*\*\*(?:Ключевой хайлайт|Хайлайт|Highlight):\*\*/i.test(content)) {
          daysWithPhase++
        }
        if (/^[*-]\s*\*\*\d{1,2}:\d{2}\+?\s*(?:[-–—]\s*\d{1,2}:\d{2})?\+?\*\*/m.test(content)) {
          daysWithTimeRegex++
        }
        if (/<iframe\b[^>]+maps\.google\.com[^>]*>.*?<\/iframe>/i.test(content) || /maps\.google\.com/i.test(content)) {
          daysWithMaps++
        }
        if (/##\s*(?:💰\s*)?Финансовые затраты/i.test(content)) {
          daysWithFinance++
        }
      }

      if (daysWithPhase === dayFiles.length) {
        check('pass', `Все ${dayFiles.length} дней содержат метки «Фаза тура / Ключевой хайлайт»`)
      }
      else {
        check('warn', `${daysWithPhase} из ${dayFiles.length} дней содержат «Фаза тура / Ключевой хайлайт»`)
      }

      if (daysWithTimeRegex === dayFiles.length) {
        check('pass', `Все ${dayFiles.length} дней содержат таймлайн в формате «* **HH:MM - HH:MM** — **Название**:»`)
      }
      else if (daysWithTimeRegex > 0) {
        check('warn', `Таймлайн распознан в ${daysWithTimeRegex} из ${dayFiles.length} дней`)
      }
      else {
        check('fail', 'Ни в одном дне не найден таймлайн по стандарту «* **HH:MM - HH:MM** — **Название**:»')
      }

      if (daysWithMaps > 0) {
        check('pass', `Интерактивные Google Maps iframe найдены в ${daysWithMaps} днях`)
      }
      else {
        check('warn', 'В дневных заметках не найдены ссылки или iframe Google Maps')
      }

      if (daysWithFinance > 0) {
        check('pass', `Блок посуточных затрат «## 💰 Финансовые затраты» найден в ${daysWithFinance} днях`)
      }
      else {
        check('warn', 'В дневных заметках отсутствует «## 💰 Финансовые затраты на день»')
      }
    }
    else {
      check('fail', 'Папка «02 - Маршрутный план» пуста или не содержит файлов дней')
    }
  }
  else {
    check('fail', 'Не найдена папка «02 - Маршрутный план»')
  }

  // 3. Проверка раздела 03 - Бронирования
  const bookingsDir = join(tripPath, '03 - Бронирования')
  if (existsSync(bookingsDir) && statSync(bookingsDir).isDirectory()) {
    const files = readdirSync(bookingsDir)
    const hotelsFile = files.find(f => /отел|гостиниц/i.test(f) && f.endsWith('.md'))
    const flightsFile = files.find(f => /авиа|перелет/i.test(f) && f.endsWith('.md'))
    const transitFile = files.find(f => /транспорт|поезд/i.test(f) && f.endsWith('.md'))

    if (hotelsFile) {
      const content = readFileSync(join(bookingsDir, hotelsFile), 'utf-8')
      if (content.includes('|') && /ночи|ночей|цена|стоимость/i.test(content)) {
        check('pass', `Отели: найден файл ${hotelsFile} со сводной таблицей бронирований`)
      }
      else {
        check('warn', `Отели: в ${hotelsFile} не найдена сводная таблица со столбцами | Ночи | Локация | Отель |`)
      }
    }
    else {
      check('warn', 'Не найден файл «Отели.md» в разделе «03 - Бронирования/»')
    }

    if (flightsFile) {
      check('pass', `Авиаперелеты: найден файл ${flightsFile}`)
    }
    if (transitFile) {
      check('pass', `Транспорт: найден файл ${transitFile}`)
    }
  }
  else {
    check('warn', 'Не найдена папка «03 - Бронирования»')
  }

  // 4. Проверка раздела 04 - Финансы
  const financesDir = join(tripPath, '04 - Финансы')
  const financesFile = join(financesDir, 'Финансы.md')
  if (existsSync(financesFile)) {
    const content = readFileSync(financesFile, 'utf-8')
    const hasCategories = /###.*(?:✈️|🚗|🚄|🏨|🍜|🎟️|🎁)/.test(content)
    if (hasCategories) {
      check('pass', 'Финансы: сметный файл Финансы.md содержит размеченные категории расходов с эмодзи')
    }
    else {
      check('warn', 'Финансы: в Финансы.md желательно добавить стандартные эмодзи в заголовки подкатегорий (✈️, 🚄, 🏨, 🍜, 🎟️, 🎁)')
    }
  }
  else {
    check('warn', 'Не найден файл «04 - Финансы/Финансы.md»')
  }

  // 5. Проверка раздела 06 - Чек лист
  const checklistDir = join(tripPath, '06 - Чек лист')
  if (existsSync(checklistDir) && statSync(checklistDir).isDirectory()) {
    const files = readdirSync(checklistDir).filter(f => f.endsWith('.md'))
    if (files.length > 0) {
      check('pass', `Чек-листы: найдено ${files.length} файлов с чек-листами в «06 - Чек лист/»`)
    }
  }

  const score = total > 0 ? Math.round((passed / total) * 100) : 0
  let readinessForImporter: 'ready' | 'mostly-ready' | 'needs-work' = 'ready'
  if (score < 50) {
    readinessForImporter = 'needs-work'
  }
  else if (score < 80) {
    readinessForImporter = 'mostly-ready'
  }

  return {
    tripName,
    tripPath,
    score,
    passedChecks: passed,
    totalChecks: total,
    items,
    readinessForImporter,
  }
}
