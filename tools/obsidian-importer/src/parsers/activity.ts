import type { ActivityPayload } from '../types'

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

    const sectionText = currentActivity.lines.join('\n').trim()
    const cleanTitle = currentActivity.title
      .replace(/^[—–-]\s*/, '')
      .replace(/\s*[—–-]$/, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/:\s*$/, '')
      .trim() || 'Активность'

    const tag = inferActivityTag(cleanTitle, sectionText)

    activities.push({
      startTime: currentActivity.startTime,
      endTime: currentActivity.endTime,
      title: cleanTitle,
      tag,
      sections: sectionText
        ? [
            {
              id: crypto.randomUUID(),
              type: 'description',
              text: sectionText,
            },
          ]
        : [],
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
