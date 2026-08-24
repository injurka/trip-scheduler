import { describe, expect, it } from 'vitest'
import { useImageViewer } from '../src/composables/use-image-viewer'

describe('useImageViewer', () => {
  const testImages = [
    { url: 'https://example.com/1.jpg', alt: 'Image 1' },
    { url: 'https://example.com/2.jpg', alt: 'Image 2' },
    { url: 'https://example.com/3.jpg', alt: 'Image 3' },
  ]

  it('initializes with closed state and empty images', () => {
    const viewer = useImageViewer()
    expect(viewer.isOpen.value).toBe(false)
    expect(viewer.images.value).toEqual([])
    expect(viewer.currentIndex.value).toBe(0)
    expect(viewer.currentImage.value).toBeNull()
    expect(viewer.hasMultipleImages.value).toBe(false)
  })

  it('opens with given image list and startIndex', () => {
    const viewer = useImageViewer()
    viewer.open(testImages, 1)

    expect(viewer.isOpen.value).toBe(true)
    expect(viewer.images.value).toEqual(testImages)
    expect(viewer.currentIndex.value).toBe(1)
    expect(viewer.currentImage.value).toEqual(testImages[1])
    expect(viewer.hasMultipleImages.value).toBe(true)
  })

  it('closes viewer correctly', () => {
    const viewer = useImageViewer()
    viewer.open(testImages, 0)
    expect(viewer.isOpen.value).toBe(true)

    viewer.close()
    expect(viewer.isOpen.value).toBe(false)
  })

  it('navigates next and wraps around', () => {
    const viewer = useImageViewer()
    viewer.open(testImages, 1)

    viewer.next()
    expect(viewer.currentIndex.value).toBe(2)

    viewer.next()
    expect(viewer.currentIndex.value).toBe(0)
  })

  it('navigates prev and wraps around', () => {
    const viewer = useImageViewer()
    viewer.open(testImages, 0)

    viewer.prev()
    expect(viewer.currentIndex.value).toBe(2)

    viewer.prev()
    expect(viewer.currentIndex.value).toBe(1)
  })

  it('goes to specific valid index', () => {
    const viewer = useImageViewer()
    viewer.open(testImages, 0)

    viewer.goToIndex(2)
    expect(viewer.currentIndex.value).toBe(2)

    // invalid index should not change
    viewer.goToIndex(99)
    expect(viewer.currentIndex.value).toBe(2)

    viewer.goToIndex(-1)
    expect(viewer.currentIndex.value).toBe(2)
  })
})
