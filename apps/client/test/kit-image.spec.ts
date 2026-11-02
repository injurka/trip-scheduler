import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import KitImage from '../src/renderer/components/01.kit/kit-image/ui/kit-image.vue'

vi.mock('../src/renderer/shared/lib/url', () => ({ resolveApiUrl: (url?: string) => url || '' }))

const hash = 'InMBBYCHh4iIiIh/eHh3e3h4j4cI'
const wrappers: ReturnType<typeof mount>[] = []
function render(props: { src?: string, variants?: { small?: string, thumbhash?: string }, thumbhash?: string, loading?: 'eager', loadTimeout?: number }) {
  const wrapper = mount(KitImage, { props: { loading: 'eager', ...props }, global: { stubs: { KitSkeleton: { template: '<div />' } } } })
  wrappers.push(wrapper)

  return wrapper
}
afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount())
  wrappers.length = 0
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

  it('uses the skeleton only when there is no usable hash and preserves the supplied URL', () => {
    const wrapper = render({ src: '/small-original.png', thumbhash: 'invalid' })
    expect(wrapper.find('.skeleton-placeholder').exists()).toBe(true)
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
    expect(wrapper.find('.error-placeholder').exists()).toBe(true)
    await wrapper.setProps({ src: '/third.jpg', variants: { thumbhash: hash } })
    expect(wrapper.find('.error-placeholder').exists()).toBe(false)
    expect(wrapper.find('.thumbhash-placeholder').exists()).toBe(true)
  })

  it('shows the error state after an eager load times out', async () => {
    vi.useFakeTimers()
    const wrapper = render({ src: '/slow.jpg', thumbhash: hash, loadTimeout: 100 })
    await vi.advanceTimersByTimeAsync(100)
    expect(wrapper.find('.error-placeholder').exists()).toBe(true)
    expect(wrapper.find('picture').exists()).toBe(false)
  })
})
