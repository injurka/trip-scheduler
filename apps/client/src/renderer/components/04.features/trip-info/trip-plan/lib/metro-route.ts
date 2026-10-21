export interface MetroStation {
  id: string
  name: string
  latitude?: number | null
  longitude?: number | null
}

export interface MetroLine {
  id: string
  name: string
  lineNumber: string | null
  color: string
  isCircular?: boolean
  stations: MetroStation[]
}

export interface MetroSystemDetails {
  id: string
  city: string
  lines: MetroLine[]
}

export function getMetroRidePath(line: MetroLine | undefined, startId: string | null, endId: string | null) {
  if (!line || !startId || !endId)
    return null
  const start = line.stations.findIndex(s => s.id === startId)
  const end = line.stations.findIndex(s => s.id === endId)
  if (start < 0 || end < 0 || start === end)
    return null
  let stations = line.stations.slice(Math.min(start, end), Math.max(start, end) + 1)
  if (end < start)
    stations.reverse()
  if (line.isCircular) {
    const forward = (end - start + line.stations.length) % line.stations.length
    const backward = line.stations.length - forward
    const step = forward <= backward ? 1 : -1
    stations = Array.from({ length: Math.min(forward, backward) + 1 }, (_, index) => line.stations[(start + step * index + line.stations.length) % line.stations.length]!)
  }
  return {
    stations,
    stops: stations.length - 1,
    direction: line.isCircular
      ? `по кольцу через ст. «${stations[1]!.name}»`
      : `в сторону ст. «${line.stations[end > start ? line.stations.length - 1 : 0].name}»`,
  }
}

export function getMetroGeometry(stations: MetroStation[]): [number, number][] | null {
  // Never join across a missing station coordinate.
  if (stations.length < 2 || stations.some(s => s.latitude == null || s.longitude == null))
    return null
  return stations.map(s => [s.longitude!, s.latitude!])
}
