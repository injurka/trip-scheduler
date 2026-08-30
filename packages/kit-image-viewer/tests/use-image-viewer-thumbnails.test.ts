import type { ImageViewerImage } from '../src/models/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { isVideoImage, resolveThumbnailUrl, useImageViewerThumbnails } from '../src/composables/use-image-viewer-thumbnails'
import KitImageViewer from '../src/ui/kit-image-viewer.vue'

describe('useImageViewerThumbnails - Virtualization logic', () => {
  function generateImages(count: number): ImageViewerImage[] {
    return Array.from({ length: count }, (_, i) => ({
      url: `https://example.com/img-${i}.jpg`,
      alt: `Image ${i}`,
      variants: {
        small: `https://example.com/img-${i}-small.jpg`,
        large: `https://example.com/img-${i}-large.jpg`,
      },
    }))
  }

  it('calculates total width and item pitch correctly for desktop', () => {
    const images = ref(generateImages(100))
    const currentIndex = ref(0)
    const thumbnails = useImageViewerThumbnails({
      images,
      currentIndex,
      gap: 10,
    })

    // On desktop: itemSize = 56, gap = 10 -> itemPitch = 66
    expect(thumbnails.thumbnailSize.value).toBe(56)
    expect(thumbnails.itemPitch.value).toBe(66)
    // 100 * 66 - 10 = 6590
    expect(thumbnails.totalWidth.value).toBe(6590)
  })

  it('virtualizes large collections to render only a subset with overscan', () => {
    const images = ref(generateImages(500))
    const currentIndex = ref(50)
    const thumbnailsRef = ref<HTMLElement | null>(null)

    const thumbnails = useImageViewerThumbnails({
      images,
      currentIndex,
      thumbnailsRef,
      overscan: 5,
      gap: 10,
    })

    // Simulated container width of 1000px
    thumbnails.containerWidth.value = 1000
    // Scroll to item 50: 50 * 66 = 3300px
    thumbnails.scrollLeft.value = 3300

    expect(thumbnails.visibleThumbnails.value.length).toBeLessThan(500)
    expect(thumbnails.visibleThumbnails.value.length).toBeGreaterThan(0)
    expect(thumbnails.visibleThumbnails.value.length).toBeLessThanOrEqual(35)

    // Check that item 50 is included in the visible items
    const hasItem50 = thumbnails.visibleThumbnails.value.some(item => item.index === 50)
    expect(hasItem50).toBe(true)

    // Check that item 0 (far away) is NOT included
    const hasItem0 = thumbnails.visibleThumbnails.value.some(item => item.index === 0)
    expect(hasItem0).toBe(false)
  })

  it('scrollThumbnailIntoView scrolls to the exact calculated offset', async () => {
    const images = ref(generateImages(50))
    const currentIndex = ref(0)
    const mockEl = document.createElement('div')
    const scrollToSpy = vi.fn()
    mockEl.scrollTo = scrollToSpy
    const thumbnailsRef = ref<HTMLElement | null>(mockEl)

    const thumbnails = useImageViewerThumbnails({
      images,
      currentIndex,
      thumbnailsRef,
      gap: 10,
    })

    thumbnails.scrollThumbnailIntoView(12, 'smooth')
    await nextTick()

    // 12 * 66 = 792
    expect(scrollToSpy).toHaveBeenCalledWith({
      left: 792,
      behavior: 'smooth',
    })
  })

  it('resolveThumbnailUrl picks small/thumbnail/preview or falls back to url', () => {
    const img1: ImageViewerImage = {
      url: 'https://example.com/orig.jpg',
      variants: {
        small: 'https://example.com/small.jpg',
      },
    }
    expect(resolveThumbnailUrl(img1)).toBe('https://example.com/small.jpg')

    const img2: ImageViewerImage = {
      url: 'https://example.com/orig.jpg',
      variants: {
        preview: 'https://example.com/preview.jpg',
      },
    }
    expect(resolveThumbnailUrl(img2)).toBe('https://example.com/preview.jpg')

    const img3: ImageViewerImage = {
      url: 'https://example.com/orig.jpg',
    }
    expect(resolveThumbnailUrl(img3)).toBe('https://example.com/orig.jpg')
  })

  it('isVideoImage correctly detects videos by mediaType and URL extension', () => {
    expect(isVideoImage({ url: 'https://example.com/movie.mp4' })).toBe(true)
    expect(isVideoImage({ url: 'https://example.com/movie.webm' })).toBe(true)
    expect(isVideoImage({ url: 'https://example.com/movie.mov' })).toBe(true)
    expect(isVideoImage({ url: 'https://example.com/photo.jpg', mediaType: 'video' })).toBe(true)
    expect(isVideoImage({ url: 'https://example.com/photo.jpg' })).toBe(false)
    expect(isVideoImage(null)).toBe(false)
  })
})

describe('kitImageViewer - Virtualized .thumbnails-container component integration', () => {
  it('renders virtualized thumbnails in DOM when enableThumbnails is true', async () => {
    const images: ImageViewerImage[] = Array.from({ length: 100 }, (_, i) => ({
      url: `https://example.com/img-${i}.jpg`,
      alt: `Image ${i}`,
      variants: {
        small: `https://example.com/img-${i}-thumb.jpg`,
      },
    }))

    const wrapper = mount(KitImageViewer, {
      props: {
        visible: true,
        images,
        currentIndex: 0,
        enableThumbnails: true,
      },
      attachTo: document.body,
      global: {
        stubs: {
          Icon: true,
          ImageMetadataPanel: true,
          KitViewerTooltip: {
            template: '<div class="kit-viewer-tooltip-wrapper"><slot /></div>',
          },
        },
      },
    })

    const thumbnailsContainer = document.querySelector('.thumbnails-container')
    expect(thumbnailsContainer).not.toBeNull()

    const track = document.querySelector('.thumbnails-track') as HTMLElement
    expect(track).not.toBeNull()
    // Total width for 100 items: 100 * 66 - 10 = 6590px
    expect(track.style.width).toBe('6590px')

    // Verify virtualized: rendered buttons should be fewer than 100 items
    const renderedThumbnails = document.querySelectorAll('.thumbnails-track button.thumbnail')
    expect(renderedThumbnails.length).toBeLessThan(100)
    expect(renderedThumbnails.length).toBeGreaterThan(0)

    wrapper.unmount()
  })
})
