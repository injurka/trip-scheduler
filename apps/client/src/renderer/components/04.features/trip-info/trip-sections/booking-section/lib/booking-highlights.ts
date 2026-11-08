export type HighlightStatus = 'active' | 'next' | 'closest' | null

interface TimeRange { start: number, end: number }

export function buildRangeHighlightMap<T>(
  items: T[],
  getId: (item: T) => string,
  getRange: (item: T) => TimeRange | null,
  now: number,
): Record<string, HighlightStatus> {
  const map: Record<string, HighlightStatus> = {}
  const ranges = items
    .map(item => ({ id: getId(item), range: getRange(item) }))
    .filter((entry): entry is { id: string, range: TimeRange } => entry.range !== null
      && Number.isFinite(entry.range.start) && Number.isFinite(entry.range.end)
      && entry.range.end >= entry.range.start)
    .sort((a, b) => a.range.start - b.range.start)

  for (const { id, range } of ranges) {
    if (range.start <= now && now < range.end)
      map[id] = 'active'
  }

  const next = ranges.find(({ range }) => range.start > now)

  if (next)
    map[next.id] = 'next'

  return map
}
