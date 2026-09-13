import type { FinanceCategory, FinancesSectionContent, FinanceTransaction, TransactionStatus } from '../types'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { getConfig } from '../config/loader'
import { stableId } from '../lib/stable-id'

const DEFAULT_CATEGORIES: FinanceCategory[] = [
  { id: 'cat-housing', name: 'Жильё', icon: 'mdi:bed', isDefault: true },
  { id: 'cat-transport', name: 'Транспорт', icon: 'mdi:train-car', isDefault: true },
  { id: 'cat-flights', name: 'Авиабилеты', icon: 'mdi:airplane', isDefault: true },
  { id: 'cat-food', name: 'Еда и напитки', icon: 'mdi:food-fork-drink', isDefault: true },
  { id: 'cat-entertainment', name: 'Развлечения', icon: 'mdi:party-popper', isDefault: true },
  { id: 'cat-shopping', name: 'Покупки', icon: 'mdi:shopping-outline', isDefault: true },
  { id: 'cat-telecom', name: 'Связь и страховка', icon: 'mdi:cellphone-wireless', isDefault: true },
  { id: 'cat-other', name: 'Прочее', icon: 'mdi:dots-horizontal-circle-outline', isDefault: true },
]

const RU_MONTHS: Record<string, number> = {
  янв: 1,
  фев: 2,
  мар: 3,
  апр: 4,
  май: 5,
  июн: 6,
  июл: 7,
  авг: 8,
  сен: 9,
  окт: 10,
  ноя: 11,
  дек: 12,
}

export function resolveDateFromText(text: string, startDate?: string): string | undefined {
  if (!startDate)
    return undefined

  const tripYear = Number.parseInt(startDate.split('-')[0], 10)

  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch)
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  const dotMatch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (dotMatch) {
    const padD = String(dotMatch[1]).padStart(2, '0')
    const padM = String(dotMatch[2]).padStart(2, '0')
    return `${dotMatch[3]}-${padM}-${padD}`
  }

  const textMonthMatch = text.match(/(\d{1,2})\s+([а-яё]{3,4})/i)
  if (textMonthMatch) {
    const day = Number.parseInt(textMonthMatch[1], 10)
    const monthKey = textMonthMatch[2].slice(0, 3).toLowerCase()
    const month = RU_MONTHS[monthKey]
    if (month && day > 0 && day <= 31) {
      const padM = String(month).padStart(2, '0')
      const padD = String(day).padStart(2, '0')
      return `${tripYear}-${padM}-${padD}`
    }
  }

  const dayMatch = text.match(/(?:День|Дни|\*\*)\s*(\d{1,2})/i)
  if (dayMatch) {
    const dayNum = Number.parseInt(dayMatch[1], 10)
    if (dayNum >= 1 && dayNum <= 60) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + (dayNum - 1))
      return d.toISOString().split('T')[0]
    }
  }

  return undefined
}

export function buildDayKeywordMap(routePlanDir: string, startDate?: string): Map<string, string> {
  const map = new Map<string, string>()
  if (!routePlanDir || !existsSync(routePlanDir) || !startDate)
    return map

  try {
    const files = readdirSync(routePlanDir)
    for (const file of files) {
      const match = file.match(/^(\d{2})\s+([^\.]+)/)
      if (!match)
        continue
      const dayNum = Number.parseInt(match[1], 10)
      const d = new Date(startDate)
      d.setDate(d.getDate() + (dayNum - 1))
      const dateStr = d.toISOString().split('T')[0]

      const rawTitle = match[2]
      const words = rawTitle.split(/[\s,➔\(\)]+/).filter(w => w.length >= 4 && !/^\d+$/.test(w))
      for (const word of words) {
        const cleanWord = word.toLowerCase().replace(/[^a-zа-яё]/gi, '')
        if (cleanWord.length >= 4 && !map.has(cleanWord)) {
          map.set(cleanWord, dateStr)
        }
      }
    }
  }
  catch {
    // Ignore read errors
  }

  return map
}

function categoryFor(text: string): string {
  if (/авиа|перел[её]т|flight/i.test(text))
    return 'cat-flights'
  if (/проживан|отел|гостиниц|миньсу|hotel|b&b/i.test(text))
    return 'cat-housing'
  if (/транспорт|поезд|thsr|tra|паром|автобус|такси|трансфер|easycard|логистик|авто/i.test(text))
    return 'cat-transport'
  if (/питани|еда|напит|завтрак|обед|ужин|стритфуд|ресторан|кафе/i.test(text))
    return 'cat-food'
  if (/билет|активност|экскурси|музе|парк|снорклинг|достопримеч|геопарк/i.test(text))
    return 'cat-entertainment'
  if (/связь|интернет|esim|sim-карт|сим|страховк|полис/i.test(text))
    return 'cat-telecom'
  if (/сувенир|подарк|покупк|шопинг|чай|резерв/i.test(text))
    return 'cat-shopping'
  if (/виз|evisa|сбор/i.test(text))
    return 'cat-other'
  return 'cat-other'
}

function cleanMarkdown(value: string): string {
  return value.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim()
}

function rubAmount(value: string): number | undefined {
  const cleaned = value.replace(/,\d+\s*(?:₽|RUB)/gi, ' ₽')
  const matches = [...cleaned.matchAll(/`?~?([\d][\d\s]*)\s*(?:₽|RUB)`?/gi)]
  const raw = matches.at(-1)?.[1]
  if (!raw)
    return undefined
  const amount = Number.parseInt(raw.replace(/\s+/g, ''), 10)
  return amount > 0 ? amount : undefined
}

function makeTransaction(
  title: string,
  amount: number,
  categoryId = categoryFor(title),
  status: TransactionStatus = 'planned',
  notes?: string,
  date?: string,
): FinanceTransaction {
  const cleanTitle = cleanMarkdown(title)
  return {
    id: stableId('finance', categoryId, cleanTitle, amount, status, date || ''),
    title: cleanTitle,
    amount,
    currency: 'RUB',
    categoryId,
    isSpontaneous: false,
    status,
    notes: notes ? cleanMarkdown(notes) : undefined,
    date,
    source: 'imported',
    sourceKey: stableId('finance-source', categoryId, cleanTitle, amount, date || ''),
  }
}

function parseHotelsFromBookings(hotelsFilePath: string, startDate?: string): FinanceTransaction[] {
  if (!existsSync(hotelsFilePath))
    return []
  const content = readFileSync(hotelsFilePath, 'utf-8')
  const lines = content.split('\n')
  const result: FinanceTransaction[] = []

  for (const line of lines) {
    if (!line.startsWith('|') || line.includes('---') || /Ночи\s*\/\s*Дни|ИТОГО/i.test(line))
      continue
    const cols = line.split('|').map(s => s.trim()).filter(Boolean)
    if (cols.length < 4)
      continue
    const dayCol = cols[0]
    const location = cleanMarkdown(cols[1] || '')
    const rawHotelCol = cols[2] || ''
    const nights = cleanMarkdown(cols[3] || '')
    const totalCol = cols[cols.length - 1]
    const amount = rubAmount(totalCol)
    if (!amount)
      continue

    const isPaid = /оплачен|paid|online/i.test(line) || /оплачен|paid|online/i.test(rawHotelCol)
    const hotelName = cleanMarkdown(rawHotelCol.replace(/\*\(оплачено\)\*/gi, '').trim())
    const title = `${hotelName} (${location}, ${nights})`.trim()
    const date = resolveDateFromText(`${location} ${dayCol}`, startDate)

    result.push(makeTransaction(
      title,
      amount,
      'cat-housing',
      isPaid ? 'paid' : 'planned',
      isPaid ? 'Оплачено онлайн' : 'К оплате на месте (План)',
      date,
    ))
  }

  // If no table rows found, try bullet items
  if (result.length === 0) {
    for (const line of lines) {
      if (!/^[\*\-]\s+/.test(line))
        continue
      const amount = rubAmount(line)
      if (!amount)
        continue
      const isPaid = /оплачен|paid|online/i.test(line)
      const match = line.match(/^[\*\-]\s+(?:[^\w\s\(\)]+\s+)?(.+?):\s*`?~?[\d\s]+(?:,\d+)?\s*₽/i)
      const rawName = match ? match[1] : line.replace(/^[\*\-]\s+/, '')
      const hotelName = cleanMarkdown(rawName.replace(/\*\(.+?\)\*/g, '').trim())
      const date = resolveDateFromText(line, startDate)
      result.push(makeTransaction(
        hotelName,
        amount,
        'cat-housing',
        isPaid ? 'paid' : 'planned',
        isPaid ? 'Оплачено' : 'К оплате (План)',
        date,
      ))
    }
  }

  return result
}

function parseFlightsFromBookings(flightsFilePath: string, startDate?: string): FinanceTransaction[] {
  if (!existsSync(flightsFilePath))
    return []
  const content = readFileSync(flightsFilePath, 'utf-8')
  const heroMatch = content.match(/>\s*\[!SUCCESS\][^\n]*\n(?:>[^\n]*\n)*?.*?Стоимость:[^\n]*?([\d][\d\s]*)\s*₽/is)
    || content.match(/Стоимость:[^\n]*?([\d][\d\s]*)\s*₽/i)

  const titleMatch = content.match(/Выбранный\s+(?:авиа)?рейс:\s*\*\*?([^\n*]+)\*\*?/i)
  if (heroMatch) {
    const amount = Number.parseInt(heroMatch[1].replace(/\s+/g, ''), 10)
    if (amount > 0) {
      const flightName = titleMatch ? cleanMarkdown(titleMatch[1]) : 'Международный авиаперелет'
      const isPaid = /trip\.com|orderdetail|pnr|билет|маршрут-квитанция|оплачен/i.test(content)
      const flightDate = resolveDateFromText(content, startDate) || startDate
      return [makeTransaction(
        flightName,
        amount,
        'cat-flights',
        isPaid ? 'paid' : 'planned',
        isPaid ? 'Билеты выкуплены' : 'Планируемый перелет',
        flightDate,
      )]
    }
  }
  return []
}

interface SummaryParseResult {
  totalBudget?: number
  categoryBudgets: Record<string, number>
  summaryTransactions: FinanceTransaction[]
}

function parseSummary(lines: string[], rawContent: string): SummaryParseResult {
  const categoryBudgets: Record<string, number> = {}
  const summaryTransactions: FinanceTransaction[] = []

  let totalBudget: number | undefined
  const totalMatch = rawContent.match(/(?:общий[^\n]*бюджет|итого[^\n]*под ключ)[^\n]*?([\d][\d\s]+)\s*₽/i)
  if (totalMatch) {
    totalBudget = Number.parseInt(totalMatch[1].replace(/\s+/g, ''), 10)
  }

  for (const line of lines) {
    if (!/^>\s*-\s+/.test(line))
      continue
    const amount = rubAmount(line)
    const titleMatch = line.match(/^>\s*-\s+(.+?):(?:\*\*)?\s*`?~?[\d\s]+\s*₽/i)
    if (amount && titleMatch) {
      const title = titleMatch[1]
      const catId = categoryFor(title)
      categoryBudgets[catId] = (categoryBudgets[catId] || 0) + amount

      const isPaid = /оплачен|paid|online/i.test(line) && !/из них/i.test(line)
      summaryTransactions.push(makeTransaction(
        title,
        amount,
        catId,
        isPaid ? 'paid' : 'planned',
        isPaid ? 'Оплачено' : 'Планируемые расходы',
      ))
    }
  }

  return { totalBudget, categoryBudgets, summaryTransactions }
}

function parseDetailed(
  lines: string[],
  dayKeywordMap: Map<string, string>,
  startDate?: string,
): FinanceTransaction[] {
  const hasDetailedSections = lines.some(line => /^###\s+/.test(line.trim()))
  if (!hasDetailedSections)
    return []

  const result: FinanceTransaction[] = []
  let currentCategory = 'cat-other'
  let inSummaryTable = false

  const findDateFromKeywords = (text: string): string | undefined => {
    const words = text.toLowerCase().split(/[\s,➔\(\)]+/).filter(w => w.length >= 4)
    for (const word of words) {
      const cleanWord = word.replace(/[^a-zа-яё]/gi, '')
      if (dayKeywordMap.has(cleanWord)) {
        return dayKeywordMap.get(cleanWord)
      }
    }
    return undefined
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^###\s+/.test(trimmed)) {
      currentCategory = categoryFor(trimmed)
      inSummaryTable = false
      continue
    }

    // Skip housing (parsed from bookings/Отели.md)
    if (currentCategory === 'cat-housing')
      continue

    // Skip food daily meal norms (they form the category budget limit)
    if (currentCategory === 'cat-food')
      continue

    // Detect summary / aggregate table start
    if (trimmed.startsWith('|') && /сводка|сводная таблица/i.test(trimmed)) {
      inSummaryTable = true
      continue
    }

    if (inSummaryTable) {
      if (!trimmed.startsWith('|'))
        inSummaryTable = false
      continue
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|') && !trimmed.includes('---')) {
      const cols = trimmed.slice(1, -1).split('|').map(cleanMarkdown)
      const col0 = cols[0] ?? ''
      if (!col0 || /^(?:статья|маршрут|тип|сегмент|направление|📊)/i.test(col0) || /подитог|итого|сводка/i.test(col0))
        continue

      // Skip flights (parsed from Авиаперелеты.md)
      if (/China Southern|авиабилет|авиаперелет/i.test(col0))
        continue

      const amountCell = cols.find(col => rubAmount(col) !== undefined)
      const amount = amountCell ? rubAmount(amountCell) : undefined
      if (amount) {
        let title = col0
        if (cols[1] && !rubAmount(cols[1]) && !/^\d+\s*ч/i.test(cols[1])) {
          title = `${col0}: ${cols[1]}`
        }
        else if (cols[1] && /^\d+\s*ч/i.test(cols[1])) {
          title = `${col0} (${cols[1]})`
        }

        const catId = /виз|evisa|сбор/i.test(title)
          ? 'cat-other'
          : /связь|интернет|esim|sim-карт|сим|страховк|полис/i.test(title)
            ? 'cat-telecom'
            : currentCategory
        const isPaid = /оплачен|paid|online/i.test(trimmed)
        const date = resolveDateFromText(trimmed, startDate)
          || findDateFromKeywords(trimmed)
          || (col0.includes('EasyCard') && startDate ? resolveDateFromText('День 03', startDate) : (catId === 'cat-other' && startDate ? startDate : undefined))

        result.push(makeTransaction(
          title,
          amount,
          catId,
          isPaid ? 'paid' : 'planned',
          cols.slice(1).filter(col => col !== amountCell).join('; ') || undefined,
          date,
        ))
      }
      continue
    }

    const bullet = trimmed.match(/^\s*[-*]\s+(?:\*\*)?(.+?)(?:\*\*)?:.*$/)
    const amount = rubAmount(trimmed)
    if (bullet && amount && !/итого|подитог|сводка|средняя стоимость|текущий статус|разбивка/i.test(bullet[1])) {
      const isPaid = /оплачен|paid|online/i.test(trimmed)
      const title = bullet[1]
      const catId = /связь|интернет|esim|sim-карт|сим|страховк|полис/i.test(title)
        ? 'cat-telecom'
        : currentCategory
      const date = resolveDateFromText(trimmed, startDate) || findDateFromKeywords(trimmed)

      result.push(makeTransaction(
        title,
        amount,
        catId,
        isPaid ? 'paid' : 'planned',
        undefined,
        date,
      ))
    }
  }

  return result
}

export function parseObsidianFinances(
  financesFilePath?: string,
  tripRoot?: string,
  startDateStr?: string,
): FinancesSectionContent {
  const activeConfig = getConfig()
  const baseCategories = DEFAULT_CATEGORIES.map(c => ({ ...c }))

  if (!financesFilePath || !existsSync(financesFilePath)) {
    return {
      schemaVersion: 1,
      settings: {
        mainCurrency: activeConfig.mainCurrency,
        exchangeRates: activeConfig.exchangeRates,
      },
      categories: baseCategories,
      transactions: [],
    }
  }

  const rawContent = readFileSync(financesFilePath, 'utf-8')
  const lines = rawContent.split('\n')
  const { totalBudget, categoryBudgets, summaryTransactions } = parseSummary(lines, rawContent)

  // Determine root directory of the trip
  const root = tripRoot || resolve(dirname(financesFilePath), '..')
  const bookingsDir = join(root, '03 - Бронирования')
  const routePlanDir = join(root, '02 - Маршрутный план')

  const dayKeywordMap = buildDayKeywordMap(routePlanDir, startDateStr)

  // Check if we have rich booking files for hotels and flights
  const hotelsFile = join(bookingsDir, 'Отели.md')
  const flightsFile = join(bookingsDir, 'Авиаперелеты.md')

  const parsedHotels = existsSync(hotelsFile) ? parseHotelsFromBookings(hotelsFile, startDateStr) : []
  const parsedFlights = existsSync(flightsFile) ? parseFlightsFromBookings(flightsFile, startDateStr) : []
  const parsedDetailed = parseDetailed(lines, dayKeywordMap, startDateStr)

  const transactions: FinanceTransaction[] = []

  // 1. Hotels
  if (parsedHotels.length > 0) {
    transactions.push(...parsedHotels)
  }
  else {
    const housingSummary = summaryTransactions.filter(t => t.categoryId === 'cat-housing')
    transactions.push(...housingSummary)
  }

  // 2. Flights
  if (parsedFlights.length > 0) {
    transactions.push(...parsedFlights)
  }
  else {
    const flightsSummary = summaryTransactions.filter(t => t.categoryId === 'cat-flights')
    transactions.push(...flightsSummary)
  }

  // 3. Other detailed transactions (Transport, Activities, Visa, Shopping, Telecom)
  const detailedCategories = new Set(parsedDetailed.map(t => t.categoryId))
  transactions.push(...parsedDetailed)

  // 4. For categories not covered by detailed transactions, add summary items
  for (const st of summaryTransactions) {
    if (
      st.categoryId !== 'cat-housing'
      && st.categoryId !== 'cat-flights'
      && !detailedCategories.has(st.categoryId)
    ) {
      if (st.categoryId === 'cat-food' && parsedDetailed.length > 0)
        continue
      transactions.push(st)
    }
  }

  // 5. Assign budgetLimit to categories
  for (const cat of baseCategories) {
    if (categoryBudgets[cat.id]) {
      cat.budgetLimit = categoryBudgets[cat.id]
    }
    else {
      const catTotal = transactions
        .filter(t => t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0)
      if (catTotal > 0) {
        cat.budgetLimit = catTotal
      }
    }
  }

  const categoryLimitsSum = Object.values(categoryBudgets).reduce((sum, val) => sum + val, 0)
  const calculatedTotal = totalBudget
    || (categoryLimitsSum > 0 ? categoryLimitsSum : transactions.reduce((sum, t) => sum + t.amount, 0))

  const settings = {
    mainCurrency: activeConfig.mainCurrency,
    exchangeRates: activeConfig.exchangeRates,
    totalBudget: calculatedTotal > 0 ? calculatedTotal : undefined,
  }

  return { schemaVersion: 1, settings, categories: baseCategories, transactions }
}
