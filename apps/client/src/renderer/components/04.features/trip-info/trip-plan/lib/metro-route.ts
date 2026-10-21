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
  const stations = line.stations.slice(Math.min(start, end), Math.max(start, end) + 1)
  if (end < start)
    stations.reverse()
  return {
    stations,
    stops: Math.abs(end - start),
    direction: `в сторону ст. «${line.stations[end > start ? line.stations.length - 1 : 0].name}»`,
  }
}

export function getMetroGeometry(stations: MetroStation[]): [number, number][] | null {
  // Never join across a missing station coordinate.
  if (stations.length < 2 || stations.some(s => s.latitude == null || s.longitude == null))
    return null
  return stations.map(s => [s.longitude!, s.latitude!])
}
