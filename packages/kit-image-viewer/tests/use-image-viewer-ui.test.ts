import type { ImageViewerImage } from '../src/models/types'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useImageViewerUi } from '../src/composables/use-image-viewer-ui'

describe('useImageViewerUi - dynamic variants', () => {
  it('extracts standard small, medium, large, original qualities', () => {
    const currentImage = ref<ImageViewerImage | null>({
      url: 'https://example.com/orig.jpg',
      variants: {
        small: 'https://example.com/small.jpg',
        medium: 'https://example.com/med.jpg',
        large: 'https://example.com/lg.jpg',
      },
    })

    const ui = useImageViewerUi({
      currentImage,
      containerRef: ref(null),
      thumbnailsRef: ref(null),
    })

    const values = ui.qualityItems.value.map(item => item.value)
    expect(values).toEqual(['small', 'medium', 'large', 'original'])
  })

  it('dynamically extracts arbitrary custom variant keys and formats labels', () => {
    const currentImage = ref<ImageViewerImage | null>({
      url: 'https://example.com/main.jpg',
      variants: {
        'preview': 'https://example.com/prev.jpg',
        'hd': 'https://example.com/hd.jpg',
        '4k': 'https://example.com/4k.jpg',
        'customVariant': 'https://example.com/custom.jpg',
      },
    })

    const ui = useImageViewerUi({
      currentImage,
      containerRef: ref(null),
      thumbnailsRef: ref(null),
    })

    const items = ui.qualityItems.value
    const values = items.map(item => item.value)
    expect(values).toContain('preview')
    expect(values).toContain('hd')
    expect(values).toContain('4k')
    expect(values).toContain('customVariant')
    expect(values).toContain('original')

    const item4k = items.find(i => i.value === '4k')
    expect(item4k?.label).toBe('4K (Ultra HD)')

    const custom = items.find(i => i.value === 'customVariant')
    expect(custom?.label).toBe('CustomVariant')
  })

  it('correctly resolves displayUrl for selected dynamic quality and fallbacks', () => {
    const currentImage = ref<ImageViewerImage | null>({
      url: 'https://example.com/orig.jpg',
      variants: {
        '4k': 'https://example.com/4k.jpg',
        'medium': 'https://example.com/med.jpg',
      },
    })

    const qualityModel = ref('4k')
    const ui = useImageViewerUi({
      currentImage,
      containerRef: ref(null),
      thumbnailsRef: ref(null),
      qualityModel,
    })

    expect(ui.displayUrl.value).toBe('https://example.com/4k.jpg')

    qualityModel.value = 'original'
    expect(ui.displayUrl.value).toBe('https://example.com/orig.jpg')

    // fallback when key is not in variants
    qualityModel.value = 'nonexistent'
    expect(ui.displayUrl.value).toBe('https://example.com/med.jpg')
  })
})
