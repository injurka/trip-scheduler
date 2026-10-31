import { describe, expect, it } from 'bun:test'
import sharp from 'sharp'
import { extractAndStructureMetadata, generateImageVariants, generateThumbHash } from './image-metadata.service'

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

  it('rotates EXIF-oriented images and generates variants with proper visual dimensions', async () => {
    // 1000 wide x 600 high with orientation 6 (rotate 90 deg clockwise -> becomes 600 wide x 1000 high)
    const orientedImage = await sharp({
      create: {
        width: 1000,
        height: 600,
        channels: 3,
        background: { r: 200, g: 50, b: 50 },
      },
    }).withMetadata({ orientation: 6 }).jpeg().toBuffer()

    const variants = await generateImageVariants(orientedImage)
    expect(variants.small).toBeDefined()

    const smallMeta = await sharp(variants.small).metadata()
    // Small variant was resized to width 400. Because it was rotated, height should be > width (portrait).
    expect(smallMeta.width).toBe(400)
    expect(smallMeta.height).toBeGreaterThan(400)
  })

  it('handles invalid buffer gracefully returning null', async () => {
    const invalidBuffer = Buffer.from('not an image')
    const thumbhash = await generateThumbHash(invalidBuffer)
    expect(thumbhash).toBeNull()
  })
})
