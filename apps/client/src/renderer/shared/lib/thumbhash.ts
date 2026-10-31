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
    const bytes = base64ToUint8Array(trimmed)

    if (bytes.length < 21)
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
    const bytes = base64ToUint8Array(trimmed)

    if (bytes.length < 21)
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
    const bytes = base64ToUint8Array(thumbhash.trim())

    if (bytes.length < 21)
      return null

    return thumbHashToApproximateAspectRatio(bytes)
  }
  catch {
    return null
  }
}

export const getThumbHashApproximateAspectRatio = getThumbHashAspectRatio
