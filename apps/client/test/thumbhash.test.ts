import { describe, expect, it } from 'bun:test'
import {
  base64ToUint8Array,
  getThumbHashAverageColor,
  getThumbHashDataUrl,
} from '../src/renderer/shared/lib/thumbhash'

describe('thumbhash client utilities', () => {
  // Валидный Base64 ThumbHash тестового изображения
  const sampleThumbhash = 'InMBBYCHh4iIiIh/eHh3e3h4j4cI'

  it('converts base64 to Uint8Array', () => {
    const bytes = base64ToUint8Array(sampleThumbhash)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('generates a valid Data URL from ThumbHash', () => {
    const dataUrl = getThumbHashDataUrl(sampleThumbhash)
    expect(dataUrl).toBeTruthy()
    expect(dataUrl?.startsWith('data:image/png;base64,')).toBe(true)

    // Проверяем работу in-memory кэша
    const cached = getThumbHashDataUrl(sampleThumbhash)
    expect(cached).toBe(dataUrl)
  })

  it('calculates average RGBA color string', () => {
    const color = getThumbHashAverageColor(sampleThumbhash)
    expect(color).toBeTruthy()
    expect(color?.startsWith('rgba(')).toBe(true)

    const cachedColor = getThumbHashAverageColor(sampleThumbhash)
    expect(cachedColor).toBe(color)
  })

  it('handles null and invalid inputs gracefully without throwing', () => {
    expect(getThumbHashDataUrl(null)).toBeNull()
    expect(getThumbHashDataUrl(undefined)).toBeNull()
    expect(getThumbHashDataUrl('')).toBeNull()
    expect(getThumbHashDataUrl('invalid-base64-!@#$%^')).toBeNull()

    expect(getThumbHashAverageColor(null)).toBeNull()
    expect(getThumbHashAverageColor('invalid')).toBeNull()
  })
})
