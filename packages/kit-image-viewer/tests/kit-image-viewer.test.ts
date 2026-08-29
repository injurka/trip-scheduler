import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import KitImageViewer from '../src/ui/kit-image-viewer.vue'
import KitViewerControls from '../src/ui/kit-viewer-controls.vue'

describe('kitImageViewer - quality change resets zoom', () => {
  const images = [
    {
      url: 'https://example.com/orig.jpg',
      variants: {
        small: 'https://example.com/small.jpg',
        medium: 'https://example.com/med.jpg',
        large: 'https://example.com/lg.jpg',
      },
    },
  ]

  it('resets transform when quality prop is changed', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 1000,
      height: 800,
      top: 0,
      left: 0,
      bottom: 800,
      right: 1000,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    const wrapper = mount(KitImageViewer, {
      props: {
        visible: true,
        images,
        currentIndex: 0,
        quality: 'large',
      },
      attachTo: document.body,
      global: {
        stubs: {
          Icon: true,
          ImageMetadataPanel: true,
          KitViewerTooltip: true,
        },
      },
    })

    const imgEl = document.querySelector('img.viewer-image') as HTMLImageElement
    expect(imgEl).not.toBeNull()

    // Double click to zoom to 2x
    imgEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 500, clientY: 400 }))
    await nextTick()

    expect(imgEl.style.transform).toContain('scale(2)')

    // Change quality prop
    await wrapper.setProps({ quality: 'small' })
    await nextTick()

    // Zoom must be reset to default (scale(1))
    expect(imgEl.style.transform).toBe('translate(0px, 0px) scale(1)')

    wrapper.unmount()
  })

  it('resets transform when quality is selected from controls dropdown', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 1000,
      height: 800,
      top: 0,
      left: 0,
      bottom: 800,
      right: 1000,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    const wrapper = mount(KitImageViewer, {
      props: {
        visible: true,
        images,
        currentIndex: 0,
      },
      attachTo: document.body,
      global: {
        stubs: {
          Icon: true,
          ImageMetadataPanel: true,
          KitViewerTooltip: true,
        },
      },
    })

    const imgEl = document.querySelector('img.viewer-image') as HTMLImageElement
    expect(imgEl).not.toBeNull()

    // Double click to zoom to 2x
    imgEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 500, clientY: 400 }))
    await nextTick()

    expect(imgEl.style.transform).toContain('scale(2)')

    // Find KitViewerControls component and emit update:quality
    const controls = wrapper.findComponent(KitViewerControls)
    expect(controls.exists()).toBe(true)
    controls.vm.$emit('update:quality', 'small')
    await nextTick()

    // Zoom must be reset to default (scale(1))
    expect(imgEl.style.transform).toBe('translate(0px, 0px) scale(1)')

    wrapper.unmount()
  })
})
