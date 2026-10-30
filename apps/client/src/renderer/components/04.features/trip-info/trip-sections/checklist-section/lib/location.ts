export function isChecklistMapUrl(value?: string): boolean {
  if (!value)
    return false

  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()

    return host === 'maps.app.goo.gl'
      || host === 'maps.google.com'
      || (/^(?:www\.)?google\.[a-z.]+$/.test(host) && url.pathname.startsWith('/maps'))
      || (/^(?:www\.)?openstreetmap\.org$/.test(host))
      || (/^(?:www\.)?yandex\.[a-z.]+$/.test(host) && url.pathname.startsWith('/maps'))
  }
  catch {
    return false
  }
}

export function checklistDescription(text?: string): string | undefined {
  if (!text)
    return text

  return text.split('\n').map((line) => {
    if (/^\*{1,2}Локация:\*{1,2}/i.test(line.trim())) {
      const metadata = line.match(/\[[^\]]+\]\(https?:\/\/[^)]+\)(.*)$/)

      return metadata?.[1].replace(/^[\s.;—–-]+/, '').trim() || ''
    }

    return line.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (link, name, url) => isChecklistMapUrl(url) ? name : link)
  }).filter(Boolean).join('\n').trim()
}

export function checklistMapCoords(value?: string): { lat: number, lon: number } | undefined {
  if (!value || !isChecklistMapUrl(value))
    return undefined

  try {
    const url = new URL(value)
    const pair = url.searchParams.get('q') || url.searchParams.get('query')
    const match = pair?.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/)
      || decodeURIComponent(value).match(/!3d(-?[\d.]+)!4d(-?[\d.]+)/)

    if (!match)
      return undefined

    const lat = Number(match[1])
    const lon = Number(match[2])

    return validCoords(lat, lon) ? { lat, lon } : undefined
  }
  catch {
    return undefined
  }
}

function validCoords(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
}
