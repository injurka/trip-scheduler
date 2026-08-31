import type { FinanceCategory, FinancesSectionContent, FinanceTransaction } from '../types'
import { existsSync, readFileSync } from 'node:fs'

export function parseObsidianFinances(financesFilePath?: string): FinancesSectionContent {
  const defaultCategories: FinanceCategory[] = [
    { id: 'cat-housing', name: 'Жильё', icon: 'mdi:bed', isDefault: true },
    { id: 'cat-transport', name: 'Транспорт', icon: 'mdi:train-car', isDefault: true },
    { id: 'cat-flights', name: 'Авиабилеты', icon: 'mdi:airplane', isDefault: true },
    { id: 'cat-food', name: 'Еда и напитки', icon: 'mdi:food-fork-drink', isDefault: true },
    { id: 'cat-entertainment', name: 'Развлечения', icon: 'mdi:party-popper', isDefault: true },
    { id: 'cat-shopping', name: 'Покупки', icon: 'mdi:shopping-outline', isDefault: true },
    { id: 'cat-other', name: 'Прочее', icon: 'mdi:dots-horizontal-circle-outline', isDefault: true },
  ]

  const settings = {
    mainCurrency: 'RUB',
    exchangeRates: { TWD: 2.8, USD: 90, EUR: 100, CNY: 12.5 },
  }

  if (!financesFilePath || !existsSync(financesFilePath)) {
    return {
      settings,
      categories: defaultCategories,
      transactions: [],
    }
  }

  const content = readFileSync(financesFilePath, 'utf-8')
  const transactions: FinanceTransaction[] = []
  const lines = content.split('\n')
  let currentCategory = 'cat-other'

  for (const line of lines) {
    const trimmed = line.trim()

    // Detect section category from headers
    if (/###\s*\d*\.?\s*✈️|авиаперелет/i.test(trimmed)) {
      currentCategory = 'cat-flights'
    }
    else if (/###\s*\d*\.?\s*🚗|🚄|поезд|транспорт|логистик/i.test(trimmed)) {
      currentCategory = 'cat-transport'
    }
    else if (/###\s*\d*\.?\s*🏨|проживани|отел|гостиниц/i.test(trimmed)) {
      currentCategory = 'cat-housing'
    }
    else if (/###\s*\d*\.?\s*🍜|питани|еда|ресторан|ночной рынок/i.test(trimmed)) {
      currentCategory = 'cat-food'
    }
    else if (/###\s*\d*\.?\s*🎟️|входн|билет|активност|экскурси/i.test(trimmed)) {
      currentCategory = 'cat-entertainment'
    }
    else if (/###\s*\d*\.?\s*🎁|сувенир|шопинг|покупк|чай/i.test(trimmed)) {
      currentCategory = 'cat-shopping'
    }

    // Markdown Table Row parser
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && !trimmed.includes('---') && !/подитог|итого/i.test(trimmed)) {
      const cols = trimmed.slice(1, -1).split('|').map(c => c.trim())
      if (cols.length >= 2) {
        const titleCol = cols[0]
        const amountCol = cols.find(c => /`?[\d\s]+(?:[–—\-][\d\s]*)?(?:₽|RUB|TWD|\$|EUR)/i.test(c))
        const notesCol = cols.length >= 3 ? cols.slice(2).join('; ') : undefined

        if (amountCol && titleCol && !/статья|маршрут|тип поезда|сегмент|направление/i.test(titleCol)) {
          const numMatch = amountCol.replace(/\s+/g, '').match(/(\d+)/)
          if (numMatch) {
            const amount = Number.parseInt(numMatch[1], 10)
            if (amount > 0) {
              const cleanTitle = titleCol.replace(/[*_`]/g, '').trim()
              let cat = currentCategory
              if (/авиа|перелет/i.test(cleanTitle))
                cat = 'cat-flights'
              else if (/thsr|tra|поезд|паром|автобус|байк|такси|трансфер|машин|easycard/i.test(cleanTitle))
                cat = 'cat-transport'
              else if (/отел|проживан|b&b|номер|ноч/i.test(cleanTitle))
                cat = 'cat-housing'

              transactions.push({
                id: crypto.randomUUID(),
                title: cleanTitle,
                amount,
                currency: 'RUB',
                categoryId: cat,
                notes: notesCol ? notesCol.replace(/[*_`]/g, '').trim() : undefined,
              })
            }
          }
        }
      }
    }

    // Parse bullets for Hotels if not in tables
    if (/^\s*[-*]\s*\*[^*]+\*:\s*`?([\d\s]+)\s*₽/.test(trimmed)) {
      const match = trimmed.match(/^\s*[-*]\s*\*([^*]+)\*:\s*`?([\d\s]+)\s*₽/)
      if (match) {
        const title = match[1].trim()
        const amount = Number.parseInt(match[2].replace(/\s+/g, ''), 10)
        if (amount > 0) {
          transactions.push({
            id: crypto.randomUUID(),
            title: `Отель: ${title}`,
            amount,
            currency: 'RUB',
            categoryId: 'cat-housing',
          })
        }
      }
    }
    // Parse bullets for food/activities/souvenirs
    else if (/^\s*[-*]\s*\*\*([^*]+)\*\*:[^➔\n]+➔\s*`?~?([\d\s]+)\s*₽/.test(trimmed)) {
      const match = trimmed.match(/^\s*[-*]\s*\*\*([^*]+)\*\*:[^➔\n]+➔\s*`?~?([\d\s]+)\s*₽/)
      if (match) {
        const title = match[1].trim()
        const amount = Number.parseInt(match[2].replace(/\s+/g, ''), 10)
        if (amount > 0) {
          let cat = currentCategory
          if (/завтрак|обед|ужин|питани|стритфуд/i.test(title))
            cat = 'cat-food'
          else if (/билет|парк|тур|снорклинг|музе/i.test(title))
            cat = 'cat-entertainment'
          else if (/чай|пирожн|сувенир/i.test(title))
            cat = 'cat-shopping'

          transactions.push({
            id: crypto.randomUUID(),
            title,
            amount,
            currency: 'RUB',
            categoryId: cat,
          })
        }
      }
    }
  }

  // Fallback: If no granular transactions were parsed from tables, parse high-level summary from > [!summary]
  if (transactions.length === 0) {
    const summaryMatch = content.match(/>\s*-\s*([^\n:]+):\s*`?~?([\d\s]+)\s*₽`?/g)
    if (summaryMatch) {
      for (const item of summaryMatch) {
        const parsed = item.match(/>\s*-\s*([^\n:]+):\s*`?~?([\d\s]+)\s*₽/)
        if (parsed) {
          const title = parsed[1].replace(/[*_`]/g, '').trim()
          const amount = Number.parseInt(parsed[2].replace(/\s+/g, ''), 10)
          let cat = 'cat-other'
          if (/авиа/i.test(title))
            cat = 'cat-flights'
          else if (/проживан|отел/i.test(title))
            cat = 'cat-housing'
          else if (/транспорт|поезд|паром/i.test(title))
            cat = 'cat-transport'
          else if (/питани|еда/i.test(title))
            cat = 'cat-food'
          else if (/билет|активност/i.test(title))
            cat = 'cat-entertainment'
          else if (/сувенир|подарк/i.test(title))
            cat = 'cat-shopping'

          transactions.push({
            id: crypto.randomUUID(),
            title,
            amount,
            currency: 'RUB',
            categoryId: cat,
          })
        }
      }
    }
  }

  return {
    settings,
    categories: defaultCategories,
    transactions,
  }
}
