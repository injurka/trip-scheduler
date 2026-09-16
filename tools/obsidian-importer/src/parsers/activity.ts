import type { ActivityPayload, ActivitySectionMetro, MetroRide } from '../types'
import { stableId } from '../lib/stable-id'

export function inferActivityTag(title: string, content: string): ActivityPayload['tag'] {
  const text = `${title} ${content}`.toLowerCase()

  if (/перелет|аэропорт|авиа|вылет|прилет|klia|рейс|поезд|метро|mrt|thsr|tra|трансфер|экспресс|такси|grab|uber|автобус|паром|шаттл|канатная дорога|gondola|поездка|дорог/.test(text)) {
    return 'transport'
  }
  if (/завтрак|обед|ужин|стритфуд|еда|кулинар|лапша|рис|наси лемак|дамплинг|сяолонгбао|кофе|чай|дегустация|ресторан|кафе|бистро|рынок|на ночном рынке|ночной рынок|бар|коктейль|пиво|мороженое/.test(text)) {
    return 'food'
  }
  if (/прогулка|хайкинг|пешком|подъем|треккинг|набережная|аллея|переход|тропа|велопрогулка|велосипед/.test(text)) {
    return 'walk'
  }
  if (/храм|пещеры|башни|небоскреб|мемориал|площадь|музей|дворец|смотровая|парк|заповедник|водопад|ущелье|пагода|достопримечательность|форт|панора/i.test(text)) {
    return 'attraction'
  }
  if (/отель|заселение|бассейн|пляж|отдых|душ|переодевание|акклиматизация|релакс|купание|источники|спа/.test(text)) {
    return 'relax'
  }

  return 'activity'
}

export function normalizeIframeLineBreaks(markdown: string): string {
  if (!markdown)
    return ''

  return markdown.replace(/^([ \t]*)(?:([*+-]\s+))?(.*?)(\s*<iframe\b[^>]*>.*?<\/iframe>)/gmi, (match, baseIndent, listBullet, linePrefix, iframe) => {
    const trimmedPrefix = linePrefix ? linePrefix.trim() : ''
    const trimmedIframe = iframe ? iframe.trim() : ''
    if (!trimmedPrefix) {
      return `${baseIndent || ''}${listBullet || ''}${trimmedIframe}`
    }
    if (listBullet) {
      const continuationIndent = `${baseIndent || ''}    `
      return `${baseIndent || ''}${listBullet}${trimmedPrefix}\n${continuationIndent}${trimmedIframe}`
    }
    return `${baseIndent || ''}${trimmedPrefix}\n\n${trimmedIframe}`
  })
}

export function normalizeMarkdownIndentation(text: string): string {
  if (!text)
    return ''

  const formattedText = normalizeIframeLineBreaks(text)
  const lines = formattedText.split('\n')
  const resultLines: string[] = []
  let currentBlock: string[] = []

  function flushBlock() {
    if (currentBlock.length === 0)
      return

    const nonEmpty = currentBlock.filter(l => l.trim().length > 0)
    if (nonEmpty.length > 0) {
      let minIndent = Number.POSITIVE_INFINITY
      for (const line of nonEmpty) {
        const m = line.match(/^[ \t]*/)
        const len = m ? m[0].length : 0
        if (len < minIndent)
          minIndent = len
      }
      if (minIndent > 0 && minIndent !== Number.POSITIVE_INFINITY) {
        for (const line of currentBlock) {
          resultLines.push(line.length >= minIndent ? line.slice(minIndent) : line.trimStart())
        }
        currentBlock = []
        return
      }
    }

    for (const line of currentBlock) {
      resultLines.push(line)
    }
    currentBlock = []
  }

  for (const line of lines) {
    if (line.trim().startsWith('>')) {
      flushBlock()
      resultLines.push(line.trim())
    }
    else if (line.trim() === '') {
      flushBlock()
      resultLines.push('')
    }
    else {
      currentBlock.push(line)
    }
  }
  flushBlock()

  return resultLines.join('\n').trim()
}

export function dedentText(text: string): string {
  return normalizeMarkdownIndentation(text)
}

const METRO_CALLOUT_HEADER = /^>\s*\[!(?:METRO|INFO)\]-?\s*(?:🚇\s*)?(?:метро|metro|mrt|subway)(?:\s|$|[·:–—-])/i
const ANY_CALLOUT_HEADER = /^>\s*\[![\w-]+\]/

type MetroColumn = 'startStation' | 'endStation' | 'lineName' | 'lineNumber' | 'lineColor' | 'direction' | 'stops'

const METRO_COLUMN_ALIASES: Record<MetroColumn, string[]> = {
  startStation: ['откуда', 'отправление', 'начальная станция', 'start', 'from'],
  endStation: ['куда', 'прибытие', 'конечная станция', 'end', 'to'],
  lineName: ['линия', 'название линии', 'line', 'line name'],
  lineNumber: ['код', 'номер', '№', 'line code', 'line number'],
  lineColor: ['цвет', 'цвет линии', 'color', 'line color'],
  direction: ['направление', 'direction', 'в сторону'],
  stops: ['остановки', 'остановок', 'станции', 'станций', 'stops', 'stop count'],
}

function normalizeMetroCell(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

function normalizeMetroHeader(value: string): string {
  return normalizeMetroCell(value)
    .toLocaleLowerCase('ru-RU')
    .replace(/[.:]/g, '')
    .replace(/\s+/g, ' ')
}

function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|'))
    return []

  return trimmed
    .slice(1, -1)
    .split('|')
    .map(cell => normalizeMetroCell(cell))
}

function findMetroColumn(headers: string[], column: MetroColumn): number {
  const aliases = METRO_COLUMN_ALIASES[column]
  return headers.findIndex(header => aliases.includes(normalizeMetroHeader(header)))
}

function parseMetroColor(value: string): string {
  const normalized = normalizeMetroCell(value)
  if (/^#[\da-f]{3,8}$/i.test(normalized))
    return normalized
  return '#808080'
}

function parseMetroStops(value: string): number {
  const match = normalizeMetroCell(value).match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : 0
}

function parseMetroRides(tableText: string, activityKey: string): MetroRide[] {
  const rows = tableText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('|') && line.endsWith('|'))

  if (rows.length < 3)
    return []

  const headers = splitMarkdownTableRow(rows[0])
  const divider = splitMarkdownTableRow(rows[1])
  if (headers.length === 0 || divider.length === 0 || !divider.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s/g, ''))))
    return []

  const columnIndexes = Object.fromEntries(
    (Object.keys(METRO_COLUMN_ALIASES) as MetroColumn[]).map(column => [column, findMetroColumn(headers, column)]),
  ) as Record<MetroColumn, number>

  if (columnIndexes.startStation === -1 || columnIndexes.endStation === -1)
    return []

  const rides: MetroRide[] = []
  for (const [index, row] of rows.slice(2).entries()) {
    const cells = splitMarkdownTableRow(row)
    const startStation = cells[columnIndexes.startStation] || ''
    const endStation = cells[columnIndexes.endStation] || ''
    if (!startStation || !endStation || startStation === '—' || endStation === '—')
      continue

    const lineName = columnIndexes.lineName >= 0 ? cells[columnIndexes.lineName] || '' : ''
    const lineNumber = columnIndexes.lineNumber >= 0 ? cells[columnIndexes.lineNumber] || null : null
    const direction = columnIndexes.direction >= 0 ? cells[columnIndexes.direction] || '' : ''
    const lineColor = columnIndexes.lineColor >= 0 ? parseMetroColor(cells[columnIndexes.lineColor] || '') : '#808080'
    const stops = columnIndexes.stops >= 0 ? parseMetroStops(cells[columnIndexes.stops] || '') : 0

    rides.push({
      id: stableId('metro-ride', activityKey, index, startStation, endStation, lineName),
      startStation,
      endStation,
      lineName,
      lineNumber,
      lineColor,
      direction,
      stops,
      startStationId: null,
      endStationId: null,
      lineId: null,
    })
  }

  return rides
}

function stripCalloutPrefix(line: string): string {
  return line.replace(/^>\s?/, '')
}

function extractMetroSection(markdown: string, activityKey: string): { text: string, section?: ActivitySectionMetro } {
  const lines = markdown.split('\n')
  const remaining: string[] = []
  const metroTableLines: string[] = []
  let foundMetroCallout = false

  for (let index = 0; index < lines.length; index++) {
    if (!METRO_CALLOUT_HEADER.test(lines[index])) {
      remaining.push(lines[index])
      continue
    }

    foundMetroCallout = true
    index++
    while (index < lines.length && lines[index].trim().startsWith('>')) {
      if (ANY_CALLOUT_HEADER.test(lines[index]))
        break
      metroTableLines.push(stripCalloutPrefix(lines[index]))
      index++
    }
    index--
  }

  if (!foundMetroCallout)
    return { text: markdown }

  const rides = parseMetroRides(metroTableLines.join('\n'), activityKey)
  if (rides.length === 0)
    return { text: markdown }

  return {
    text: remaining.join('\n'),
    section: {
      id: stableId('activity-section', activityKey, 'metro', 0),
      type: 'metro',
      mode: 'free',
      systemId: null,
      rides,
    },
  }
}

export function parseActivitiesFromMarkdown(dayContent: string): ActivityPayload[] {
  const activities: ActivityPayload[] = []
  const lines = dayContent.split('\n')

  const timeRegex = /^[*-]\s*\*\*(\d{1,2}:\d{2})\+?\s*(?:[-–—]\s*(\d{1,2}:\d{2}))?\+?\*\*\s*(?:[-–—:]\s*)?(.*)$/

  let currentActivity: {
    startTime: string
    endTime: string
    title: string
    lines: string[]
  } | null = null

  function finishCurrentActivity() {
    if (!currentActivity)
      return

    const normalizedActivityText = normalizeMarkdownIndentation(currentActivity.lines.join('\n'))
    const metro = extractMetroSection(normalizedActivityText, currentActivity.startTime)
    const sectionText = normalizeMarkdownIndentation(metro.text)
    const cleanTitle = currentActivity.title
      .replace(/^[—–-]\s*/, '')
      .replace(/\s*[—–-]$/, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/:\s*$/, '')
      .trim() || 'Активность'

    const tag = inferActivityTag(cleanTitle, sectionText)

    const sections: ActivityPayload['sections'] = []
    if (sectionText) {
      sections.push({
        id: stableId('activity-section', currentActivity.startTime, 'description', 0),
        type: 'description',
        text: sectionText,
      })
    }
    if (metro.section)
      sections.push(metro.section)

    activities.push({
      startTime: currentActivity.startTime,
      endTime: currentActivity.endTime,
      title: cleanTitle,
      tag,
      sections,
    })

    currentActivity = null
  }

  // Find where financial section starts so we don't parse beyond it
  let finIndex = lines.length
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s*(?:💰\s*)?Финансовые затраты/i.test(lines[i])) {
      finIndex = i
      break
    }
  }

  for (let i = 0; i < finIndex; i++) {
    const line = lines[i]
    const match = line.match(timeRegex)

    if (match) {
      finishCurrentActivity()

      const startTime = match[1].padStart(5, '0')
      let endTime = match[2] ? match[2].padStart(5, '0') : ''

      if (!endTime) {
        const [h, m] = startTime.split(':').map(Number)
        const nextHour = (h + 1) % 24
        endTime = `${String(nextHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }

      const title = match[3]?.trim() || ''

      currentActivity = {
        startTime,
        endTime,
        title,
        lines: [],
      }
    }
    else if (currentActivity) {
      if (line.startsWith('## ') || line.startsWith('# ')) {
        finishCurrentActivity()
      }
      else if (line.trim() === '---') {
        finishCurrentActivity()
      }
      else if (line.startsWith('### ') && !line.includes('Важная подготовка')) {
        finishCurrentActivity()
      }
      else {
        currentActivity.lines.push(line)
      }
    }
  }

  finishCurrentActivity()

  // Fallback: If no time-based activities found, check for ### Part sections
  if (activities.length === 0) {
    let partIndex = 0
    for (let i = 0; i < finIndex; i++) {
      const line = lines[i]
      if (line.startsWith('### ') && !line.includes('Важная подготовка')) {
        const title = line.replace(/^###\s*/, '').replace(/^[^\wА-Яа-яёЁ]+/, '').trim()
        const startH = 9 + partIndex * 3
        const endH = startH + 2
        const startTime = `${String(startH).padStart(2, '0')}:00`
        const endTime = `${String(endH).padStart(2, '0')}:00`
        partIndex++

        activities.push({
          startTime,
          endTime,
          title: title || `Часть ${partIndex}`,
          tag: inferActivityTag(title, ''),
          sections: [],
        })
      }
    }
  }

  return activities
}
