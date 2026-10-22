/** Usage: bun tools/metro-import/import.ts --city kaohsiung --apply */
interface Station {
  id: string
  name: string
  latitude?: number
  longitude?: number
}

interface Line {
  id: string
  name: string
  color: string
  lineNumber?: string | null
  isCircular?: boolean
  stations: Station[]
}

interface System {
  id: string
  city: string
  country: string
  lines: Line[]
}

interface SignInResponse {
  token?: {
    accessToken?: unknown
  }
}

const availableCities = ['taipei', 'kaohsiung', 'taichung'] as const
type City = typeof availableCities[number]
const availableCitySet: ReadonlySet<string> = new Set(availableCities)

function isCity(value: string | undefined): value is City {
  return value !== undefined && availableCitySet.has(value)
}

async function request<T>(baseUrl: string, path: string, body?: unknown, token?: string): Promise<T> {
  const hasBody = body !== undefined
  const response = await fetch(`${baseUrl}${path}`, {
    method: hasBody ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  })

  if (!response.ok)
    throw new Error(`${path}: HTTP ${response.status}`)

  return await response.json() as T
}

async function main(): Promise<void> {
  const cityIndex = Bun.argv.indexOf('--city')
  const requestedCity = cityIndex >= 0 ? Bun.argv[cityIndex + 1] : 'taipei'

  if (!isCity(requestedCity))
    throw new Error(`--city: ${availableCities.join(', ')}`)

  const selectedCities: readonly City[] = Bun.argv.includes('--all') ? availableCities : [requestedCity]
  const systems: System[] = await Promise.all(selectedCities.map(async (city) => {
    const file = Bun.file(new URL(`./data/${city}.json`, import.meta.url))
    return await file.json() as System
  }))

  for (const data of systems) {
    const stationIds = new Set(data.lines.flatMap(line => line.stations.map(station => station.id)))

    for (const line of data.lines) {
      if (new Set(line.stations.map(station => station.id)).size !== line.stations.length)
        throw new Error(`Повторяющиеся станции: ${line.id}`)

      for (const station of line.stations) {
        if ((station.latitude == null) !== (station.longitude == null))
          throw new Error(`Некорректные координаты: ${station.id}`)

        if (station.latitude != null && station.longitude != null) {
          if (!Number.isFinite(station.latitude) || Math.abs(station.latitude) > 90
            || !Number.isFinite(station.longitude) || Math.abs(station.longitude) > 180) {
            throw new Error(`Некорректные координаты: ${station.id}`)
          }
        }
      }
    }

    console.log(`${data.city}: ${data.lines.length} линий/направлений, ${stationIds.size} кодов станций`)
  }

  if (!Bun.argv.includes('--apply')) {
    console.log('Проверка завершена. Для загрузки: --apply и METRO_API_URL, METRO_EMAIL, METRO_PASSWORD.')
    return
  }

  const baseUrl = Bun.env.METRO_API_URL?.replace(/\/+$/, '')
  const email = Bun.env.METRO_EMAIL
  const password = Bun.env.METRO_PASSWORD

  if (!baseUrl || !email || !password)
    throw new Error('Задайте METRO_API_URL, METRO_EMAIL, METRO_PASSWORD')

  const auth = await request<SignInResponse>(baseUrl, '/auth/signin', { email, password })
  const accessToken = auth.token?.accessToken

  if (typeof accessToken !== 'string' || accessToken.length === 0)
    throw new Error('Сервер не вернул accessToken')

  for (const data of systems) {
    await request(baseUrl, '/metro/import', data, accessToken)

    const imported = await request<System>(baseUrl, `/metro/systems/${data.id}`)
    const linesMatch = imported.lines.length === data.lines.length
      && imported.lines.every((line) => {
        const expected = data.lines.find(item => item.id === line.id)

        return expected != null
          && line.name === expected.name
          && line.color === expected.color
          && line.lineNumber === expected.lineNumber
          && JSON.stringify(line.stations.map(station => station.id))
          === JSON.stringify(expected.stations.map(station => station.id))
      })

    if (!linesMatch)
      throw new Error('Проверка импортированных линий/порядка станций не прошла')

    const returnedStations = new Map(imported.lines.flatMap(line => line.stations.map(station => [station.id, station] as const)))
    const expectedCoordinates = [...new Map(data.lines.flatMap(line => line.stations.map(station => [station.id, station] as const))).values()]
      .filter(station => station.latitude != null)
    const savedCoordinates = expectedCoordinates.filter((station) => {
      const returned = returnedStations.get(station.id)
      return returned != null && returned.latitude === station.latitude && returned.longitude === station.longitude
    }).length

    console.log(`Импорт проверен: ${imported.city}; координаты ${savedCoordinates}/${expectedCoordinates.length} сохранены`)

    if (savedCoordinates < expectedCoordinates.length)
      console.warn('API не сохраняет координаты этой версии каталога — повторите импорт после обновления сервера.')

    for (const line of data.lines.filter(line => line.isCircular)) {
      if (!imported.lines.find(actual => actual.id === line.id)?.isCircular) {
        console.warn(`${line.name}: API не сохраняет признак кольцевой линии — требуется обновление сервера и повторный импорт.`)
      }
    }
  }
}

void main()
