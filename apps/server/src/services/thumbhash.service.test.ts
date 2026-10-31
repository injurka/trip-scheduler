import { describe, expect, it } from 'bun:test'
import sharp from 'sharp'
import { generateThumbHash } from './image-metadata.service'

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

  it('handles invalid buffer gracefully returning null', async () => {
    const invalidBuffer = Buffer.from('not an image')
    const thumbhash = await generateThumbHash(invalidBuffer)
    expect(thumbhash).toBeNull()
  })
})
