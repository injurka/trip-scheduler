import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import KitImage from '../src/renderer/components/01.kit/kit-image/ui/kit-image.vue'

vi.mock('../src/renderer/shared/lib/url', () => ({ resolveApiUrl: (url?: string) => url || '' }))

const offlineImage = vi.hoisted(() => vi.fn())
vi.mock('../src/renderer/shared/lib/offline-cache', () => ({ getOfflineImageUrl: offlineImage }))
beforeEach(() => {
  offlineImage.mockResolvedValue(null)
})

const hash = 'InMBBYCHh4iIiIh/eHh3e3h4j4cI'
const wrappers: ReturnType<typeof mount>[] = []
function render(props: { src?: string, variants?: { small?: string, medium?: string, thumbhash?: string }, thumbhash?: string, loading?: 'eager', loadTimeout?: number }) {
  const wrapper = mount(KitImage, { props: { loading: 'eager', ...props }, global: { stubs: { KitBtn: { template: '<button><slot /></button>' } } } })
  wrappers.push(wrapper)

  return wrapper
}
afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount())
  wrappers.length = 0
  offlineImage.mockReset()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('kitImage loading', () => {
  it('renders ThumbHash immediately and fades in the loaded image', async () => {
    const wrapper = render({ src: '/photo.jpg', variants: { thumbhash: hash } })
    expect(wrapper.find('.thumbhash-placeholder').attributes('src')).toMatch(/^data:image\/png;base64,/)
    expect(wrapper.find('.skeleton-placeholder').exists()).toBe(false)
    expect(wrapper.find('.image').attributes('style')).toContain('opacity: 0')
    await wrapper.find('.image').trigger('load')
    expect(wrapper.find('.thumbhash-placeholder').exists()).toBe(false)
    expect(wrapper.find('.image').attributes('style')).toContain('opacity: 1')
  })

  it('uses a neutral placeholder when there is no usable hash and preserves the supplied URL', () => {
    const wrapper = render({ src: '/small-original.png', thumbhash: 'invalid' })
    expect(wrapper.find('.neutral-placeholder').exists()).toBe(true)
    expect(wrapper.find('source').exists()).toBe(false)
    expect(wrapper.find('.image').attributes('src')).toBe('/small-original.png')
  })

  it('resets loading when variants change while the original URL stays the same', async () => {
    const wrapper = render({ src: '/original.jpg', variants: { small: '/first.webp', thumbhash: hash } })
    await wrapper.find('.image').trigger('load')
    await wrapper.setProps({ variants: { small: '/second.webp', thumbhash: hash } })
    expect(wrapper.find('.thumbhash-placeholder').exists()).toBe(true)
    expect(wrapper.find('.image').attributes('src')).toBe('/second.webp')
    await wrapper.find('.image').trigger('error')
    await flushPromises()
    expect(wrapper.find('.error-placeholder').exists()).toBe(false)
    expect(wrapper.find('.thumbhash-placeholder').exists()).toBe(true)
    await wrapper.setProps({ src: '/third.jpg', variants: { thumbhash: hash } })
    expect(wrapper.find('.error-placeholder').exists()).toBe(false)
    expect(wrapper.find('.thumbhash-placeholder').exists()).toBe(true)
  })

  it('keeps the small preview after a full image fails and allows retry', async () => {
    const wrapper = render({ src: '/original.jpg', variants: { small: '/small.jpg', medium: '/medium.jpg' } })
    await wrapper.find('.image-preview').trigger('load')
    expect(wrapper.find('.neutral-placeholder').exists()).toBe(false)
    await wrapper.find('.image').trigger('error')
    await flushPromises()
    expect(wrapper.find('.image-preview').classes()).toContain('is-loaded')
    expect(wrapper.find('.error-placeholder').exists()).toBe(false)
    await wrapper.find('.image-retry').trigger('click')
    expect(wrapper.find('.image-retry').exists()).toBe(false)
    expect(wrapper.find('.image-preview').classes()).toContain('is-loaded')
    await wrapper.find('.image').trigger('load')
    expect(wrapper.find('.image').attributes('style')).toContain('opacity: 1')
  })

  it('ignores an old offline lookup after changing the source', async () => {
    let finish!: (url: string | null) => void
    offlineImage.mockImplementationOnce(() => new Promise((resolve) => {
      finish = resolve
    }))
    const wrapper = render({ src: '/first.jpg' })
    await wrapper.find('.image').trigger('error')
    await wrapper.setProps({ src: '/second.jpg' })
    finish(null)
    await flushPromises()
    expect(wrapper.find('.image').attributes('src')).toBe('/second.jpg')
    expect(wrapper.find('.error-placeholder').exists()).toBe(false)
  })

  it('loads a saved image without a service worker and releases its blob on unmount', async () => {
    offlineImage.mockResolvedValueOnce('blob:offline-photo')
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const wrapper = render({ src: '/saved.jpg', variants: { small: '/saved-small.webp' } })
    await wrapper.find('.image').trigger('error')
    await flushPromises()
    expect(wrapper.find('.image').attributes('src')).toBe('blob:offline-photo')
    expect(wrapper.find('source').exists()).toBe(false)
    await wrapper.find('.image').trigger('load')
    expect(wrapper.find('.error-placeholder').exists()).toBe(false)
    wrapper.unmount()
    expect(revoke).toHaveBeenCalledWith('blob:offline-photo')
  })

  it('shows the error state after an eager load times out', async () => {
    vi.useFakeTimers()
    const wrapper = render({ src: '/slow.jpg', thumbhash: hash, loadTimeout: 100 })
    await vi.advanceTimersByTimeAsync(100)
    expect(wrapper.find('.error-placeholder').exists()).toBe(false)
    expect(wrapper.find('.thumbhash-placeholder').exists()).toBe(true)
    expect(wrapper.find('picture').exists()).toBe(false)
  })
})
