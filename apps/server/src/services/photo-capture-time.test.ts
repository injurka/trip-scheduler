import { expect, it } from 'bun:test'
import sharp from 'sharp'
import { extractAndStructureMetadata } from './image-metadata.service'

it('extracts actual JPEG EXIF capture time, offset and original size', async () => {
  const original = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } })
    .withExif({ IFD2: { DateTimeOriginal: '2026:11:16 15:12:00', OffsetTimeOriginal: '+08:00' } })
    .jpeg()
    .toBuffer()
  const { metadata } = await extractAndStructureMetadata(original)
  expect(metadata.takenAt?.toISOString()).toBe('2026-11-16T07:12:00.000Z')
  expect(metadata.metadata?.timezoneOffset).toBe(480)
  expect((metadata.metadata?.technical as { fileSize?: number })?.fileSize).toBe(original.length)
})

it('keeps photos without capture metadata undated instead of inventing upload time', async () => {
  const original = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).jpeg().toBuffer()
  const { metadata } = await extractAndStructureMetadata(original)
  expect(metadata.takenAt).toBeUndefined()
  expect(metadata.metadata?.timezoneOffset).toBeUndefined()
})
