import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, Teleport } from 'vue'
import { useCurrentTime } from '../src/renderer/shared/composables/use-current-time'
import { useFullscreenBackground } from '../src/renderer/shared/composables/use-fullscreen-background'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount())
  wrappers.length = 0
  document.body.innerHTML = ''
  document.body.style.overflow = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('fullscreen route isolation', () => {
  it('suspends the background, keeps teleported controls accessible, restores state and scroll on exit and unmount', async () => {
    const root = document.createElement('div')
    root.id = 'app'
    root.style.contentVisibility = 'visible'
    root.style.containIntrinsicSize = 'auto 900px'
    document.body.append(root)
    document.body.style.overflow = 'auto'
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({ width: 390, height: 2400 } as DOMRect)
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 680 })
    const fullscreen = ref(false)
    const wrapper = mount(defineComponent({
      setup() {
        useFullscreenBackground(fullscreen)

        return () => h(Teleport, { to: 'body', disabled: !fullscreen.value }, h('button', 'Маршрут'))
      },
    }), { attachTo: root })
    wrappers.push(wrapper)
    fullscreen.value = true
    await nextTick()
    expect(root.style.contentVisibility).toBe('hidden')
    expect(root.style.containIntrinsicSize).toBe('390px 2400px')
    expect(root.inert).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.querySelector('button')?.closest('#app')).toBeNull()
    fullscreen.value = false
    await nextTick()
    await nextTick()
    expect(root.style.contentVisibility).toBe('visible')
    expect(root.style.containIntrinsicSize).toBe('auto 900px')
    expect(root.inert).toBeFalsy()
    expect(document.body.style.overflow).toBe('auto')
    expect(scroll).toHaveBeenCalledWith({ left: 0, top: 680, behavior: 'instant' })
    fullscreen.value = true
    await nextTick()
    wrapper.unmount()
    wrappers.length = 0
    expect(root.style.contentVisibility).toBe('visible')
    expect(root.inert).toBeFalsy()
    expect(document.body.style.overflow).toBe('auto')
  })
})

describe('live date and booking clock', () => {
  it('updates over midnight and on foreground return, then cleans up', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(
      2026,
      10,
      8,
      23,
      59,
      55,
    ))
    let clock: ReturnType<typeof useCurrentTime> | undefined
    const wrapper = mount(defineComponent({
      setup() {
        clock = useCurrentTime()

        return () => h('div')
      },
    }))
    wrappers.push(wrapper)
    vi.advanceTimersByTime(15_000)
    expect(clock!.value.getDate()).toBe(9)
    vi.setSystemTime(new Date(
      2026,
      10,
      10,
      12,
    ))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(clock!.value.getDate()).toBe(10)
    wrapper.unmount()
    wrappers.length = 0
    vi.setSystemTime(new Date(
      2026,
      10,
      11,
      12,
    ))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(clock!.value.getDate()).toBe(10)
    expect(vi.getTimerCount()).toBe(0)
  })
})
