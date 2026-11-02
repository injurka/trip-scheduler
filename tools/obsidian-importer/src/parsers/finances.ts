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
  text = cleanMarkdown(text)

  // An explicit accounting date takes precedence over service/payment dates in notes.
  const accountingDate = text.match(/(?:дата\s+(?:расхода|операции|платежа)|expense\s+date)\s*:\s*(\d{4}-\d{2}-\d{2})/i)
  if (accountingDate)
    return accountingDate[1]

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

  const shortDateMatch = text.match(/(?:^|[\s(;,])([0-3]?\d)\.([01]?\d)(?![\d.])/)
  if (shortDateMatch) {
    const day = Number(shortDateMatch[1])
    const month = Number(shortDateMatch[2])
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12)
      return `${tripYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const dayMatch = text.match(/(?:День|Дни|Day)\s*(\d{1,2})/i)
  if (dayMatch) {
    const dayNum = Number.parseInt(dayMatch[1], 10)
    if (dayNum >= 1 && dayNum <= 60) {
      const d = new Date(`${startDate}T12:00:00Z`)
      d.setUTCDate(d.getUTCDate() + (dayNum - 1))
      return d.toISOString().split('T')[0]
    }
  }

  return undefined
}

export function buildDayKeywordMap(routePlanDir: string, startDate?: string): Map<string, string> {
  const map = new Map<string, string>()
  const ambiguous = new Set<string>()
  if (!routePlanDir || !existsSync(routePlanDir) || !startDate)
    return map

  try {
    const files = readdirSync(routePlanDir)
    for (const file of files) {
      const match = file.match(/^(\d{2})\s+([^\.]+)/)
      if (!match)
        continue
      const dayNum = Number.parseInt(match[1], 10)
      const d = new Date(`${startDate}T12:00:00Z`)
      d.setUTCDate(d.getUTCDate() + (dayNum - 1))
      const dateStr = d.toISOString().split('T')[0]

      // Only use the location prefix, never generic words in the activity title.
      const rawTitle = match[2].split('(')[0]
      const words = rawTitle.split(/[\s,➔\(\)]+/).filter(w => w.length >= 4 && !/^\d+$/.test(w))
      for (const word of words) {
        const cleanWord = word.toLowerCase().replace(/[^a-zа-яё]/gi, '')
        if (cleanWord.length < 4 || ambiguous.has(cleanWord))
          continue
        if (map.has(cleanWord) && map.get(cleanWord) !== dateStr) {
          map.delete(cleanWord)
          ambiguous.add(cleanWord)
        }
        else {
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
  if (/прочее|\bother\b/i.test(text))
    return 'cat-other'
  if (/авиа|перел[её]т|flight/i.test(text))
    return 'cat-flights'
  if (/проживан|отел|гостиниц|миньсу|hotel|b&b/i.test(text))
    return 'cat-housing'
  if (/транспорт|поезд|железнодорож|thsr|tra|паром|автобус|такси|трансфер|easycard|логистик|авто/i.test(text))
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
  const matches = [...value.matchAll(/`?~?([\d][\d\s]*(?:[.,]\d{1,2})?)\s*(?:₽|RUB)`?/gi)]
  const raw = matches.at(-1)?.[1]
  if (!raw)
    return undefined
  const amount = Number(raw.replace(/\s+/g, '').replace(',', '.'))
  return amount > 0 ? amount : undefined
}

function isPaidExpense(text: string): boolean {
  const plain = cleanMarkdown(text)
  const status = plain.match(/(?:статус|status)\s*:\s*([^;|.]+)/i)?.[1] ?? plain
  if (/(?:не\s*оплачен|пока\s+не\s+оплачен|к\s+оплате|\bunpaid\b|\bnot\s+paid\b|\bplanned\b|(?:^|[\s(;,])план(?=$|[\s);,.]))/i.test(status))
    return false
  const ownPayment = status.replace(/без\s+оплачен[а-яё]*[^;|.]*/gi, '')
  return /оплачен|\bpaid\b|\bonline\b|билеты?\s+(?:выпущен|куплен|выкуплен)|tickets?\s+issued/i.test(ownPayment)
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

    const isPaid = isPaidExpense(line)
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
      const isPaid = isPaidExpense(line)
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
      const isPaid = content.split('\n').some(line => isPaidExpense(line))
      const departureLine = content.split('\n').find(line => /дата отправления|даты пол[её]та/i.test(line))
      const flightDate = resolveDateFromText(departureLine || '', startDate) || startDate
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
  const totalLine = rawContent.split('\n').find(line => /общий[^\n]*бюджет|итого[^\n]*под ключ/i.test(line))
  if (totalLine)
    totalBudget = rubAmount(totalLine)

  for (const line of lines) {
    if (!/^>\s*-\s+/.test(line))
      continue
    const amount = rubAmount(line)
    const titleMatch = line.match(/^>\s*-\s+(.+?):(?:\*\*)?\s*`?~?[\d\s.,]+\s*₽/i)
    if (amount && titleMatch) {
      const title = titleMatch[1]
      const catId = categoryFor(title)
      categoryBudgets[catId] = (categoryBudgets[catId] || 0) + amount

      const isPaid = isPaidExpense(line) && !/из них/i.test(line)
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
  let inDetailedSection = false

  const findDateFromKeywords = (text: string): string | undefined => {
    const dates = new Set<string>()
    const words = text.toLowerCase().split(/[\s,➔\(\)]+/).filter(w => w.length >= 4)
    for (const word of words) {
      const cleanWord = word.replace(/[^a-zа-яё]/gi, '')
      if (dayKeywordMap.has(cleanWord)) {
        dates.add(dayKeywordMap.get(cleanWord)!)
      }
    }
    return dates.size === 1 ? [...dates][0] : undefined
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^#{1,2}\s+/.test(trimmed)) {
      inDetailedSection = false
      inSummaryTable = false
      continue
    }
    if (/^###\s+/.test(trimmed)) {
      currentCategory = categoryFor(trimmed)
      inSummaryTable = false
      inDetailedSection = true
      continue
    }
    if (!inDetailedSection)
      continue

    // Skip housing (parsed from bookings/Отели.md)
    if (currentCategory === 'cat-housing')
      continue

    // Meal estimates form an envelope; explicit paid purchases (e.g. prepaid
    // store credit) still belong in the payment history, inside that envelope.
    if (currentCategory === 'cat-food' && !isPaidExpense(trimmed))
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
        const isPaid = isPaidExpense(trimmed)
        const date = resolveDateFromText(trimmed, startDate)
          || findDateFromKeywords(trimmed)

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
      const isPaid = isPaidExpense(trimmed)
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
