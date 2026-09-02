import type { DayMetaInfo } from '../types'

export function cleanEmoji(str: string): string {
  if (!str)
    return ''
  return str
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\uFE00-\uFE0F\u200D]/gu, '')
    .replace(/^[—–\-:\s]+/, '')
    .replace(/[—–\-:\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseDayMetaFromMarkdown(dayContent: string): DayMetaInfo[] {
  const metaBadges: DayMetaInfo[] = []
  const lines = dayContent.split('\n')

  // Find where activities begin
  const timeRegex = /^[*-]\s*\*\*(\d{1,2}:\d{2})\+?\s*(?:[-–—]\s*(\d{1,2}:\d{2}))?\+?\*\*\s*(?:[-–—:]\s*)?(.*)$/
  let actStartIndex = -1
  for (let i = 0; i < lines.length; i++) {
    if (timeRegex.test(lines[i])) {
      actStartIndex = i
      break
    }
  }

  // Find where financial section begins
  let finStartIndex = lines.length
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s*(?:💰\s*)?Финансовые затраты/i.test(lines[i])) {
      finStartIndex = i
      break
    }
  }

  const preLines = actStartIndex !== -1 ? lines.slice(0, actStartIndex) : lines.slice(0, finStartIndex)
  const preText = preLines.join('\n')
  const finText = lines.slice(finStartIndex).join('\n')

  // 1. Header block quotes (> **Фаза:**, > **Хайлайт:**, > **Проживание:**) are extracted
  // directly into day.description and bookings, so they are not duplicated as meta-chips.

  // 2. Parse Preparation Callouts & Subsections before activities
  const bodyPreText = preText.includes('---') ? preText.split('---').slice(1).join('---') : preText
  const calloutRegex = />\s*\[!([\w-]+)\]-?\s*([^\n]*)\n((?:[ \t]*>[^\n]*\n?)*)/g
  let calloutMatch: RegExpExecArray | null

  while ((calloutMatch = calloutRegex.exec(bodyPreText)) !== null) {
    const calloutType = calloutMatch[1].toUpperCase()
    const rawTitleLine = calloutMatch[2].trim()
    const rawBody = calloutMatch[3] || ''

    if (/^(?:Картинки|Изображения|Фото|Photos|Images)$/i.test(rawTitleLine))
      continue

    const cleanBodyLines = rawBody
      .split('\n')
      .map(l => l.replace(/^[ \t]*>[ \t]?/, ''))
      .join('\n')
      .trim()

    const cleanTitleLine = cleanEmoji(rawTitleLine)
    let title = cleanTitleLine
    let subtitle = ''

    if (cleanTitleLine.includes('—')) {
      const parts = cleanTitleLine.split('—')
      title = cleanEmoji(parts[0])
      subtitle = cleanEmoji(parts.slice(1).join('—'))
    }
    else if (cleanTitleLine.includes('–')) {
      const parts = cleanTitleLine.split('–')
      title = cleanEmoji(parts[0])
      subtitle = cleanEmoji(parts.slice(1).join('–'))
    }
    else if (cleanTitleLine.includes(': ')) {
      const parts = cleanTitleLine.split(': ')
      title = cleanEmoji(parts[0])
      subtitle = cleanEmoji(parts.slice(1).join(': '))
    }

    if (subtitle) {
      const normTitle = title.toLowerCase()
      const normSub = subtitle.toLowerCase()
      if (normTitle.includes(normSub) || normSub.includes(normTitle)) {
        subtitle = ''
      }
      else if (subtitle.length > 50) {
        subtitle = `${subtitle.slice(0, 47)}...`
      }
    }

    const combo = `${calloutType} ${rawTitleLine} ${cleanBodyLines}`.toLowerCase()

    let icon = 'mdi:information-outline'
    let color = '#9BF6FF'

    if (/лотере|выигра|lucky|5000\.taiwan|подарок|приз/.test(combo)) {
      icon = 'mdi:gift-outline'
      color = '#FFD6A5'
    }
    else if (/велосипед|youbike|bike|вело/.test(combo)) {
      icon = 'mdi:bike'
      color = '#FDFFB6'
    }
    else if (/миграцион|таможн|twac|мясн|запрет|вейп|штраф|депортац|паспорт|виз/.test(combo)) {
      icon = 'mdi:alert-octagon-outline'
      color = '#FFADAD'
    }
    else if (/метро|mrt|поезд|станци|ветк|линия|навигаци|пересадк|thsr|tra/.test(combo)) {
      icon = 'mdi:subway-variant'
      color = '#9BF6FF'
    }
    else if (/онсэн|терм|купальн|источник|дресс-код|шапочк/.test(combo)) {
      icon = 'mdi:hot-tub'
      color = '#FFD6A5'
    }
    else if (/дожд|дождевик|зонт|погод|ливень/.test(combo)) {
      icon = 'mdi:weather-rainy'
      color = '#A0C4FF'
    }
    else if (/черепах|коралл|экологи|дайвинг|снорклинг/.test(combo)) {
      icon = 'mdi:turtle'
      color = '#A3D9A5'
    }
    else if (/макак|обезьян|животн/.test(combo)) {
      icon = 'mdi:paw'
      color = '#FFD6A5'
    }
    else if (/укачиван|таблетк|аптечк|здоров|лекарств/.test(combo)) {
      icon = 'mdi:pill'
      color = '#FFC6FF'
    }
    else if (/чай|boba|bubble tea|кофе|ланч|ужин|блюд|ресторан|кухн/.test(combo)) {
      icon = 'mdi:food'
      color = '#A3D9A5'
    }
    else if (calloutType === 'IMPORTANT' || calloutType === 'WARNING' || calloutType === 'CAUTION') {
      icon = 'mdi:alert-circle-outline'
      color = '#FFADAD'
    }
    else if (calloutType === 'TIP') {
      icon = 'mdi:lightbulb-outline'
      color = '#FDFFB6'
    }

    const content = cleanBodyLines || cleanTitleLine

    metaBadges.push({
      id: crypto.randomUUID(),
      title: title || cleanTitleLine,
      subtitle: subtitle || undefined,
      icon,
      color,
      content,
    })
  }

  // Also check for pre-activity non-callout special sections (e.g. ### 🗺️ Пошаговые ориентиры...)
  const preSectionRegex = /###\s*(🗺️|📍|[^\n]*ориентир|[^\n]*останов)[^\n]*\n([\s\S]*?)(?=\n###|\n##|$)/gi
  let preSecMatch: RegExpExecArray | null
  while ((preSecMatch = preSectionRegex.exec(bodyPreText)) !== null) {
    const rawSectionHeader = preSecMatch[0].split('\n')[0].replace(/^###\s*/, '').trim()
    if (/подготовк/i.test(rawSectionHeader))
      continue

    // Remove any callouts that were already extracted as individual badges
    const sectionBody = preSecMatch[2]
      .replace(/>\s*\[![\w-]+\]-?[^\n]*\n(?:[ \t]*>[^\n]*\n?)*/g, '')
      .trim()

    const cleanSectionHeader = cleanEmoji(rawSectionHeader)
    if (sectionBody && !metaBadges.some(b => b.title.includes(cleanSectionHeader))) {
      metaBadges.push({
        id: crypto.randomUUID(),
        title: cleanSectionHeader,
        subtitle: undefined,
        icon: 'mdi:map-marker-path',
        color: '#BDB2FF',
        content: sectionBody,
      })
    }
  }

  // 3. Parse Financial expenses block
  if (finText) {
    const finMatch = finText.match(/##\s*(?:💰\s*)?Финансовые затраты[^\n]*\n([\s\S]*?)(?=\n##|\n#|$)/i)
    if (finMatch) {
      const finBody = finMatch[1].trim()
      const totalMatch = finBody.match(/(?:\*\*Итого[^*]*\*\*|Итого[^:\n]*):?\s*(?:около\s*)?`?([~≈]?[\d\s]+(?:[–—\-][\d\s]*)?(?:₽|RUB|TWD|\$|EUR))`?/i)
      const totalSubtitle = totalMatch ? totalMatch[1].trim() : undefined

      metaBadges.push({
        id: crypto.randomUUID(),
        title: 'Финансовые затраты на день',
        subtitle: totalSubtitle ? cleanEmoji(totalSubtitle) : undefined,
        icon: 'mdi:currency-usd',
        color: '#A3D9A5',
        content: finBody,
      })
    }
  }

  return metaBadges
}
