export type TransportMode = 'bus' | 'metro'

export interface TransportRoute {
  from: string
  to: string
  route: string
  code: string | null
  color: string
  operator: string | null
  direction: string
  stops: number
  walk: string | null
  links: string[]
}

export interface ParsedTransportBlock {
  type: TransportMode
  title: string
  routes: TransportRoute[]
  startLine: number
  endLine: number
}

function parseScalar(value: string): string {
  const raw = value.trim()
  if (!raw)
    return ''

  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith('\'') && raw.endsWith('\'')))
    return raw.slice(1, -1).replace(/\\([\\"'])/g, '$1')

  if (raw === 'null' || raw === '~')
    return ''

  return raw
}

function parsePair(line: string): { key: string, value: string } | null {
  const match = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/)
  if (!match)
    return null

  return {
    key: match[1].toLowerCase(),
    value: parseScalar(match[2]),
  }
}

function parseStops(value: string): number {
  const match = value.match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : 0
}

function parseColor(value: string, defaultColor = '#808080'): string {
  return /^#[\da-f]{3,8}$/i.test(value) ? value : defaultColor
}

function extractLinks(values: string[]): string[] {
  const links = values.flatMap(value => value.match(/https?:\/\/[^\s)>]+/g) || [])
  return [...new Set(links)]
}

export function parseTransportBlock(source: string, startLine = 1): ParsedTransportBlock | null {
  const metadata: Record<string, string> = {}
  const routeValues: Record<string, string>[] = []
  let inRoutes = false
  let currentRoute: Record<string, string> | null = null

  function commitRoute() {
    if (currentRoute)
      routeValues.push(currentRoute)
    currentRoute = null
  }

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#'))
      continue

    if (line === 'routes:') {
      inRoutes = true
      continue
    }

    if (inRoutes && line.startsWith('-')) {
      commitRoute()
      currentRoute = {}
      const pair = parsePair(line.slice(1).trim())
      if (pair)
        currentRoute[pair.key] = pair.value
      continue
    }

    const pair = parsePair(line)
    if (!pair)
      continue

    if (inRoutes && currentRoute)
      currentRoute[pair.key] = pair.value
    else
      metadata[pair.key] = pair.value
  }
  commitRoute()

  const type = metadata.type?.toLowerCase() as TransportMode | undefined
  if (type !== 'bus' && type !== 'metro')
    return null

  const routes = routeValues
    .map((route) => {
      const from = route.from || ''
      const to = route.to || ''
      const routeName = type === 'metro' ? route.line || '' : route.route || ''
      if (!from || !to || !routeName)
        return null

      return {
        from,
        to,
        route: routeName,
        code: route.code || null,
        color: parseColor(route.color || '', type === 'bus' ? '#F59E0B' : '#808080'),
        operator: route.operator || null,
        direction: route.direction || '',
        stops: parseStops(route.stops || ''),
        walk: route.walk || null,
        links: extractLinks(Object.values(route)),
      }
    })
    .filter((route): route is TransportRoute => route !== null)

  if (!routes.length)
    return null

  return {
    type,
    title: metadata.title || (type === 'metro' ? 'Метро' : 'Автобус'),
    routes,
    startLine,
    endLine: startLine + source.split(/\r?\n/).length + 1,
  }
}

export function extractTransportBlocks(markdown: string): { text: string, blocks: ParsedTransportBlock[] } {
  const lines = markdown.split('\n')
  const remaining: string[] = []
  const blocks: ParsedTransportBlock[] = []

  for (let index = 0; index < lines.length; index++) {
    if (!/^\s*```transport\s*$/i.test(lines[index])) {
      remaining.push(lines[index])
      continue
    }

    const body: string[] = []
    let endIndex = index + 1
    while (endIndex < lines.length && !/^\s*```\s*$/.test(lines[endIndex])) {
      body.push(lines[endIndex])
      endIndex++
    }

    if (endIndex >= lines.length) {
      remaining.push(...lines.slice(index))
      break
    }

    const block = parseTransportBlock(body.join('\n'), index + 1)
    if (!block) {
      remaining.push(...lines.slice(index, endIndex + 1))
      index = endIndex
      continue
    }

    blocks.push({
      ...block,
      startLine: index + 1,
      endLine: endIndex + 1,
    })
    index = endIndex
  }

  return {
    text: remaining.join('\n'),
    blocks,
  }
}

export function formatBusTransportBlock(block: ParsedTransportBlock): string {
  const rows = block.routes.map((route) => {
    const service = [route.route, route.code].filter(Boolean).join(' · ')
    const operator = route.operator ? `оператор: ${route.operator}` : ''
    const direction = route.direction ? `направление: ${route.direction}` : ''
    const stops = route.stops ? `${route.stops} остановок` : ''
    const walk = route.walk ? `пешком: ${route.walk}` : ''
    const details = [service, operator, direction, stops, walk].filter(Boolean).join('; ')
    return `- **${route.from} → ${route.to}**${details ? ` — ${details}` : ''}`
  })

  return [`**🚌 ${block.title}**`, ...rows].join('\n')
}
