/** Usage: METRO_API_URL=... METRO_EMAIL=... METRO_PASSWORD=... bun tools/metro-import/import.ts --apply */
const data = await Bun.file(new URL('./data/taipei.json', import.meta.url)).json()
const stationIds = new Set(data.lines.flatMap((line: { stations: { id: string }[] }) => line.stations.map(station => station.id)))
console.log(`Тайбэй: ${data.lines.length} линий/направлений, ${stationIds.size} кодов станций`)
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
// Also works with older APIs: those versions import names/order and ignore coordinates.
await request('/metro/import', data, auth.token.accessToken)
const imported = await request(`/metro/systems/${data.id}`)
if (imported.lines.length !== data.lines.length || imported.lines.some((line: { id: string, stations: { id: string }[] }) => {
  const expected = data.lines.find((item: { id: string }) => item.id === line.id)
  return !expected || JSON.stringify(line.stations.map(s => s.id)) !== JSON.stringify(expected.stations.map((s: { id: string }) => s.id))
}))
  throw new Error('Проверка импортированных линий/порядка станций не прошла')
const hasCoordinates = imported.lines.every((line: { stations: { latitude?: number, longitude?: number }[] }) => line.stations.every(s => s.latitude != null && s.longitude != null))
console.log(`Импорт проверен: ${imported.city}; координаты ${hasCoordinates ? 'сохранены' : 'не поддерживаются этой версией API — повторите после обновления сервера'}`)
export {}
