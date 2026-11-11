import { describe, expect, it } from 'bun:test'
import sharp from 'sharp'
import { extractAndStructureMetadata } from './image-metadata.service'
import { extractPhotoRating, normalizeStarRating } from './photo-rating'

async function photoWithXmp(property: string) {
  const jpeg = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).jpeg().toBuffer()
  const xml = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" ${property}/></rdf:RDF></x:xmpmeta>`
  const data = Buffer.from(`http://ns.adobe.com/xap/1.0/\0${xml}`)
  const header = Buffer.alloc(4)
  header.writeUInt16BE(0xFFE1)
  header.writeUInt16BE(data.length + 2, 2)
  return Buffer.concat([jpeg.subarray(0, 2), header, data, jpeg.subarray(2)])
}

describe('embedded photo ratings', () => {
  for (let rating = 1; rating <= 5; rating++) {
    it(`extracts ${rating} stars from actual JPEG XMP`, async () => {
      const result = await extractAndStructureMetadata(await photoWithXmp(`xmp:Rating="${rating}"`))
      expect(result.metadata.metadata?.rating).toBe(rating)
      expect(result.metadata.width).toBe(16)
    })
  }
  for (const value of ['0', '-1', '6', '3.5', 'broken', '']) {
    it(`does not assign stars for XMP value ${JSON.stringify(value)}`, async () => {
      const result = await extractAndStructureMetadata(await photoWithXmp(`xmp:Rating="${value}"`))
      expect(result.metadata.metadata?.rating).toBeUndefined()
    })
  }
  it('prefers XMP over TIFF, including explicit unrated and rejected', () => {
    for (const rating of [0, -1, 3]) {
      expect(extractPhotoRating({ xmp: { Rating: rating }, ifd0: { Rating: 5, RatingPercent: 99 } })).toBe(rating === 3 ? 3 : undefined)
    }
  })
  it('supports legacy TIFF stars and Windows percentages', () => {
    expect(extractPhotoRating({ ifd0: { Rating: '4' } })).toBe(4)
    for (const [percent, stars] of [[1, 1], [25, 2], [50, 3], [75, 4], [99, 5]])
      expect(extractPhotoRating({ ifd0: { RatingPercent: percent } })).toBe(stars)
  })
  it('extracts Windows RatingPercent from an actual EXIF APP1 segment', async () => {
    const jpeg = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).jpeg().toBuffer()
    const tiff = Buffer.alloc(26)
    tiff.write('II')
    tiff.writeUInt16LE(42, 2)
    tiff.writeUInt32LE(8, 4)
    tiff.writeUInt16LE(1, 8)
    tiff.writeUInt16LE(0x4749, 10)
    tiff.writeUInt16LE(3, 12)
    tiff.writeUInt32LE(1, 14)
    tiff.writeUInt16LE(75, 18)
    const data = Buffer.concat([Buffer.from('Exif\0\0'), tiff])
    const header = Buffer.alloc(4)
    header.writeUInt16BE(0xFFE1)
    header.writeUInt16BE(data.length + 2, 2)
    const result = await extractAndStructureMetadata(Buffer.concat([jpeg.subarray(0, 2), header, data, jpeg.subarray(2)]))
    expect(result.metadata.metadata?.rating).toBe(4)
  })
  it('rejects nonnumeric and malformed ratings', () => {
    for (const value of [null, undefined, true, [], {}, NaN, Infinity, '', ' ', -1, 0, 1.5, 6])
      expect(normalizeStarRating(value)).toBeUndefined()
  })
})
