import type { ActivityPayload, ActivitySectionMetro, MetroRide } from '../types'

export interface MetroCatalogSystem {
  id: string
  city: string
  country?: string
}
export interface MetroCatalogStation {
  id: string
  name: string
}
export interface MetroCatalogLine {
  id: string
  name: string
  lineNumber: string | null
  color: string
  stations: MetroCatalogStation[]
}
export interface MetroCatalogDetails {
  id: string
  city: string
  lines: MetroCatalogLine[]
}
export interface MetroCatalogSource {
  listMetroSystems: () => Promise<MetroCatalogSystem[]>
  getMetroSystemDetails: (systemId: string) => Promise<MetroCatalogDetails>
}
export type MetroActivityResolver = (activity: ActivityPayload, cityContext?: string) => Promise<ActivityPayload>

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}
function codes(value: string): string[] {
  return [...value.toUpperCase().matchAll(/(?:^|[^A-Z\d])([A-Z]{1,3}\d{1,3}[A-Z]?)(?=$|[^A-Z\d])/g)].map(match => match[1])
}
function stationMatches(input: string, station: MetroCatalogStation): boolean {
  const inputCodes = codes(input)
  if (inputCodes.length)
    return inputCodes.length === 1 && codes(station.name).includes(inputCodes[0]!)
  const removeCodes = (text: string) => normalize(text.replace(/\b[A-Z]{1,3}\d{1,3}[A-Z]?\b/gi, ''))
  // Exact normalized names only; never fuzzy-match stations with similar names.
  const expected = removeCodes(input)
  return !!expected && station.name.split(/[·|]/).some(alias => removeCodes(alias) === expected)
}
function normalizeLine(name: string): string {
  return normalize(name).replace(/\bline\b|линия/gu, '').replace(/\s+/g, ' ').trim()
}
function matchRide(ride: MetroRide, system: MetroCatalogDetails): MetroRide | null {
  const lineCode = normalize(ride.lineNumber || '')
  const lines = system.lines.filter(line => lineCode
    ? normalize(line.lineNumber || '') === lineCode
    : normalizeLine(line.name) === normalizeLine(ride.lineName))
  const candidates = lines.flatMap((line) => {
    const starts = line.stations.flatMap((station, index) => stationMatches(ride.startStation, station) ? [index] : [])
    const ends = line.stations.flatMap((station, index) => stationMatches(ride.endStation, station) ? [index] : [])
    if (starts.length !== 1 || ends.length !== 1 || starts[0] === ends[0])
      return []
    const start = starts[0]!
    const end = ends[0]!
    const terminus = line.stations[end > start ? line.stations.length - 1 : 0]!
    const path = line.stations.slice(Math.min(start, end), Math.max(start, end) + 1).map(s => s.id).join('|')
    return [{ line, start, end, terminus, signature: `${path}|${terminus.id}` }]
  })
  if (!candidates.length)
    return null
  // A known terminus disambiguates shared track on branched lines.
  const directed = ride.direction ? candidates.filter(candidate => stationMatches(ride.direction, candidate.terminus)) : []
  const matches = directed.length ? directed : candidates
  if (new Set(matches.map(match => match.signature)).size !== 1)
    return null
  const { line, start, end, terminus } = matches[0]!
  return {
    ...ride,
    lineId: line.id,
    lineName: line.name,
    lineNumber: line.lineNumber,
    lineColor: line.color,
    startStationId: line.stations[start]!.id,
    startStation: line.stations[start]!.name,
    endStationId: line.stations[end]!.id,
    endStation: line.stations[end]!.name,
    stops: Math.abs(end - start),
    direction: `в сторону ст. «${terminus.name}»`,
  }
}

function cityMatches(city: string, context: string): boolean {
  const name = normalize(city)
  const aliases = ['тайбэй', 'тайбей', 'taipei', '台北', '臺北'].includes(name)
    ? ['тайбэй', 'тайбей', 'taipei', '台北', '臺北']
    : [name]
  const text = ` ${normalize(context)} `
  return aliases.some(alias => text.includes(` ${normalize(alias)} `))
}

/** One cache per import run; no network work until a free-form metro block is encountered. */
export function createMetroActivityResolver(source: Partial<MetroCatalogSource>, onWarning?: (message: string) => void): MetroActivityResolver {
  let systemsPromise: Promise<MetroCatalogSystem[]> | undefined
  const details = new Map<string, Promise<MetroCatalogDetails>>()
  let catalogFailureReported = false
  return async (activity, cityContext) => {
    if (!activity.sections?.some(section => section.type === 'metro' && section.mode !== 'city' && section.rides.length))
      return activity
    if (!source.listMetroSystems || !source.getMetroSystemDetails)
      return activity
    try {
      const systems = await (systemsPromise ??= source.listMetroSystems())
      const citySystems = cityContext ? systems.filter(system => cityMatches(system.city, cityContext)) : []
      // An explicit city context must match: do not apply another city's station codes.
      const candidates = cityContext ? citySystems : systems
      const catalogs = await Promise.all(candidates.map((system) => {
        if (!details.has(system.id))
          details.set(system.id, source.getMetroSystemDetails!(system.id))
        return details.get(system.id)!
      }))
      const sections = activity.sections.map((section) => {
        if (section.type !== 'metro' || section.mode === 'city' || !section.rides.length)
          return section
        const matches = catalogs.flatMap((catalog) => {
          const rides = section.rides.map(ride => matchRide(ride, catalog))
          return rides.every((ride): ride is MetroRide => ride !== null)
            ? [{ ...section, mode: 'city' as const, systemId: catalog.id, rides } satisfies ActivitySectionMetro]
            : []
        })
        if (matches.length === 1)
          return matches[0]!
        onWarning?.(`Метро «${activity.title}»: ручной ввод сохранён — ${matches.length > 1 ? 'город определяется неоднозначно' : candidates.length ? 'линия или станции не найдены однозначно' : 'город отсутствует в справочнике'}.`)
        return section
      })
      return { ...activity, sections }
    }
    catch {
      if (!catalogFailureReported) {
        onWarning?.('Справочник метро недоступен. Блоки метро сохранены с ручным вводом.')
        catalogFailureReported = true
      }
      return activity
    }
  }
}
