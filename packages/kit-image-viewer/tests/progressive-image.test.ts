import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import KitImageViewer from '../src/ui/kit-image-viewer.vue'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount())
  wrappers.length = 0
})
function render(variants: Record<string, string> = { small: '/small.jpg', large: '/large.jpg' }) {
  const wrapper = mount(KitImageViewer, {
    props: { visible: true, currentIndex: 0, quality: 'large', images: [{ url: '/original.jpg', variants }] },
    global: { stubs: { teleport: true, Icon: true, ImageMetadataPanel: true, KitViewerControls: true } },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('progressive photo loading', () => {
  it('shows the small variant without an overlay and retains it on failure and retry', async () => {
    const wrapper = render()
    expect(wrapper.find('.viewer-preview').attributes('src')).toBe('/small.jpg')
    await wrapper.find('.viewer-preview').trigger('load')
    expect(wrapper.find('.viewer-preview').classes()).toContain('loaded')
    expect(wrapper.find('.shimmer-container').exists()).toBe(false)
    const failedImage = wrapper.find('.viewer-image')
    await failedImage.trigger('error')
    expect(wrapper.find('.viewer-preview').classes()).toContain('loaded')
    expect(wrapper.find('.image-error').exists()).toBe(false)
    await wrapper.find('.preview-retry').trigger('click')
    expect(wrapper.find('.preview-retry').exists()).toBe(false)
    await failedImage.trigger('error')
    expect(wrapper.find('.preview-retry').exists()).toBe(false)
    await wrapper.find('.viewer-image').trigger('load')
    expect(wrapper.find('.viewer-image').classes()).toContain('loaded')
  })

  it('keeps the loaded quality while upgrading and rejects an outdated load event', async () => {
    const wrapper = render()
    const oldImage = wrapper.find('.viewer-image')
    await oldImage.trigger('load')
    await wrapper.setProps({ quality: 'original' })
    expect(wrapper.find('.viewer-preview').attributes('src')).toBe('/large.jpg')
    expect(wrapper.find('.viewer-image').classes()).not.toContain('loaded')
    await oldImage.trigger('load')
    expect(wrapper.find('.viewer-image').classes()).not.toContain('loaded')
    await wrapper.find('.viewer-image').trigger('load')
    expect(wrapper.find('.viewer-image').classes()).toContain('loaded')
  })

  it('resets state when a different photo replaces the same index', async () => {
    const wrapper = render()
    await wrapper.find('.viewer-image').trigger('load')
    await wrapper.setProps({ images: [{ url: '/other.jpg', variants: { small: '/other-small.jpg', large: '/other-large.jpg' } }] })
    expect(wrapper.find('.viewer-image').classes()).not.toContain('loaded')
    expect(wrapper.find('.viewer-preview').attributes('src')).toBe('/other-small.jpg')
    expect(wrapper.find('.viewer-preview').classes()).not.toContain('loaded')
  })

  it('preserves ThumbHash on error and offers retry without covering it', async () => {
    const wrapper = render({ thumbhash: 'InMBBYCHh4iIiIh/eHh3e3h4j4cI' })
    await wrapper.find('.viewer-image').trigger('error')
    expect(wrapper.find('.viewer-thumbhash-placeholder').exists()).toBe(true)
    expect(wrapper.find('.placeholder-wrapper').exists()).toBe(false)
    expect(wrapper.find('.preview-retry').exists()).toBe(true)
  })

  it('hides the hash after preview load and the preview after original load', async () => {
    const wrapper = render({ small: '/small.jpg', large: '/large.jpg', thumbhash: 'InMBBYCHh4iIiIh/eHh3e3h4j4cI' })
    const hash = wrapper.find('.viewer-thumbhash-placeholder')
    expect(hash.classes()).not.toContain('is-hidden')
    expect(hash.attributes('style')).toBe(wrapper.find('.viewer-preview').attributes('style'))
    await wrapper.find('.viewer-preview').trigger('load')
    expect(hash.classes()).toContain('is-hidden')
    expect(wrapper.find('.viewer-preview').classes()).toContain('loaded')
    expect(wrapper.find('.viewer-empty-placeholder').exists()).toBe(false)
    await wrapper.find('.viewer-image').trigger('load')
    expect(wrapper.find('.viewer-preview').classes()).not.toContain('loaded')
    expect(wrapper.find('.viewer-image').classes()).toContain('loaded')
  })

  it('keeps hidden loading layers hidden during a swipe, including adjacent slides', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    try {
      const wrapper = render({ small: '/small.jpg', large: '/large.jpg', thumbhash: 'InMBBYCHh4iIiIh/eHh3e3h4j4cI' })
      await wrapper.setProps({ images: [
        { url: '/original.jpg', variants: { small: '/small.jpg', large: '/large.jpg', thumbhash: 'InMBBYCHh4iIiIh/eHh3e3h4j4cI' } },
        { url: '/next.jpg', variants: { small: '/next-small.jpg', thumbhash: 'InMBBYCHh4iIiIh/eHh3e3h4j4cI' } },
      ] })
      for (const image of wrapper.findAll('.viewer-image'))
        await image.trigger('load')
      const container = wrapper.find('.image-container')
      await container.trigger('touchstart', { touches: [{ clientX: 250, clientY: 100 }] })
      await container.trigger('touchmove', { touches: [{ clientX: 150, clientY: 100 }] })
      expect(Number((wrapper.find('.current-image-wrapper').element as HTMLElement).style.opacity)).toBeLessThan(1)
      for (const hash of wrapper.findAll('.viewer-thumbhash-placeholder')) {
        expect(hash.classes()).toContain('is-hidden')
        expect((hash.element as HTMLElement).style.opacity).toBe('')
      }
      for (const preview of wrapper.findAll('.viewer-preview')) {
        expect(preview.classes()).not.toContain('loaded')
        expect((preview.element as HTMLElement).style.opacity).toBe('')
      }
    }
    finally {
      vi.restoreAllMocks()
    }
  })

  it('recognizes an already completed cached image on mount', async () => {
    const wrapper = render()
    const image = wrapper.find('.viewer-image').element as HTMLImageElement
    Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 1200 }, naturalHeight: { value: 800 } })
    await nextTick()
    expect(wrapper.find('.viewer-image').classes()).toContain('loaded')
  })
})
