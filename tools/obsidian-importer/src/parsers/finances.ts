import type { FinanceCategory, FinancesSectionContent, FinanceTransaction } from '../types'
import { existsSync, readFileSync } from 'node:fs'
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
  if (/авиа|перел[её]т/i.test(text))
    return 'cat-flights'
  if (/проживан|отел|гостиниц/i.test(text))
    return 'cat-housing'
  if (/транспорт|поезд|thsr|tra|паром|автобус|такси|трансфер|easycard|логистик/i.test(text))
    return 'cat-transport'
  if (/питани|еда|напит|завтрак|обед|ужин|стритфуд/i.test(text))
    return 'cat-food'
  if (/билет|активност|экскурси|музе|парк|снорклинг/i.test(text))
    return 'cat-entertainment'
  if (/сувенир|подарк|покупк|шопинг|чай/i.test(text))
    return 'cat-shopping'
  return 'cat-other'
}

function cleanMarkdown(value: string): string {
  return value.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim()
}

function rubAmount(value: string): number | undefined {
  const matches = [...value.matchAll(/`?~?([\d][\d\s]*)\s*(?:₽|RUB)`?/gi)]
  const raw = matches.at(-1)?.[1]
  if (!raw)
    return undefined
  const amount = Number.parseInt(raw.replace(/\s+/g, ''), 10)
  return amount > 0 ? amount : undefined
}

function makeTransaction(title: string, amount: number, categoryId = categoryFor(title), notes?: string): FinanceTransaction {
  const cleanTitle = cleanMarkdown(title)
  return {
    id: stableId('finance', categoryId, cleanTitle, amount),
    title: cleanTitle,
    amount,
    currency: 'RUB',
    categoryId,
    notes: notes ? cleanMarkdown(notes) : undefined,
  }
}

function parseSummary(lines: string[]): FinanceTransaction[] {
  const result: FinanceTransaction[] = []
  for (const line of lines) {
    if (!/^>\s*-\s+/.test(line))
      continue
    const amount = rubAmount(line)
    const titleMatch = line.match(/^>\s*-\s+(.+?):(?:\*\*)?\s*`?~?[\d\s]+\s*₽/i)
    if (amount && titleMatch)
      result.push(makeTransaction(titleMatch[1], amount))
  }
  return result
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
        result.push(makeTransaction(
          title,
          amount,
          inferredCategory === 'cat-other' ? currentCategory : inferredCategory,
          cols.slice(1).filter(col => col !== amountCell).join('; '),
        ))
      }
      continue
    }

    const bullet = trimmed.match(/^\s*[-*]\s+(?:\*\*)?(.+?)(?:\*\*)?:.*$/)
    const amount = rubAmount(trimmed)
    if (bullet && amount && !/итого|средняя стоимость/i.test(bullet[1]))
      result.push(makeTransaction(bullet[1], amount, currentCategory))
  }

  return result
}

export function parseObsidianFinances(financesFilePath?: string): FinancesSectionContent {
  const activeConfig = getConfig()
  const settings = {
    mainCurrency: activeConfig.mainCurrency,
    exchangeRates: activeConfig.exchangeRates,
  }

  if (!financesFilePath || !existsSync(financesFilePath))
    return { settings, categories: DEFAULT_CATEGORIES, transactions: [] }

  const lines = readFileSync(financesFilePath, 'utf-8').split('\n')
  const summaryTransactions = parseSummary(lines)
  const transactions = summaryTransactions.length > 0 ? summaryTransactions : parseDetailed(lines)

  return { settings, categories: DEFAULT_CATEGORIES, transactions }
}
