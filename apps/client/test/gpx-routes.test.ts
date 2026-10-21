import { afterEach, describe, expect, it, mock } from 'bun:test'
import { ref } from 'vue'
import { routingService } from '../src/renderer/shared/services/geo/routing.service'

mock.module('../src/renderer/shared/composables/use-toast', () => ({ useToast: () => ({ error: () => {} }) }))
mock.module('../src/renderer/shared/services/geo', () => ({ routingService, nominatimService: {} }))
const { useGeolocationRoutes } = await import('../src/renderer/components/03.domain/trip-info/geolocation-section/composables/use-geolocation-routes')

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('imported gpx tracks', () => {
  it('keeps imported geometry and never recalculates it through the routing service', async () => {
    const fetchMock = mock(async () => {
      throw new Error('OSRM must not be called for imported tracks')
    })
    globalThis.fetch = fetchMock as any

    const addOrUpdateRoute = mock(() => {})
    const state = useGeolocationRoutes(ref({ addOrUpdateRoute } as any))

    const geometry = [
      [121.507955, 23.922278],
      [121.508269, 23.922658],
      [121.508426, 23.922673],
    ] as [number, number][]

    await state.setInitialRoutes([{
      id: 'gpx-1',
      title: 'Чинань',
      points: [
        { id: 's', coordinates: geometry[0], type: 'start' },
        { id: 'e', coordinates: geometry[2], type: 'end' },
      ],
      transportMode: 'foot',
      isVisible: true,
      geometry,
      distance: 1234,
      duration: 3600,
    }] as any)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(state.routes.value[0].geometry).toEqual(geometry)
    expect(state.routes.value[0].distance).toBe(1234)
    expect(state.routes.value[0].duration).toBe(3600)
    expect(addOrUpdateRoute).toHaveBeenCalled()
  })

  it('still calculates routes that arrive without geometry', async () => {
    const fetchMock = mock(async () => new Response(JSON.stringify({
      code: 'Ok',
      routes: [{ geometry: '_p~iF~ps|U_ulLnnqC_mqNvxq`@', distance: 9600, duration: 600 }],
    })))
    globalThis.fetch = fetchMock as any

    const state = useGeolocationRoutes(ref(undefined))
    await state.setInitialRoutes([{
      id: 'plain-1',
      title: 'A → B',
      points: [
        { id: 'a', coordinates: [121.90123, 25.03456], type: 'start' },
        { id: 'b', coordinates: [121.88765, 25.07890], type: 'end' },
      ],
      transportMode: 'foot',
      isVisible: true,
    }] as any)

    expect(fetchMock).toHaveBeenCalled()
    expect(state.routes.value[0].geometry).toBeDefined()
  })
})
