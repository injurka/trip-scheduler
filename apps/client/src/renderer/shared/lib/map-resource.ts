import { isRecord } from '@injurka/type-utils'

function absolute(url: string, base: string) {
  // URL serialisation escapes template braces; MapLibre substitutes them later.
  return new URL(url, base).toString().replaceAll('%7B', '{').replaceAll('%7D', '}')
}

/** Preserve the original HTTP base when a JSON resource is delivered through trip-cache://. */
export function normalizeMapResource(data: unknown, base: string): unknown {
  if (!isRecord(data))
    return data

  const normalized = { ...data }

  for (const key of ['url', 'glyphs', 'sprite']) {
    if (typeof normalized[key] === 'string')
      normalized[key] = absolute(normalized[key], base)
  }

  if (normalized.type === 'geojson' && typeof normalized.data === 'string')
    normalized.data = absolute(normalized.data, base)

  if (Array.isArray(normalized.sprite))
    normalized.sprite = normalized.sprite.map(sprite => normalizeMapResource(sprite, base))

  if (Array.isArray(normalized.tiles))
    normalized.tiles = normalized.tiles.map(url => typeof url === 'string' ? absolute(url, base) : url)

  if (isRecord(normalized.sources))
    normalized.sources = Object.fromEntries(Object.entries(normalized.sources).map(([id, source]) => [id, normalizeMapResource(source, base)]))

  return normalized
}
