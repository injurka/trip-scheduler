import { rgbaToThumbHash } from 'thumbhash'
import { describe, expect, it } from 'vitest'
import { getThumbHashAspectRatio, getThumbHashAverageColor, getThumbHashDataUrl } from '../src/lib/thumbhash'

function hashFor(width: number, height: number, alpha: number) {
  const pixels = new Uint8Array(width * height * 4)
  for (let i = 0; i < pixels.length; i += 4)
    pixels.set([120, 40, 200, alpha], i)
  return rgbaToThumbHash(width, height, pixels)
}

function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

describe('thumbHash decoding', () => {
  it.each([[100, 10], [10, 100], [40, 40]])('decodes opaque and transparent %i x %i images', (width, height) => {
    for (const alpha of [255, 100, 0]) {
      const bytes = hashFor(width, height, alpha)
      const hash = base64(bytes)
      expect(getThumbHashDataUrl(hash)).toMatch(/^data:image\/png;base64,/)
      expect(getThumbHashAverageColor(hash)).toMatch(/^rgba\(/)
      expect(getThumbHashAspectRatio(hash)).toBeGreaterThan(0)
    }
  })

  it('accepts valid hashes shorter than 21 bytes', () => {
    const bytes = hashFor(100, 10, 255)
    expect(bytes.length).toBeLessThan(21)
    expect(getThumbHashDataUrl(base64(bytes))).toBeTruthy()
  })

  it('rejects malformed base64, invalid headers and truncated coefficient payloads', () => {
    const bytes = hashFor(40, 40, 255)
    const invalidHeader = bytes.slice()
    invalidHeader[3] &= 0xF8
    for (const hash of ['', 'invalid!', base64(bytes.slice(0, -1)), base64(invalidHeader), base64(new Uint8Array(30))]) {
      expect(getThumbHashDataUrl(hash)).toBeNull()
      expect(getThumbHashAverageColor(hash)).toBeNull()
      expect(getThumbHashAspectRatio(hash)).toBeNull()
    }
  })
})
