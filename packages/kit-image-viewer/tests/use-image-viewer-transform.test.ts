import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useImageViewerTransform } from '../src/composables/use-image-viewer-transform'

describe('useImageViewerTransform', () => {
  it('initializes with default transform values', () => {
    const imageRef = ref(null)
    const containerRef = ref(null)
    const naturalSize = { width: 1920, height: 1080 }

    const { transform, canZoomIn, canZoomOut } = useImageViewerTransform({
      imageRef,
      containerRef,
      naturalSize,
      minZoom: 1,
      maxZoom: 4,
      zoomStep: 0.5,
      enableTouch: true,
      animationDuration: 300,
    })

    expect(transform.scale).toBe(1)
    expect(transform.x).toBe(0)
    expect(transform.y).toBe(0)
    expect(canZoomIn.value).toBe(true)
    expect(canZoomOut.value).toBe(false)
  })

  it('resets transform properly', () => {
    const imageRef = ref(null)
    const containerRef = ref(null)
    const naturalSize = { width: 1920, height: 1080 }

    const { transform, resetTransform } = useImageViewerTransform({
      imageRef,
      containerRef,
      naturalSize,
      minZoom: 1,
      maxZoom: 4,
      zoomStep: 0.5,
      enableTouch: true,
      animationDuration: 300,
    })

    transform.scale = 3
    transform.x = 100
    transform.y = 50

    resetTransform(false)

    expect(transform.scale).toBe(1)
    expect(transform.x).toBe(0)
    expect(transform.y).toBe(0)
  })
})
