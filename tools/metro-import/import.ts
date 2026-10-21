/** Usage: bun tools/metro-import/import.ts --city kaohsiung --apply */
interface Station { id: string, name: string, latitude?: number, longitude?: number }
interface Line { id: string, name: string, color: string, lineNumber?: string | null, isCircular?: boolean, stations: Station[] }
interface System { id: string, city: string, country: string, lines: Line[] }
const available = ['taipei', 'kaohsiung', 'taichung']
const cityIndex = Bun.argv.indexOf('--city')
const city = cityIndex >= 0 ? Bun.argv[cityIndex + 1] : 'taipei'
if (!city || !available.includes(city))
  throw new Error(`--city: ${available.join(', ')}`)
const selected = Bun.argv.includes('--all') ? available : [city]
const systems: System[] = await Promise.all(selected.map(name => Bun.file(new URL(`./data/${name}.json`, import.meta.url)).json()))
for (const data of systems) {
  const stationIds = new Set(data.lines.flatMap(line => line.stations.map(station => station.id)))
  for (const line of data.lines) {
    if (new Set(line.stations.map(station => station.id)).size !== line.stations.length)
      throw new Error(`Повторяющиеся станции: ${line.id}`)
    for (const station of line.stations) {
      if ((station.latitude == null) !== (station.longitude == null) || (station.latitude != null && (!Number.isFinite(station.latitude) || Math.abs(station.latitude) > 90 || !Number.isFinite(station.longitude) || Math.abs(station.longitude!) > 180)))
        throw new Error(`Некорректные координаты: ${station.id}`)
    }
  }
  console.log(`${data.city}: ${data.lines.length} линий/направлений, ${stationIds.size} кодов станций`)
}
if (!Bun.argv.includes('--apply')) {
  console.log('Проверка завершена. Для загрузки: --apply и METRO_API_URL, METRO_EMAIL, METRO_PASSWORD.')
  process.exit(0)
}
const baseUrl = process.env.METRO_API_URL?.replace(/\/+$/, '')
const email = process.env.METRO_EMAIL
const password = process.env.METRO_PASSWORD
if (!baseUrl || !email || !password)
  throw new Error('Задайте METRO_API_URL, METRO_EMAIL, METRO_PASSWORD')
async function request(path: string, body?: unknown, token?: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok)
    throw new Error(`${path}: HTTP ${response.status}`)
  return response.json()
}
const auth = await request('/auth/signin', { email, password })
if (!auth.token?.accessToken)
  throw new Error('Сервер не вернул accessToken')
for (const data of systems) {
  await request('/metro/import', data, auth.token.accessToken)
  const imported: System = await request(`/metro/systems/${data.id}`)
  if (imported.lines.length !== data.lines.length || imported.lines.some((line) => {
    const expected = data.lines.find(item => item.id === line.id)
    return !expected || line.name !== expected.name || line.color !== expected.color || line.lineNumber !== expected.lineNumber || JSON.stringify(line.stations.map(s => s.id)) !== JSON.stringify(expected.stations.map(s => s.id))
  }))
    throw new Error('Проверка импортированных линий/порядка станций не прошла')
  const returnedStations = new Map(imported.lines.flatMap(line => line.stations.map(station => [station.id, station] as const)))
  const expectedCoordinates = [...new Map(data.lines.flatMap(line => line.stations.map(station => [station.id, station] as const))).values()].filter(station => station.latitude != null)
  const savedCoordinates = expectedCoordinates.filter(station => returnedStations.get(station.id)?.latitude === station.latitude && returnedStations.get(station.id)?.longitude === station.longitude).length
  console.log(`Импорт проверен: ${imported.city}; координаты ${savedCoordinates}/${expectedCoordinates.length} сохранены`)
  if (savedCoordinates < expectedCoordinates.length)
    console.warn('API не сохраняет координаты этой версии каталога — повторите импорт после обновления сервера.')
  for (const line of data.lines.filter(line => line.isCircular)) {
    if (!imported.lines.find(actual => actual.id === line.id)?.isCircular)
      console.warn(`${line.name}: API не сохраняет признак кольцевой линии — требуется обновление сервера и повторный импорт.`)
  }
}
export {}
