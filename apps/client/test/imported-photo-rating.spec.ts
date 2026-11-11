import { describe, expect, it, vi } from 'vitest'
import { refreshImportedPhotoRating } from '../src/renderer/components/04.features/trip-info/trip-memories/composables/refresh-imported-photo-rating'

describe('background photo rating refresh', () => {
  it('waits for metadata and applies the persisted rating', async () => {
    const applyRating = vi.fn()
    const loadMetadata = vi.fn().mockResolvedValueOnce(null).mockResolvedValue({ technical: { format: 'jpeg' } })
    await refreshImportedPhotoRating({
      isCurrent: () => true,
      loadMetadata,
      loadRating: async () => 4,
      applyRating,
      delay: async () => {},
    })
    expect(loadMetadata).toHaveBeenCalledTimes(2)
    expect(applyRating).toHaveBeenCalledWith(4)
  })
  it('does not overwrite an edit made while the request is running', async () => {
    let current = true
    const applyRating = vi.fn()
    await refreshImportedPhotoRating({
      isCurrent: () => current,
      loadMetadata: async () => ({ technical: { format: 'jpeg' } }),
      loadRating: async () => {
        current = false

        return 5
      },
      applyRating,
      delay: async () => {},
    })
    expect(applyRating).not.toHaveBeenCalled()
  })
  it('stops after a bounded number of attempts and tolerates network failures', async () => {
    const applyRating = vi.fn()
    const loadMetadata = vi.fn().mockResolvedValue(null)
    const options = {
      isCurrent: () => true,
      loadMetadata,
      loadRating: async () => 5,
      applyRating,
      delay: async () => {},
    }
    await refreshImportedPhotoRating(options)
    expect(loadMetadata).toHaveBeenCalledTimes(6)
    loadMetadata.mockRejectedValue(new Error('offline'))
    await expect(refreshImportedPhotoRating(options)).resolves.toBeUndefined()
    expect(applyRating).not.toHaveBeenCalled()
  })
})
