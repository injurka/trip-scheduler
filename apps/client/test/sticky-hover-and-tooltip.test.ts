import { mount } from '@vue/test-utils'
import postcss from 'postcss'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { postcssHoverMedia } from '../build/lib/postcss-hover-media'
import KitTooltip from '../src/renderer/components/01.kit/kit-tooltip/ui/kit-tooltip.vue'

describe('postcssHoverMedia plugin', () => {
  it('wraps simple :hover rule in @media (hover: hover) and (pointer: fine)', async () => {
    const input = '.mode-button:hover { color: #f00; }'
    const result = await postcss([postcssHoverMedia()]).process(input, { from: undefined })

    expect(result.css).toContain('@media (hover: hover) and (pointer: fine)')
    expect(result.css).toContain('.mode-button:hover')
  })

  it('splits combined hover and non-hover selectors', async () => {
    const input = '.btn:hover, .btn:active { color: #00f; }'
    const result = await postcss([postcssHoverMedia()]).process(input, { from: undefined })

    expect(result.css).toContain('.btn:active { color: #00f; }')
    expect(result.css).toContain('@media (hover: hover) and (pointer: fine)')
    expect(result.css).toContain('.btn:hover { color: #00f; }')
  })

  it('does not wrap :not(:hover) selector', async () => {
    const input = '.grid:not(:hover) { opacity: 0.5; }'
    const result = await postcss([postcssHoverMedia()]).process(input, { from: undefined })

    expect(result.css).not.toContain('@media (hover: hover)')
    expect(result.css).toContain('.grid:not(:hover)')
  })

  it('does not double wrap rules already inside @media (hover: ...)', async () => {
    const input = '@media (hover: hover) and (pointer: fine) { .already:hover { color: #0f0; } }'
    const result = await postcss([postcssHoverMedia()]).process(input, { from: undefined })

    const matches = result.css.match(/@media \(hover: hover\) and \(pointer: fine\)/g)
    expect(matches?.length).toBe(1)
  })
})

describe('kitTooltip touch vs mouse behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not open tooltip on pointerenter when pointerType is touch', async () => {
    const wrapper = mount(KitTooltip, {
      props: { text: 'Test Tooltip' },
      slots: {
        default: '<button class="test-btn">Click</button>',
      },
    })

    const wrapperEl = wrapper.find('.kit-tooltip-wrapper')
    await wrapperEl.trigger('pointerenter', { pointerType: 'touch' })

    vi.advanceTimersByTime(300)
    await nextTick()

    expect(document.querySelector('.kit-tooltip-floating')).toBeNull()
  })

  it('does not open tooltip on focusin when interaction was touch tap', async () => {
    const wrapper = mount(KitTooltip, {
      props: { text: 'Test Tooltip' },
      slots: {
        default: '<button class="test-btn">Click</button>',
      },
    })

    const wrapperEl = wrapper.find('.kit-tooltip-wrapper')
    await wrapperEl.trigger('pointerdown', { pointerType: 'touch' })
    await wrapperEl.trigger('focusin')

    vi.advanceTimersByTime(300)
    await nextTick()

    expect(document.querySelector('.kit-tooltip-floating')).toBeNull()
  })

  it('hides open tooltip on window scroll', async () => {
    const wrapper = mount(KitTooltip, {
      props: { text: 'Test Tooltip' },
      slots: {
        default: '<button class="test-btn">Click</button>',
      },
      attachTo: document.body,
    })

    // Simulate desktop mouse hover
    const wrapperEl = wrapper.find('.kit-tooltip-wrapper')
    await wrapperEl.trigger('pointerenter', { pointerType: 'mouse' })

    vi.advanceTimersByTime(300)
    await nextTick()

    // Scroll should hide it
    window.dispatchEvent(new Event('scroll'))
    await nextTick()

    expect(document.querySelector('.kit-tooltip-floating')).toBeNull()
    wrapper.unmount()
  })
})
