import { afterEach, describe, expect, it, mock } from 'bun:test'
import { ref } from 'vue'
import { routingService } from '../src/renderer/shared/services/geo/routing.service'

mock.module('../src/renderer/shared/composables/use-toast', () => ({ useToast: () => ({ error: () => {} }) }))
mock.module('../src/renderer/shared/services/geo', () => ({ routingService, nominatimService: {} }))
const { useGeolocationRoutes } = await import('../src/renderer/components/03.domain/trip-info/geolocation-section/composables/use-geolocation-routes')

const originalFetch = globalThis.fetch
const points = [{ id: 'a', coordinates: [121.545997, 25.151367], type: 'start' }, { id: 'b', coordinates: [121.5249762, 25.0842798], type: 'end' }]
const response = (duration: number) => new Response(JSON.stringify({ code: 'Ok', routes: [{ geometry: '_p~iF~ps|U_ulLnnqC_mqNvxq`@', distance: 9600, duration }] }))
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('route mode changes', () => {
  it('switches foot → car immediately and keeps the mode on reload', async () => {
    const urls: string[] = []
    globalThis.fetch = mock(async (url: any) => {
      urls.push(String(url))
      return response(600)
    }) as any
    const state = useGeolocationRoutes(ref(undefined))
    await state.setInitialRoutes([{ id: 'mode-switch', title: 'A → B', points, transportMode: 'foot', isVisible: true }] as any)
    const pending = state.setRouteTransportMode('mode-switch', 'car')
    expect(state.routes.value[0].transportMode).toBe('car')
    await pending
    expect(urls[0]).toContain('routed-foot')
    expect(urls[1]).toContain('routed-car')
    const saved = JSON.parse(JSON.stringify(state.routes.value))
    const reloaded = useGeolocationRoutes(ref(undefined))
    await reloaded.setInitialRoutes(saved)
    expect(reloaded.routes.value[0].transportMode).toBe('car')
    expect(reloaded.routes.value[0].duration).toBe(600)
  })

  it('does not calculate transit with a cycling or walking provider', async () => {
    const fetchMock = mock(async () => response(999))
    globalThis.fetch = fetchMock as any
    const route = await routingService.calculateRoute(points as any, 'transit', 'bus')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(route).toMatchObject({ distance: 0, duration: 0, isDirect: true })
  })

  it('ignores an older response after a rapid car → bike change', async () => {
    const pending: Array<(value: Response) => void> = []
    globalThis.fetch = mock(() => new Promise<Response>(resolve => pending.push(resolve))) as any
    const state = useGeolocationRoutes(ref(undefined))
    state.routes.value = [{ id: 'race', title: 'A → B', points: points.map(p => ({ ...p, coordinates: [p.coordinates[0] + 0.01, p.coordinates[1]] })), transportMode: 'foot', isVisible: true }] as any
    const car = state.setRouteTransportMode('race', 'car')
    const bike = state.setRouteTransportMode('race', 'bike')
    pending[1](response(200))
    await bike
    pending[0](response(900))
    await car
    expect(state.routes.value[0]).toMatchObject({ transportMode: 'bike', duration: 200, isFetching: false })
  })
})
