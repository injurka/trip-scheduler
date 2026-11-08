import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import KitImageViewer from '../src/ui/kit-image-viewer.vue'

const hash = 'InMBBYCHh4iIiIh/eHh3e3h4j4cI'

describe('viewer ThumbHash placeholders', () => {
  it('shows hashes in the slide and thumbnail until their images load', async () => {
    const wrapper = mount(KitImageViewer, {
      props: {
        visible: true,
        currentIndex: 0,
        enableThumbnails: true,
        images: [{ url: '/photo.jpg', variants: { small: '/small.webp', thumbhash: hash }, meta: { width: 800, height: 600 } }, { url: '/second.jpg' }],
      },
      global: { stubs: { Teleport: true, Transition: false } },
    })
    expect(wrapper.find('.viewer-thumbhash-placeholder').attributes('src')).toMatch(/^data:image\/png;base64,/)
    expect(wrapper.find('.thumbnail-thumbhash-placeholder').exists()).toBe(true)
    expect(wrapper.find('.thumbnail.active .thumb-skeleton').exists()).toBe(false)
    await wrapper.find('.thumbnail img:not(.thumbnail-thumbhash-placeholder)').trigger('load')
    expect(wrapper.find('.thumbnail-thumbhash-placeholder').exists()).toBe(false)
    await wrapper.find('.viewer-image').trigger('load')
    // Keep the hash beneath the image during its opacity transition.
    expect(wrapper.find('.viewer-thumbhash-placeholder').exists()).toBe(true)
    expect(wrapper.find('.viewer-image').classes()).toContain('loaded')
    wrapper.unmount()
  })
})
