import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useDialogHistory } from '../src/renderer/components/01.kit/kit-dialog-with-close/composables/use-dialog-history'
import { useCurrentLocationRoute } from '../src/renderer/components/03.domain/trip-info/geolocation-section/composables/use-current-location-route'

const mocks = vi.hoisted(() => ({ gps: vi.fn(), calculate: vi.fn(), error: vi.fn() }))
vi.mock('~/shared/services/geo/current-position', () => ({ getCurrentCoordinates: mocks.gps }))
vi.mock('~/shared/services/geo', () => ({ routingService: { calculateRoute: mocks.calculate } }))
vi.mock('~/shared/composables/use-toast', () => ({ useToast: () => ({ error: mocks.error }) }))
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.restoreAllMocks()
  vi.clearAllMocks()
})
async function flush() {
  await nextTick()
  await flushPromises()
  await nextTick()
}

describe('dialog history', () => {
  it('records actual scroll and navigates back once when closed and unmounted', async () => {
    window.history.replaceState({ position: 4 }, '')
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 930 })
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const visible = ref(true)
    const wrapper = mount(defineComponent({
      setup() {
        useDialogHistory('scroll-regression', visible)

        return () => h('div')
      },
    }))
    wrappers.push(wrapper)
    expect(window.history.state.scroll).toEqual({ left: 0, top: 930 })
    visible.value = false
    await flush()
    wrapper.unmount()
    wrappers.length = 0
    expect(back).toHaveBeenCalledTimes(1)
    window.history.replaceState({ position: 4 }, '')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await flush()
  })
  it('waits for delayed back before rapid reopen and leaves the parent open', async () => {
    window.history.replaceState({ position: 5 }, '')
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const parent = ref(true)
    const child = ref(false)
    wrappers.push(mount(defineComponent({
      setup() {
        useDialogHistory('parent', parent)
        useDialogHistory('child', child)

        return () => h('div')
      },
    })))
    child.value = true
    await flush()
    child.value = false
    await flush()
    child.value = true
    await flush()
    expect(back).toHaveBeenCalledTimes(1)
    window.history.replaceState({ dialogId: 'parent', position: 5 }, '')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await flush()
    expect(parent.value).toBe(true)
    expect(window.history.state.dialogId).toBe('child')
    window.history.replaceState({ dialogId: 'parent', position: 5 }, '')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await flush()
    expect(child.value).toBe(false)
    expect(parent.value).toBe(true)
    window.history.replaceState({ position: 5 }, '')
  })
})

function mountNavigation() {
  const controller = {
    addOrUpdatePoint: vi.fn(),
    removePoint: vi.fn(),
    addOrUpdateRoute: vi.fn(),
    removeRoute: vi.fn(),
    fitToContent: vi.fn(),
  }
  let navigation!: ReturnType<typeof useCurrentLocationRoute>
  const wrapper = mount(defineComponent({
    setup() {
      navigation = useCurrentLocationRoute(ref(controller) as unknown as Parameters<typeof useCurrentLocationRoute>[0])

      return () => h('div')
    },
  }))
  wrappers.push(wrapper)

  return { controller, navigation, wrapper }
}

describe('gPS navigation', () => {
  it('snapshots the destination, prevents duplicate requests and cleans up overlays', async () => {
    let resolveGps!: (value: [number, number]) => void
    mocks.gps.mockReturnValue(new Promise<[number, number]>((resolve) => {
      resolveGps = resolve
    }))
    mocks.calculate.mockResolvedValue({ geometry: [[48, 54], [49, 55]], distance: 1200, duration: 800, isDirect: false })
    const { navigation, controller, wrapper } = mountNavigation()
    const target: [number, number] = [49, 55]
    const request = navigation.routeTo(target)
    target[0] = 0
    await navigation.routeTo([1, 2])
    expect(mocks.gps).toHaveBeenCalledTimes(1)
    resolveGps([48, 54])
    await request
    expect(mocks.calculate.mock.calls[0][0].map((point: { coordinates: number[] }) => point.coordinates)).toEqual([[48, 54], [49, 55]])
    expect(controller.addOrUpdateRoute).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    wrappers.length = 0
    expect(controller.removePoint).toHaveBeenCalledTimes(2)
  })
  it('reports GPS failure and never displays a straight-line fallback as navigation', async () => {
    mocks.gps.mockResolvedValue([48, 54])
    mocks.calculate.mockResolvedValue({ geometry: [], isDirect: true })
    const { navigation, controller } = mountNavigation()
    await navigation.routeTo([49, 55])
    expect(controller.addOrUpdateRoute).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledTimes(1)
    expect(navigation.isLocating.value).toBe(false)
    mocks.gps.mockRejectedValue(new Error('GPS denied'))
    await navigation.routeTo([49, 55])
    expect(mocks.error).toHaveBeenLastCalledWith('GPS denied')
  })
  it('ignores late GPS results after unmount', async () => {
    let resolveGps!: (value: [number, number]) => void
    mocks.gps.mockReturnValue(new Promise<[number, number]>((resolve) => {
      resolveGps = resolve
    }))
    const { navigation, wrapper } = mountNavigation()
    const request = navigation.routeTo([49, 55])
    wrapper.unmount()
    wrappers.length = 0
    resolveGps([48, 54])
    await request
    expect(mocks.calculate).not.toHaveBeenCalled()
  })
})
