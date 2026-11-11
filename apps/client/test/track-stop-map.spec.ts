import type { LayerSpecification, SourceSpecification } from 'maplibre-gl'
import type { UseDayTrackMapOptions } from '../src/renderer/components/04.features/day-track-player/composables/use-day-track-map'
import type { DayPoint, RenderSegment, RouteVisibility } from '../src/renderer/components/04.features/day-track-player/models/types'
import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref, shallowRef } from 'vue'
import { useDayTrackMap } from '../src/renderer/components/04.features/day-track-player/composables/use-day-track-map'

const state = vi.hoisted(() => ({ map: null as unknown }))
vi.mock('~/components/01.kit/kit-map/composables/use-kit-map', () => ({
  useKitMap: () => ({ mapInstance: shallowRef(state.map), isMapReady: ref(true), initMap: vi.fn().mockResolvedValue(undefined) }),
}))
vi.mock('maplibre-gl', () => ({}))

it('renders stops as individual unclustered points, preserves popup indices and hides labels below close zoom', async () => {
  const sources = new Map<string, { data: GeoJSON.FeatureCollection, config: SourceSpecification, setData: (data: GeoJSON.FeatureCollection) => void }>()
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
      })
    },
    addLayer: (layer: LayerSpecification) => layers.set(layer.id, layer),
    setFilter: vi.fn(),
    fitBounds: vi.fn(),
    getZoom: () => 14,
    project: vi.fn().mockReturnValue({ x: 0, y: 0 }),
    easeTo,
    on(event: string, ...args: unknown[]) {
      if (event === 'click')
        click = args[0] as typeof click
    },
    queryRenderedFeatures: vi.fn().mockReturnValue([{ geometry: { type: 'Point', coordinates: [48.001, 54.001] }, properties: { pointIndex: 2 } }]),
  }
  const stopData: DayPoint['stop'] = {
    startedAt: 10_000,
    endedAt: 100_000,
    radiusM: 20,
    samplesCount: 10,
    lat: 54.001,
    lng: 48.001,
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
      stop: stopData,
    },
    // Вторая точка того же самого периода остановки (не должна дублировать маркер)
    {
      clientPointId: 'c',
      tsUtc: 20_000,
      lat: 54.001,
      lng: 48.001,
      speed: 0,
      accuracy: 5,
      activity: 'still',
      sessionId: 's',
      stop: stopData,
    },
  ]
  const routeSegments = ref<RenderSegment[]>([])
  const mode = ref<'route' | 'points'>('route')
  const routeVisibility = ref<RouteVisibility>('full')
  const t = ref(0)
  const trailMinutes = ref(15)
  let selectedPointResult: unknown = null
  const options: UseDayTrackMapOptions = {
    mapHost: ref(document.createElement('div')),
    popupHost: ref(null),
    playbackMarkerHost: ref(null),
    dayData: ref({ points, rawPoints: points, segments: [] }),
    displayPoints: computed(() => options.dayData.value?.points ?? []),
    renderSegments: computed(() => {
      void options.dayData.value

      return [...routeSegments.value]
    }),
    currentPoint: computed(() => options.dayData.value?.points.findLast(p => p.tsUtc <= t.value) ?? null),
    currentActivityColor: computed(() => '#fff'),
    t,
    routeVisibility,
    trailMinutes,
    isPlaying: ref(false),
    isFollowCamera: ref(false),
    viewMode: mode,
  }
  const wrapper = mount(defineComponent({
    setup() {
      const mapApi = useDayTrackMap(options)
      selectedPointResult = mapApi.selectedPoint

      return () => h('div')
    },
  }))
  await nextTick()
  await nextTick()

  const stops = sources.get('day-track-stops-source')!
  // Без кластеризации пауз
  expect((stops.config as Record<string, unknown>).cluster).toBeFalsy()
  expect(layers.get('day-track-stop-clusters')).toBeUndefined()
  expect(layers.get('day-track-stop-cluster-count')).toBeUndefined()

  // Точки пауз существуют как отдельный слой
  expect(layers.get('day-track-stop-points')).toBeDefined()

  // Порог появления подписей и областей пауз: только на близком зуме
  expect(layers.get('day-track-stop-labels')?.minzoom).toBe(16.5)
  expect(layers.get('day-track-stop-areas')?.minzoom).toBe(16)

  // Единичный период остановки дедуплицируется в 1 маркер паузы
  expect(stops.data.features).toHaveLength(1)
  expect(stops.data.features[0].properties?.pointIndex).toBe(2)
  expect(stops.data.features[0].properties?.isStop).toBe(true)

  // Путевые точки маршрута не содержат точку паузы
  expect(sources.get('day-track-points-source')!.data.features).toHaveLength(1)

  // Клик по маркеру паузы выбирает именно эту точку
  click!({ point: { x: 0, y: 0 } })
  await Promise.resolve()
  expect((selectedPointResult as { value: { index: number, point: DayPoint } })?.value?.index).toBe(2)

  const mapMock = state.map as { fitBounds: ReturnType<typeof vi.fn> }
  t.value = 10_000
  await nextTick()
  options.isFollowCamera.value = true
  easeTo.mockClear()
  mapMock.fitBounds.mockClear()
  const correctedPoints = points.map(p => ({ ...p, activity: 'vehicle' as const }))
  options.dayData.value = { points: correctedPoints, rawPoints: correctedPoints, segments: [] }
  await nextTick()
  expect(mapMock.fitBounds).not.toHaveBeenCalled()
  expect((selectedPointResult as { value: { index: number } }).value?.index).toBe(2)
  expect((selectedPointResult as { value: { point: DayPoint } }).value?.point.activity).toBe('vehicle')
  expect(t.value).toBe(10_000)
  expect(easeTo).not.toHaveBeenCalled()
  options.isFollowCamera.value = false
  expect(options.isPlaying.value).toBe(false)

  // Переключение в режим всех точек Безье убирает слой пауз и выводит все точки в points-source
  mode.value = 'points'
  await nextTick()
  expect(stops.data.features).toHaveLength(0)
  expect(sources.get('day-track-points-source')!.data.features).toHaveLength(3)

  // Timeline changes update geometry and raw points without refitting the camera.
  const fitBounds = (state.map as { fitBounds: ReturnType<typeof vi.fn> }).fitBounds
  fitBounds.mockClear()
  routeVisibility.value = 'elapsed'
  t.value = 5_000
  await nextTick()
  expect(sources.get('day-track-points-source')!.data.features).toHaveLength(1)
  const route = sources.get('day-track-route-source')!.data.features[0]
  expect((route.geometry as GeoJSON.LineString).coordinates.at(-1)).toEqual([48.0005, 54.0005])

  t.value = 20_000
  await nextTick()
  expect(sources.get('day-track-points-source')!.data.features).toHaveLength(3)
  t.value = 5_000
  await nextTick()
  expect(sources.get('day-track-points-source')!.data.features).toHaveLength(1)

  routeVisibility.value = 'recent'
  trailMinutes.value = 0.1
  t.value = 20_000
  await nextTick()
  expect(sources.get('day-track-points-source')!.data.features).toHaveLength(1)
  expect(stops.data.features).toHaveLength(0)

  routeVisibility.value = 'full'
  await nextTick()
  expect(sources.get('day-track-points-source')!.data.features).toHaveLength(3)
  expect(fitBounds).not.toHaveBeenCalled()

  expect((sources.get('day-track-route-source')!.config as Record<string, unknown>).tolerance).toBe(0)
  expect((sources.get('day-track-progress-source')!.config as Record<string, unknown>).tolerance).toBe(0)
  routeSegments.value = [{
    activity: 'walk',
    t0: 0,
    t1: 10000,
    geometry: [[99, 99], [100, 100]],
    points: [
      { tsUtc: 0, lat: 0, lng: 0 },
      { tsUtc: 5000, lat: 0, lng: 0.0001 },
      { tsUtc: 10000, lat: 0.0001, lng: 0.0001 },
    ],
  }]
  mode.value = 'route'
  await nextTick()
  const detailed = sources.get('day-track-route-source')!.data.features[0].geometry as GeoJSON.LineString
  expect(detailed.coordinates.length).toBeGreaterThan(3)
  expect(detailed.coordinates[0]).toEqual([0, 0])
  expect(detailed.coordinates.at(-1)).toEqual([0.0001, 0.0001])
  wrapper.unmount()
})
