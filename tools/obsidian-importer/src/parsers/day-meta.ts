import type { DayMetaInfo } from '../types'

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

  // 1. Parse header block quotes (> **Key:** Value)
  const headerSection = preText.split('---')[0]
  const headerQuoteRegex = /^>\s*\*\*([^*:]+):\*\*\s*(.*)$/gm
  let match: RegExpExecArray | null

  while ((match = headerQuoteRegex.exec(headerSection)) !== null) {
    const key = match[1].trim()
    const value = match[2].trim()

    if (!value)
      continue

    if (/локаци/i.test(key)) {
      const shortVal = value.replace(/\(.*?\)/g, '').replace(/`[^`]+`/g, '').replace(/\s+/g, ' ').trim()
      metaBadges.push({
        id: crypto.randomUUID(),
        title: 'Локация',
        subtitle: shortVal.length > 50 ? `${shortVal.slice(0, 47)}...` : shortVal,
        icon: 'mdi:map-marker-radius-outline',
        color: '#9BF6FF',
        content: `**Локация:** ${value}`,
      })
    }
    else if (/фаза/i.test(key)) {
      const phaseTitleMatch = value.match(/(?:🌴|💻|🏔️|🌊|🍵)?\s*(Фаза\s*\d[^—–\n(]*)/i)
      const subtitle = phaseTitleMatch ? phaseTitleMatch[0].trim() : (value.length > 40 ? `${value.slice(0, 37)}...` : value)
      metaBadges.push({
        id: crypto.randomUUID(),
        title: 'Фаза тура',
        subtitle,
        icon: 'mdi:compass-outline',
        color: '#BDB2FF',
        content: `**Фаза тура:** ${value}`,
      })
    }
    else if (/проживани/i.test(key)) {
      const hotelMatch = value.match(/\*([^*]+)\*(?:\s*`([^`]+)`)?/)
      let subtitle = ''
      if (hotelMatch) {
        subtitle = hotelMatch[1].trim() + (hotelMatch[2] ? ` (${hotelMatch[2].trim()})` : '')
      }
      else {
        subtitle = value.replace(/\(.*?\)/g, '').trim().slice(0, 40)
      }
      metaBadges.push({
        id: crypto.randomUUID(),
        title: 'Проживание',
        subtitle: subtitle.length > 45 ? `${subtitle.slice(0, 42)}...` : subtitle,
        icon: 'mdi:bed',
        color: '#FFD6A5',
        content: `**Проживание:** ${value}`,
      })
    }
    else if (/хайлайт|акцент|особенност/i.test(key)) {
      metaBadges.push({
        id: crypto.randomUUID(),
        title: key,
        subtitle: value.length > 45 ? `${value.slice(0, 42)}...` : value,
        icon: 'mdi:star-outline',
        color: '#FDFFB6',
        content: `**${key}:** ${value}`,
      })
    }
  }

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

    let title = rawTitleLine
    let subtitle = ''

    if (rawTitleLine.includes('—')) {
      const parts = rawTitleLine.split('—')
      title = parts[0].trim()
      subtitle = parts.slice(1).join('—').trim()
    }
    else if (rawTitleLine.includes('–')) {
      const parts = rawTitleLine.split('–')
      title = parts[0].trim()
      subtitle = parts.slice(1).join('–').trim()
    }
    else if (rawTitleLine.includes(': ')) {
      const parts = rawTitleLine.split(': ')
      title = parts[0].trim()
      subtitle = parts.slice(1).join(': ').trim()
    }

    if (!subtitle) {
      if (/youbike|велосипед/i.test(rawTitleLine))
        subtitle = 'YouBike 2.0'
      else if (/миграцион|twac|таможн/i.test(rawTitleLine))
        subtitle = 'Правила въезда и таможня'
      else if (/ветк|mrt|метро/i.test(rawTitleLine))
        subtitle = 'Навигация MRT'
      else if (/купален|онсэн|бэйтоу/i.test(rawTitleLine))
        subtitle = 'Правила купален'
      else if (/билеты|поезд|tra|emu3000|thsr/i.test(rawTitleLine))
        subtitle = 'Билеты и поезда'
      else if (/дождевик|зонт/i.test(rawTitleLine))
        subtitle = 'Экипировка в дождь'
    }

    if (subtitle.length > 50) {
      subtitle = `${subtitle.slice(0, 47)}...`
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

    const fullContent = `> [!${calloutType}] ${rawTitleLine}\n${cleanBodyLines ? cleanBodyLines.split('\n').map(l => `> ${l}`).join('\n') : ''}`

    metaBadges.push({
      id: crypto.randomUUID(),
      title: title || rawTitleLine,
      subtitle: subtitle || undefined,
      icon,
      color,
      content: fullContent,
    })
  }

  // Also check for pre-activity non-callout special sections (e.g. ### 🗺️ Пошаговые ориентиры...)
  const preSectionRegex = /###\s*(🗺️|📍|[^\n]*ориентир|[^\n]*навигац|[^\n]*останов)[^\n]*\n([\s\S]*?)(?=\n###|\n##|$)/gi
  let preSecMatch: RegExpExecArray | null
  while ((preSecMatch = preSectionRegex.exec(bodyPreText)) !== null) {
    const rawSectionHeader = preSecMatch[0].split('\n')[0].replace(/^###\s*/, '').trim()
    const sectionBody = preSecMatch[2].trim()

    if (sectionBody && !metaBadges.some(b => b.title.includes(rawSectionHeader))) {
      metaBadges.push({
        id: crypto.randomUUID(),
        title: rawSectionHeader,
        subtitle: 'Ориентиры и остановки',
        icon: 'mdi:map-marker-path',
        color: '#BDB2FF',
        content: `### ${rawSectionHeader}\n\n${sectionBody}`,
      })
    }
  }

  // 3. Parse Financial expenses block
  if (finText) {
    const finMatch = finText.match(/##\s*(?:💰\s*)?Финансовые затраты[^\n]*\n([\s\S]*?)(?=\n##|\n#|$)/i)
    if (finMatch) {
      const finBody = finMatch[1].trim()
      const totalMatch = finBody.match(/(?:\*\*Итого[^*]*\*\*|Итого[^:\n]*):?\s*(?:около\s*)?`?([~≈]?[\d\s]+(?:[–—\-][\d\s]*)?(?:₽|RUB|TWD|\$|EUR))`?/i)
      const totalSubtitle = totalMatch ? totalMatch[1].trim() : '~... ₽'

      metaBadges.push({
        id: crypto.randomUUID(),
        title: 'Финансовые затраты на день',
        subtitle: totalSubtitle,
        icon: 'mdi:currency-usd',
        color: '#A3D9A5',
        content: `## Финансовые затраты на день (на 1 чел)\n\n${finBody}`,
      })
    }
  }

  return metaBadges
}
