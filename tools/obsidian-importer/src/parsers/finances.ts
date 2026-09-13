import type { FinanceCategory, FinancesSectionContent, FinanceTransaction, TransactionStatus } from '../types'
import { existsSync, readFileSync } from 'node:fs'
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
  { id: 'cat-other', name: 'Прочее', icon: 'mdi:dots-horizontal-circle-outline', isDefault: true },
]

function categoryFor(text: string): string {
  if (/авиа|перел[её]т|flight/i.test(text))
    return 'cat-flights'
  if (/проживан|отел|гостиниц|миньсу|hotel|b&b/i.test(text))
    return 'cat-housing'
  if (/транспорт|поезд|thsr|tra|паром|автобус|такси|трансфер|easycard|логистик|авто/i.test(text))
    return 'cat-transport'
  if (/питани|еда|напит|завтрак|обед|ужин|стритфуд|ресторан|кафе/i.test(text))
    return 'cat-food'
  if (/билет|активност|экскурси|музе|парк|снорклинг|достопримеч/i.test(text))
    return 'cat-entertainment'
  if (/сувенир|подарк|покупк|шопинг|чай/i.test(text))
    return 'cat-shopping'
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
): FinanceTransaction {
  const cleanTitle = cleanMarkdown(title)
  return {
    id: stableId('finance', categoryId, cleanTitle, amount, status),
    title: cleanTitle,
    amount,
    currency: 'RUB',
    categoryId,
    status,
    notes: notes ? cleanMarkdown(notes) : undefined,
  }
}

function parseHotelsFromBookings(hotelsFilePath: string): FinanceTransaction[] {
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

    result.push(makeTransaction(
      title,
      amount,
      'cat-housing',
      isPaid ? 'paid' : 'planned',
      isPaid ? 'Оплачено онлайн' : 'К оплате на месте (План)',
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
      result.push(makeTransaction(
        hotelName,
        amount,
        'cat-housing',
        isPaid ? 'paid' : 'planned',
        isPaid ? 'Оплачено' : 'К оплате (План)',
      ))
    }
  }

  return result
}

function parseFlightsFromBookings(flightsFilePath: string): FinanceTransaction[] {
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
      return [makeTransaction(
        flightName,
        amount,
        'cat-flights',
        isPaid ? 'paid' : 'planned',
        isPaid ? 'Билеты выкуплены' : 'Планируемый перелет',
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

function parseDetailed(lines: string[]): FinanceTransaction[] {
  const result: FinanceTransaction[] = []
  let currentCategory = 'cat-other'

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^###\s+/.test(trimmed)) {
      currentCategory = categoryFor(trimmed)
      continue
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|') && !trimmed.includes('---')) {
      const cols = trimmed.slice(1, -1).split('|').map(cleanMarkdown)
      const title = cols[0] ?? ''
      if (!title || /^(?:статья|маршрут|тип|сегмент|направление|📊)/i.test(title) || /подитог|итого/i.test(title))
        continue
      const amountCell = cols.find(col => rubAmount(col) !== undefined)
      const amount = amountCell ? rubAmount(amountCell) : undefined
      if (amount) {
        const inferredCategory = categoryFor(title)
        const isPaid = /оплачен|paid|online/i.test(trimmed)
        result.push(makeTransaction(
          title,
          amount,
          inferredCategory === 'cat-other' ? currentCategory : inferredCategory,
          isPaid ? 'paid' : 'planned',
          cols.slice(1).filter(col => col !== amountCell).join('; '),
        ))
      }
      continue
    }

    const bullet = trimmed.match(/^\s*[-*]\s+(?:\*\*)?(.+?)(?:\*\*)?:.*$/)
    const amount = rubAmount(trimmed)
    if (bullet && amount && !/итого|средняя стоимость|текущий статус|разбивка/i.test(bullet[1])) {
      const isPaid = /оплачен|paid|online/i.test(trimmed)
      result.push(makeTransaction(
        bullet[1],
        amount,
        currentCategory,
        isPaid ? 'paid' : 'planned',
      ))
    }
  }

  return result
}

export function parseObsidianFinances(financesFilePath?: string, tripRoot?: string): FinancesSectionContent {
  const activeConfig = getConfig()
  const baseCategories = DEFAULT_CATEGORIES.map(c => ({ ...c }))

  if (!financesFilePath || !existsSync(financesFilePath)) {
    return {
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

  // Check if we have rich booking files for hotels and flights
  const hotelsFile = join(bookingsDir, 'Отели.md')
  const flightsFile = join(bookingsDir, 'Авиаперелеты.md')

  const parsedHotels = existsSync(hotelsFile) ? parseHotelsFromBookings(hotelsFile) : []
  const parsedFlights = existsSync(flightsFile) ? parseFlightsFromBookings(flightsFile) : []

  const transactions: FinanceTransaction[] = []

  // If we parsed hotel bookings, use them for cat-housing
  if (parsedHotels.length > 0) {
    transactions.push(...parsedHotels)
  }
  else {
    const housingSummary = summaryTransactions.filter(t => t.categoryId === 'cat-housing')
    transactions.push(...housingSummary)
  }

  // If we parsed flights, use them for cat-flights
  if (parsedFlights.length > 0) {
    transactions.push(...parsedFlights)
  }
  else {
    const flightsSummary = summaryTransactions.filter(t => t.categoryId === 'cat-flights')
    transactions.push(...flightsSummary)
  }

  // For other categories, add summary transactions
  for (const st of summaryTransactions) {
    if (st.categoryId !== 'cat-housing' && st.categoryId !== 'cat-flights') {
      transactions.push(st)
    }
  }

  // Fallback: if summaryTransactions was empty, try parseDetailed
  if (transactions.length === 0) {
    transactions.push(...parseDetailed(lines))
  }

  // Assign budgetLimit to categories
  for (const cat of baseCategories) {
    if (categoryBudgets[cat.id]) {
      cat.budgetLimit = categoryBudgets[cat.id]
    }
    else {
      // Sum up amounts for this category from transactions if limit was not in summary
      const catTotal = transactions
        .filter(t => t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0)
      if (catTotal > 0) {
        cat.budgetLimit = catTotal
      }
    }
  }

  const calculatedTotal = totalBudget
    || (summaryTransactions.length > 0 ? summaryTransactions.reduce((sum, t) => sum + t.amount, 0) : transactions.reduce((sum, t) => sum + t.amount, 0))

  const settings = {
    mainCurrency: activeConfig.mainCurrency,
    exchangeRates: activeConfig.exchangeRates,
    totalBudget: calculatedTotal > 0 ? calculatedTotal : undefined,
  }

  return { settings, categories: baseCategories, transactions }
}
