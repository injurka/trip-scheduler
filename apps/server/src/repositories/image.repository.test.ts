import { describe, expect, it, mock } from 'bun:test'
import { TripMediaSchema } from '../modules/image/image.schemas'

let selectedColumns: Record<string, boolean> = {}
const image = {
  id: 'photo',
  url: 'trips/photo.jpg',
  originalName: 'photo.jpg',
  createdAt: new Date(),
  mediaType: 'image',
  sizeBytes: 100,
  variants: { small: 'trips/photo-small.webp', thumbhash: 'InMBBYCHh4iIiIh/eHh3e3h4j4cI' },
}
mock.module('../../db', () => ({
  db: { query: { tripImages: {
    findMany: async (query: { columns: Record<string, boolean> }) => {
      selectedColumns = query.columns
      return [Object.fromEntries(Object.entries(image).filter(([key]) => selectedColumns[key]))]
    },
  } } },
}))

const { imageRepository } = await import('./image.repository')

describe('route image API contract', () => {
  it('preserves variants and ThumbHash through the database projection and output schema', async () => {
    const [result] = await imageRepository.getByTripId('trip', 'route')
    const output = TripMediaSchema.parse(result)
    expect(selectedColumns.variants).toBe(true)
    expect(output.variants).toEqual(image.variants)
    expect(output.mediaType).toBe('image')
  })
})
