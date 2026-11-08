import type { LayerSpecification, SourceSpecification } from 'maplibre-gl'
import type { UseDayTrackMapOptions } from '../src/renderer/components/04.features/day-track-player/composables/use-day-track-map'
import type { DayPoint } from '../src/renderer/components/04.features/day-track-player/models/types'
import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref, shallowRef } from 'vue'
import { useDayTrackMap } from '../src/renderer/components/04.features/day-track-player/composables/use-day-track-map'

const state = vi.hoisted(() => ({ map: null as unknown }))
vi.mock('~/components/01.kit/kit-map/composables/use-kit-map', () => ({
  useKitMap: () => ({ mapInstance: shallowRef(state.map), isMapReady: ref(true), initMap: vi.fn().mockResolvedValue(undefined) }),
}))
vi.mock('maplibre-gl', () => ({}))

it('clusters stops independently, preserves popup indices and restores raw points', async () => {
  const sources = new Map<string, { data: GeoJSON.FeatureCollection, config: SourceSpecification, setData: (data: GeoJSON.FeatureCollection) => void, getClusterExpansionZoom: ReturnType<typeof vi.fn> }>()
  const layers = new Map<string, LayerSpecification>()
  let click: ((event: unknown) => void) | undefined
  const easeTo = vi.fn()
  state.map = {
    getSource: (id: string) => sources.get(id),
    getLayer: (id: string) => layers.get(id),
    addSource(id: string, config: SourceSpecification) {
      sources.set(id, {
        config,
        data: { type: 'FeatureCollection', features: [] },
        setData(data) {
          this.data = data
        },
        getClusterExpansionZoom: vi.fn().mockResolvedValue(15),
      })
    },
    addLayer: (layer: LayerSpecification) => layers.set(layer.id, layer),
    setFilter: vi.fn(),
    fitBounds: vi.fn(),
    getZoom: () => 10,
    easeTo,
    on(event: string, ...args: unknown[]) {
      if (event === 'click')
        click = args[0] as typeof click
    },
    queryRenderedFeatures: vi.fn().mockReturnValue([{ geometry: { type: 'Point', coordinates: [48, 54] }, properties: { cluster_id: 12 } }]),
  }
  const points: DayPoint[] = [
    {
      clientPointId: 'a',
      tsUtc: 0,
      lat: 54,
      lng: 48,
      speed: 1,
      accuracy: 5,
      activity: 'walk',
      sessionId: 's',
    },
    {
      clientPointId: 'b',
      tsUtc: 10_000,
      lat: 54.001,
      lng: 48.001,
      speed: 0,
      accuracy: 5,
      activity: 'still',
      sessionId: 's',
      stop: { startedAt: 10_000, endedAt: 100_000, radiusM: 20, samplesCount: 10 } as DayPoint['stop'],
    },
  ]
  const mode = ref<'route' | 'points'>('route')
  const options: UseDayTrackMapOptions = {
    mapHost: ref(document.createElement('div')),
    popupHost: ref(null),
    playbackMarkerHost: ref(null),
    dayData: ref({ points, rawPoints: points, segments: [] }),
    displayPoints: computed(() => points),
    renderSegments: computed(() => []),
    currentPoint: computed(() => null),
    currentActivityColor: computed(() => '#fff'),
    t: ref(0),
    isPlaying: ref(false),
    isFollowCamera: ref(false),
    viewMode: mode,
  }
  const wrapper = mount(defineComponent({
    setup() {
      useDayTrackMap(options)

      return () => h('div')
    },
  }))
  await nextTick()
  await nextTick()
  const stops = sources.get('day-track-stops-source')!
  expect(stops.config).toMatchObject({ cluster: true, clusterRadius: 28, clusterMaxZoom: 14 })
  expect(stops.data.features).toHaveLength(1)
  expect(stops.data.features[0].properties?.pointIndex).toBe(2)
  expect(sources.get('day-track-points-source')!.data.features).toHaveLength(1)
  expect(layers.get('day-track-stop-labels')?.minzoom).toBe(15)
  expect(layers.get('day-track-stop-areas')?.minzoom).toBe(15)
  click!({ point: { x: 0, y: 0 } })
  await Promise.resolve()
  expect(stops.getClusterExpansionZoom).toHaveBeenCalledWith(12)
  expect(easeTo).toHaveBeenCalledWith({ center: [48, 54], zoom: 15 })
  mode.value = 'points'
  await nextTick()
  expect(stops.data.features).toHaveLength(0)
  expect(sources.get('day-track-points-source')!.data.features).toHaveLength(2)
  wrapper.unmount()
})
