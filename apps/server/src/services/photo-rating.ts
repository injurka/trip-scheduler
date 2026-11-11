/** Accept only whole stars; zero and rejected photos have no app rating. */
export function normalizeStarRating(value: unknown): number | undefined {
  const rating = parseNumber(value)
  return rating !== undefined && Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : undefined
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim()))
    return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/** exifr output with mergeOutput:false preserves XMP precedence over legacy TIFF tags. */
export function extractPhotoRating(data: unknown): number | undefined {
  const blocks = record(data)
  const xmp = record(blocks.xmp)
  const tiff = record(blocks.ifd0)
  for (const value of [xmp.Rating, tiff.Rating]) {
    const rating = parseNumber(value)
    // An explicit unrated/rejected value must suppress stale fallback ratings.
    if (rating !== undefined && Number.isInteger(rating) && rating >= -1 && rating <= 5)
      return normalizeStarRating(rating)
  }
  const percent = parseNumber(tiff.RatingPercent)
  if (percent === undefined || !Number.isInteger(percent) || percent <= 0 || percent > 100)
    return undefined
  // Windows Photo Rating: canonical star values are 1, 25, 50, 75, 99.
  return percent <= 12 ? 1 : percent <= 37 ? 2 : percent <= 62 ? 3 : percent <= 87 ? 4 : 5
}
