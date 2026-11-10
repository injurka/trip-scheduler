/** First point strictly after the requested time; input stays sorted and untouched. */
export function upperTimeIndex<T extends { tsUtc: number }>(points: T[], time: number): number {
  let low = 0
  let high = points.length

  while (low < high) {
    const middle = (low + high) >>> 1

    if (points[middle].tsUtc <= time)
      low = middle + 1
    else
      high = middle
  }

  return low
}

function overlapsTimeWindow(points: { tsUtc: number }[], start: number, end: number): boolean {
  return points.length > 0 && start <= end && points[0].tsUtc <= end && points[points.length - 1].tsUtc >= start
}

/** Clip one continuous GPS leg, interpolating only within its measured edges. */
export function clipTrackLeg<T extends { tsUtc: number, lat: number, lng: number }>(points: T[], start: number, end: number): T[] {
  if (!overlapsTimeWindow(points, start, end))
    return []

  const from = upperTimeIndex(points, start)
  const to = upperTimeIndex(points, end)
  const result = points.slice(from, to)
  const interpolate = (index: number, time: number): T | null => {
    const a = points[index - 1]
    const b = points[index]

    if (!a || !b || a.tsUtc >= time)
      return null

    const ratio = (time - a.tsUtc) / (b.tsUtc - a.tsUtc)

    return { ...a, tsUtc: time, lat: a.lat + (b.lat - a.lat) * ratio, lng: a.lng + (b.lng - a.lng) * ratio }
  }
  const first = points[from - 1]?.tsUtc === start ? points[from - 1] : interpolate(from, start)

  if (first)
    result.unshift(first)

  const last = interpolate(to, end)

  if (last && result.at(-1)?.tsUtc !== end)
    result.push(last)

  return result
}
