<script setup lang="ts">
import type { DisplayTrackPoint, TrackActivityType, TrackPoint, TrackSegment, TrackStop } from '../../src'
import { Icon } from '@iconify/vue'
import * as maplibregl from 'maplibre-gl'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import 'maplibre-gl/dist/maplibre-gl.css'

const props = defineProps<{
  rawPoints: TrackPoint[]
  processedPoints: DisplayTrackPoint[]
  segments: TrackSegment[]
  outliers: TrackPoint[]
  stays: TrackStop[]
  splinePoints: { lat: number, lng: number }[]
  highlightedPoint: TrackPoint | null
  showRaw: boolean
  showProcessed: boolean
  showOutliers: boolean
  showStays: boolean
  showSpline: boolean
}>()

const emit = defineEmits<{
  (e: 'selectPoint', point: TrackPoint): void
}>()

const mapContainer = ref<HTMLDivElement | null>(null)
let map: maplibregl.Map | null = null
let mapResizeObserver: ResizeObserver | null = null
const mapError = ref<string | null>(null)
const selectedPoint = ref<TrackPoint | null>(null)
const mapLoaded = ref(false)

const activityColors: Record<TrackActivityType, string> = {
  walk: '#10b981',
  bike: '#06b6d4',
  vehicle: '#f97316',
  rail: '#a855f7',
  still: '#64748b',
  unknown: '#eab308',
}

// Bounding box calculation for SVG fallback or initial zoom
const bounds = computed(() => {
  const all = [...props.rawPoints, ...props.processedPoints]
  if (all.length === 0)
    return null

  let minLat = Number.POSITIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY
  let minLng = Number.POSITIVE_INFINITY
  let maxLng = Number.NEGATIVE_INFINITY

  for (const p of all) {
    if (p.lat < minLat)
      minLat = p.lat
    if (p.lat > maxLat)
      maxLat = p.lat
    if (p.lng < minLng)
      minLng = p.lng
    if (p.lng > maxLng)
      maxLng = p.lng
  }

  return { minLat, maxLat, minLng, maxLng }
})

// SVG fallback projection
function projectToSvg(lat: number, lng: number, width: number, height: number, padding = 40) {
  const b = bounds.value
  if (!b)
    return { x: width / 2, y: height / 2 }

  const spanLat = Math.max(0.0001, b.maxLat - b.minLat)
  const spanLng = Math.max(0.0001, b.maxLng - b.minLng)

  const x = padding + ((lng - b.minLng) / spanLng) * (width - padding * 2)
  const y = height - (padding + ((lat - b.minLat) / spanLat) * (height - padding * 2))

  return { x, y }
}

const svgWidth = 800
const svgHeight = 600

const rawSvgPoints = computed(() => {
  return props.rawPoints.map(p => ({
    ...p,
    ...projectToSvg(p.lat, p.lng, svgWidth, svgHeight),
  }))
})

const processedSvgPoints = computed(() => {
  return props.processedPoints.map(p => ({
    ...p,
    ...projectToSvg(p.lat, p.lng, svgWidth, svgHeight),
  }))
})

const splineSvgPath = computed(() => {
  if (props.splinePoints.length < 2)
    return ''
  return props.splinePoints
    .map((p, idx) => {
      const { x, y } = projectToSvg(p.lat, p.lng, svgWidth, svgHeight)
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
})

const rawSvgPath = computed(() => {
  if (rawSvgPoints.value.length < 2)
    return ''
  return rawSvgPoints.value
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
})

const processedSvgPath = computed(() => {
  if (processedSvgPoints.value.length < 2)
    return ''
  return processedSvgPoints.value
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
})

function initMap() {
  if (!mapContainer.value)
    return

  try {
    map = new maplibregl.Map({
      container: mapContainer.value,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 20,
          },
        ],
      },
      center: [37.618, 55.751],
      zoom: 12,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')

    map.on('load', () => {
      mapLoaded.value = true
      map?.resize()
      setupMapLayers()
      fitTrackBounds()
    })

    map.on('error', (e: any) => {
      console.warn('MapLibre error notice:', e)
    })
  }
  catch (err: any) {
    console.error('Failed to init MapLibre:', err)
    mapError.value = err?.message || 'WebGL / Map initialization error'
  }
}

function setupMapLayers() {
  if (!map || !mapLoaded.value)
    return

  // Raw track source
  if (!map.getSource('raw-track')) {
    map.addSource('raw-track', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    map.addLayer({
      id: 'raw-track-line',
      type: 'line',
      source: 'raw-track',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#ef4444',
        'line-width': 2,
        'line-opacity': 0.45,
        'line-dasharray': [2, 2],
      },
    })

    map.addLayer({
      id: 'raw-track-points',
      type: 'circle',
      source: 'raw-track',
      paint: {
        'circle-radius': 3.5,
        'circle-color': '#f87171',
        'circle-opacity': 0.5,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#b91c1c',
      },
    })
  }

  // Spline track source
  if (!map.getSource('spline-track')) {
    map.addSource('spline-track', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    map.addLayer({
      id: 'spline-track-line',
      type: 'line',
      source: 'spline-track',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#38bdf8',
        'line-width': 3,
        'line-opacity': 0.8,
      },
    })
  }

  // Processed segments source
  if (!map.getSource('segments-track')) {
    map.addSource('segments-track', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    map.addLayer({
      id: 'segments-track-line',
      type: 'line',
      source: 'segments-track',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 4.5,
        'line-opacity': 0.9,
      },
    })
  }

  // Stays source (circles)
  if (!map.getSource('stays-data')) {
    map.addSource('stays-data', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    map.addLayer({
      id: 'stays-circles',
      type: 'circle',
      source: 'stays-data',
      paint: {
        'circle-radius': 12,
        'circle-color': '#6366f1',
        'circle-opacity': 0.3,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#818cf8',
      },
    })
  }

  // Outliers source
  if (!map.getSource('outliers-data')) {
    map.addSource('outliers-data', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    map.addLayer({
      id: 'outliers-points',
      type: 'circle',
      source: 'outliers-data',
      paint: {
        'circle-radius': 7,
        'circle-color': '#ef4444',
        'circle-opacity': 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    })
  }

  updateMapData()
}

function updateMapData() {
  if (!map || !mapLoaded.value)
    return

  // 1. Raw track
  const rawSource = map.getSource('raw-track') as maplibregl.GeoJSONSource
  if (rawSource) {
    const coords = props.rawPoints.map(p => [p.lng, p.lat])
    rawSource.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        },
        ...props.rawPoints.map((p, idx) => ({
          type: 'Feature' as const,
          properties: { index: idx, speed: p.speed, activity: p.activity },
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        })),
      ],
    })
  }

  // 2. Spline track
  const splineSource = map.getSource('spline-track') as maplibregl.GeoJSONSource
  if (splineSource) {
    const coords = props.splinePoints.map(p => [p.lng, p.lat])
    splineSource.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        },
      ],
    })
  }

  // 3. Segments
  const segSource = map.getSource('segments-track') as maplibregl.GeoJSONSource
  if (segSource) {
    const features: any[] = []
    if (props.segments && props.segments.length > 0) {
      for (const seg of props.segments) {
        features.push({
          type: 'Feature',
          properties: {
            activity: seg.activity,
            color: activityColors[seg.activity] || '#3b82f6',
            confidence: seg.confidence,
          },
          geometry: {
            type: 'LineString',
            coordinates: seg.points.map(p => [p.lng, p.lat]),
          },
        })
      }
    }
    else if (props.processedPoints.length > 0) {
      features.push({
        type: 'Feature',
        properties: { color: '#10b981' },
        geometry: {
          type: 'LineString',
          coordinates: props.processedPoints.map(p => [p.lng, p.lat]),
        },
      })
    }
    segSource.setData({ type: 'FeatureCollection', features })
  }

  // 4. Stays
  const staysSource = map.getSource('stays-data') as maplibregl.GeoJSONSource
  if (staysSource) {
    staysSource.setData({
      type: 'FeatureCollection',
      features: props.stays.map(s => ({
        type: 'Feature',
        properties: { radius: s.radiusM, samples: s.samplesCount },
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      })),
    })
  }

  // 5. Outliers
  const outliersSource = map.getSource('outliers-data') as maplibregl.GeoJSONSource
  if (outliersSource) {
    outliersSource.setData({
      type: 'FeatureCollection',
      features: props.outliers.map(p => ({
        type: 'Feature',
        properties: { speed: p.speed, accuracy: p.accuracy },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      })),
    })
  }

  // Layer visibility toggles
  if (map.getLayer('raw-track-line')) {
    map.setLayoutProperty('raw-track-line', 'visibility', props.showRaw ? 'visible' : 'none')
    map.setLayoutProperty('raw-track-points', 'visibility', props.showRaw ? 'visible' : 'none')
  }
  if (map.getLayer('spline-track-line')) {
    map.setLayoutProperty('spline-track-line', 'visibility', props.showSpline ? 'visible' : 'none')
  }
  if (map.getLayer('segments-track-line')) {
    map.setLayoutProperty('segments-track-line', 'visibility', props.showProcessed ? 'visible' : 'none')
  }
  if (map.getLayer('stays-circles')) {
    map.setLayoutProperty('stays-circles', 'visibility', props.showStays ? 'visible' : 'none')
  }
  if (map.getLayer('outliers-points')) {
    map.setLayoutProperty('outliers-points', 'visibility', props.showOutliers ? 'visible' : 'none')
  }
}

function fitTrackBounds() {
  if (!map || !bounds.value)
    return
  const b = bounds.value
  map.fitBounds(
    [
      [b.minLng, b.minLat],
      [b.maxLng, b.maxLat],
    ],
    { padding: 60, maxZoom: 17, duration: 800 },
  )
}

watch(
  () => [
    props.rawPoints,
    props.processedPoints,
    props.segments,
    props.outliers,
    props.stays,
    props.splinePoints,
    props.showRaw,
    props.showProcessed,
    props.showOutliers,
    props.showStays,
    props.showSpline,
  ],
  () => {
    updateMapData()
  },
  { deep: true },
)

watch(
  () => props.rawPoints,
  () => {
    nextTick(() => {
      fitTrackBounds()
    })
  },
)

watch(
  () => props.highlightedPoint,
  (pt) => {
    if (!pt || !map)
      return
    map.flyTo({ center: [pt.lng, pt.lat], zoom: Math.max(map.getZoom(), 15), duration: 400 })
  },
)

onMounted(() => {
  initMap()

  if (mapContainer.value) {
    mapResizeObserver = new ResizeObserver(() => map?.resize())
    mapResizeObserver.observe(mapContainer.value)
  }
})

onBeforeUnmount(() => {
  mapResizeObserver?.disconnect()
  mapResizeObserver = null

  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <div class="track-map-wrapper">
    <!-- MapLibre Map Container -->
    <div
      v-show="!mapError"
      ref="mapContainer"
      class="maplibre-view"
    />

    <!-- Fallback SVG Canvas when WebGL is unavailable -->
    <div
      v-if="mapError"
      class="svg-fallback-view"
    >
      <div class="svg-fallback-notice">
        <Icon icon="lucide:info" />
        <span>Режим векторной проекции (WebGL недоступен: {{ mapError }})</span>
      </div>
      <svg
        :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
        class="svg-track-canvas"
      >
        <!-- Grid -->
        <defs>
          <pattern
            id="grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="#1e293b"
              stroke-width="1"
            />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="url(#grid)"
        />

        <!-- Raw line -->
        <path
          v-if="showRaw && rawSvgPath"
          :d="rawSvgPath"
          class="svg-raw-line"
        />

        <!-- Spline line -->
        <path
          v-if="showSpline && splineSvgPath"
          :d="splineSvgPath"
          class="svg-spline-line"
        />

        <!-- Processed line -->
        <path
          v-if="showProcessed && processedSvgPath"
          :d="processedSvgPath"
          class="svg-processed-line"
        />

        <!-- Raw points -->
        <g v-if="showRaw">
          <circle
            v-for="(p, i) in rawSvgPoints"
            :key="`raw-${i}`"
            :cx="p.x"
            :cy="p.y"
            r="3"
            class="svg-raw-point"
            @click="emit('selectPoint', p)"
          />
        </g>

        <!-- Processed points -->
        <g v-if="showProcessed">
          <circle
            v-for="(p, i) in processedSvgPoints"
            :key="`proc-${i}`"
            :cx="p.x"
            :cy="p.y"
            r="4.5"
            :fill="activityColors[p.activity] || '#10b981'"
            class="svg-proc-point"
            @click="emit('selectPoint', p)"
          />
        </g>
      </svg>
    </div>

    <!-- Map Floating Controls Overlay -->
    <div class="map-floating-overlay">
      <button
        class="map-btn"
        title="Вписать трек в экран"
        @click="fitTrackBounds"
      >
        <Icon icon="lucide:maximize-2" />
      </button>
    </div>

    <!-- Active Point Inspector Card -->
    <div
      v-if="selectedPoint"
      class="point-inspector-card"
    >
      <div class="inspector-header">
        <div class="inspector-title">
          <Icon icon="lucide:map-pin" />
          <span>Точка трека</span>
        </div>
        <button
          class="inspector-close"
          @click="selectedPoint = null"
        >
          <Icon icon="lucide:x" />
        </button>
      </div>
      <div class="inspector-grid">
        <div class="prop-item">
          <span class="label">Широта:</span>
          <span class="value">{{ selectedPoint.lat.toFixed(6) }}</span>
        </div>
        <div class="prop-item">
          <span class="label">Долгота:</span>
          <span class="value">{{ selectedPoint.lng.toFixed(6) }}</span>
        </div>
        <div class="prop-item">
          <span class="label">Скорость:</span>
          <span class="value">{{ selectedPoint.speed ? `${(selectedPoint.speed * 3.6).toFixed(1)} км/ч` : '0 км/ч' }}</span>
        </div>
        <div class="prop-item">
          <span class="label">Высота:</span>
          <span class="value">{{ selectedPoint.altitude ? `${selectedPoint.altitude.toFixed(0)} м` : '—' }}</span>
        </div>
        <div class="prop-item">
          <span class="label">Точность:</span>
          <span class="value">{{ selectedPoint.accuracy ? `±${selectedPoint.accuracy} м` : '—' }}</span>
        </div>
        <div class="prop-item">
          <span class="label">Активность:</span>
          <span class="value badge">{{ selectedPoint.activity }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.track-map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 380px;
  background-color: #0b0f19;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid #1e293b;
}

.maplibre-view {
  width: 100%;
  height: 100%;
}

.svg-fallback-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  background-color: #090d16;
}

.svg-fallback-notice {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #94a3b8;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(8px);
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #334155;
}

.svg-track-canvas {
  width: 100%;
  height: 100%;
}

.svg-raw-line {
  fill: none;
  stroke: #ef4444;
  stroke-width: 2;
  stroke-dasharray: 4 3;
  opacity: 0.5;
}

.svg-spline-line {
  fill: none;
  stroke: #38bdf8;
  stroke-width: 2.5;
  opacity: 0.7;
}

.svg-processed-line {
  fill: none;
  stroke: #10b981;
  stroke-width: 3.5;
  opacity: 0.9;
}

.svg-raw-point {
  fill: #f87171;
  stroke: #b91c1c;
  stroke-width: 1;
  cursor: pointer;
  transition: transform 0.15s;
}

.svg-raw-point:hover {
  r: 6;
  fill: #ff0000;
}

.svg-proc-point {
  stroke: #ffffff;
  stroke-width: 1.5;
  cursor: pointer;
  transition: transform 0.15s;
}

.svg-proc-point:hover {
  r: 7;
}

.map-floating-overlay {
  position: absolute;
  bottom: 24px;
  right: 16px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.map-btn {
  background: rgba(15, 23, 42, 0.9);
  color: #f8fafc;
  border: 1px solid #334155;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.2s;
}

.map-btn:hover {
  background: #1e293b;
  border-color: #475569;
}

.point-inspector-card {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 20;
  width: 260px;
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(12px);
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
}

.inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #334155;
}

.inspector-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 13px;
  color: #38bdf8;
}

.inspector-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 14px;
  padding: 2px;
}

.inspector-close:hover {
  color: #f8fafc;
}

.inspector-grid {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
}

.prop-item {
  display: flex;
  justify-content: space-between;
}

.prop-item .label {
  color: #94a3b8;
}

.prop-item .value {
  font-family: 'JetBrains Mono', monospace;
  color: #f1f5f9;
  font-weight: 500;
}

.prop-item .badge {
  background: #1e293b;
  padding: 2px 6px;
  border-radius: 4px;
  color: #38bdf8;
  font-size: 11px;
}
</style>
