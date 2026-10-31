import { describe, expect, it } from 'bun:test'
import sharp from 'sharp'
import { extractAndStructureMetadata, generateThumbHash } from './image-metadata.service'

describe('server thumbhash generation', () => {
  it('generates a valid base64 thumbhash from an image buffer', async () => {
    const testImage = await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: { r: 255, g: 80, b: 40 },
      },
    }).jpeg().toBuffer()

    const thumbhash = await generateThumbHash(testImage)
    expect(thumbhash).toBeTruthy()
    expect(typeof thumbhash).toBe('string')
    expect(thumbhash!.length).toBeGreaterThan(20)
  })

  it('extracts dimensions and thumbhash even for PNG images without EXIF metadata', async () => {
    const pngWithoutExif = await sharp({
      create: {
        width: 160,
        height: 120,
        channels: 4,
        background: { r: 40, g: 120, b: 220, alpha: 1 },
      },
    }).png().toBuffer()

    const result = await extractAndStructureMetadata(pngWithoutExif)
    expect(result.metadata.width).toBe(160)
    expect(result.metadata.height).toBe(120)
    expect(result.metadata.metadata?.thumbhash).toBeTruthy()
  })

  it('handles invalid buffer gracefully returning null', async () => {
    const invalidBuffer = Buffer.from('not an image')
    const thumbhash = await generateThumbHash(invalidBuffer)
    expect(thumbhash).toBeNull()
  })
})
