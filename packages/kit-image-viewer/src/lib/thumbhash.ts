import {
  thumbHashToApproximateAspectRatio,
  thumbHashToAverageRGBA,
  thumbHashToDataURL,
} from 'thumbhash'

const dataUrlCache = new Map<string, string>()
const avgColorCache = new Map<string, string>()
const MAX_CACHE_SIZE = 500

/**
 * Преобразует строку base64 в Uint8Array в браузере
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  return bytes
}

// The decoder accepts truncated arrays silently. Validate the header and the
// coefficient payload before calling it; ThumbHash has a variable byte length.
function decodeThumbHash(value: string): Uint8Array | null {
  const bytes = base64ToUint8Array(value)
  if (bytes.length < 5)
    return null

  const hasAlpha = (bytes[2] & 0x80) !== 0
  const limit = hasAlpha ? 5 : 7
  const shortSide = bytes[3] & 7
  if (shortSide < 1 || shortSide > limit)
    return null

  const isLandscape = (bytes[4] & 0x80) !== 0
  const lx = Math.max(3, isLandscape ? limit : shortSide)
  const ly = Math.max(3, isLandscape ? shortSide : limit)
  let coefficients = 0
  for (let cy = 0; cy < ly; cy++) {
    for (let cx = cy ? 0 : 1; cx * ly < lx * (ly - cy); cx++)
      coefficients++
  }
  // Chroma channels each have five AC coefficients; alpha has fourteen.
  coefficients += 10 + (hasAlpha ? 14 : 0)
  const expectedLength = (hasAlpha ? 6 : 5) + Math.ceil(coefficients / 2)

  return bytes.length === expectedLength ? bytes : null
}

/**
 * Генерирует Data URL (PNG) из Base64-строки ThumbHash с кэшированием в памяти
 */
export function getThumbHashDataUrl(thumbhash?: string | null): string | null {
  if (!thumbhash || typeof thumbhash !== 'string' || thumbhash.trim().length === 0)
    return null

  const trimmed = thumbhash.trim()
  const cached = dataUrlCache.get(trimmed)

  if (cached)
    return cached

  try {
    const bytes = decodeThumbHash(trimmed)

    if (!bytes)
      return null

    const dataUrl = thumbHashToDataURL(bytes)

    if (dataUrlCache.size >= MAX_CACHE_SIZE) {
      const firstKey = dataUrlCache.keys().next().value

      if (firstKey)
        dataUrlCache.delete(firstKey)
    }

    dataUrlCache.set(trimmed, dataUrl)

    return dataUrl
  }
  catch {
    return null
  }
}

/**
 * Вычисляет средний цвет (RGBA) из Base64-строки ThumbHash
 */
export function getThumbHashAverageColor(thumbhash?: string | null): string | null {
  if (!thumbhash || typeof thumbhash !== 'string' || thumbhash.trim().length === 0)
    return null

  const trimmed = thumbhash.trim()
  const cached = avgColorCache.get(trimmed)

  if (cached)
    return cached

  try {
    const bytes = decodeThumbHash(trimmed)

    if (!bytes)
      return null

    const { r, g, b, a } = thumbHashToAverageRGBA(bytes)
    const color = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a.toFixed(2)})`

    if (avgColorCache.size >= MAX_CACHE_SIZE) {
      const firstKey = avgColorCache.keys().next().value

      if (firstKey)
        avgColorCache.delete(firstKey)
    }

    avgColorCache.set(trimmed, color)

    return color
  }
  catch {
    return null
  }
}

/**
 * Вычисляет примерное соотношение сторон (width / height) из ThumbHash
 */
export function getThumbHashAspectRatio(thumbhash?: string | null): number | null {
  if (!thumbhash || typeof thumbhash !== 'string' || thumbhash.trim().length === 0)
    return null

  try {
    const bytes = decodeThumbHash(thumbhash.trim())

    if (!bytes)
      return null

    return thumbHashToApproximateAspectRatio(bytes)
  }
  catch {
    return null
  }
}

export const getThumbHashApproximateAspectRatio = getThumbHashAspectRatio
