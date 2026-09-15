<script setup lang="ts">
import type { TrackActivityType, TrackPoint, TrackSegment } from '../../src'
import { computed, ref } from 'vue'
import { haversineM } from '../../src'

const props = defineProps<{
  points: TrackPoint[]
  segments: TrackSegment[]
}>()

const emit = defineEmits<{
  (e: 'hoverPoint', point: TrackPoint | null): void
}>()

const hoveredIdx = ref<number | null>(null)

const activityColors: Record<TrackActivityType, string> = {
  walk: '#10b981',
  bike: '#06b6d4',
  vehicle: '#f97316',
  rail: '#a855f7',
  still: '#64748b',
  unknown: '#eab308',
}

interface PointWithDistance {
  point: TrackPoint
  distKm: number
  speedKmh: number
  altitudeM: number
}

const pointsWithDist = computed<PointWithDistance[]>(() => {
  if (props.points.length === 0)
    return []

  let totalDistM = 0
  const result: PointWithDistance[] = []

  for (let i = 0; i < props.points.length; i++) {
    const p = props.points[i]
    if (i > 0) {
      const prev = props.points[i - 1]
      totalDistM += haversineM(prev.lat, prev.lng, p.lat, p.lng)
    }
    result.push({
      point: p,
      distKm: totalDistM / 1000,
      speedKmh: (p.speed ?? 0) * 3.6,
      altitudeM: p.altitude ?? 0,
    })
  }

  return result
})

const maxDistKm = computed(() => {
  if (pointsWithDist.value.length === 0)
    return 1
  return Math.max(0.1, pointsWithDist.value[pointsWithDist.value.length - 1].distKm)
})

const maxSpeedKmh = computed(() => {
  if (pointsWithDist.value.length === 0)
    return 20
  const max = Math.max(...pointsWithDist.value.map(p => p.speedKmh))
  return Math.max(10, Math.ceil(max * 1.15))
})

const minAltitudeM = computed(() => {
  if (pointsWithDist.value.length === 0)
    return 0
  const min = Math.min(...pointsWithDist.value.map(p => p.altitudeM))
  return Math.floor(min * 0.95)
})

const maxAltitudeM = computed(() => {
  if (pointsWithDist.value.length === 0)
    return 100
  const max = Math.max(...pointsWithDist.value.map(p => p.altitudeM))
  return Math.ceil(max * 1.05)
})

const chartWidth = 900
const chartHeight = 160
const padding = { top: 20, right: 40, bottom: 25, left: 45 }

const innerWidth = chartWidth - padding.left - padding.right
const innerHeight = chartHeight - padding.top - padding.bottom

function getX(distKm: number): number {
  return padding.left + (distKm / maxDistKm.value) * innerWidth
}

function getYSpeed(speedKmh: number): number {
  return padding.top + innerHeight - (speedKmh / maxSpeedKmh.value) * innerHeight
}

function getYAlt(altM: number): number {
  const span = Math.max(10, maxAltitudeM.value - minAltitudeM.value)
  return padding.top + innerHeight - ((altM - minAltitudeM.value) / span) * innerHeight
}

const speedPath = computed(() => {
  if (pointsWithDist.value.length < 2)
    return ''
  return pointsWithDist.value
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.distKm).toFixed(1)} ${getYSpeed(p.speedKmh).toFixed(1)}`)
    .join(' ')
})

const speedAreaPath = computed(() => {
  if (pointsWithDist.value.length < 2)
    return ''
  const first = pointsWithDist.value[0]
  const last = pointsWithDist.value[pointsWithDist.value.length - 1]
  const base = padding.top + innerHeight
  return `${speedPath.value} L ${getX(last.distKm).toFixed(1)} ${base} L ${getX(first.distKm).toFixed(1)} ${base} Z`
})

const altitudePath = computed(() => {
  if (pointsWithDist.value.length < 2)
    return ''
  return pointsWithDist.value
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.distKm).toFixed(1)} ${getYAlt(p.altitudeM).toFixed(1)}`)
    .join(' ')
})

function onMouseMove(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const relativeX = (mouseX / rect.width) * chartWidth
  const clampedX = Math.max(padding.left, Math.min(padding.left + innerWidth, relativeX))
  const targetDistKm = ((clampedX - padding.left) / innerWidth) * maxDistKm.value

  let closestIdx = 0
  let minDistDiff = Number.POSITIVE_INFINITY

  for (let i = 0; i < pointsWithDist.value.length; i++) {
    const diff = Math.abs(pointsWithDist.value[i].distKm - targetDistKm)
    if (diff < minDistDiff) {
      minDistDiff = diff
      closestIdx = i
    }
  }

  hoveredIdx.value = closestIdx
  emit('hoverPoint', pointsWithDist.value[closestIdx]?.point ?? null)
}

function onMouseLeave() {
  hoveredIdx.value = null
  emit('hoverPoint', null)
}

const hoveredData = computed(() => {
  if (hoveredIdx.value == null || !pointsWithDist.value[hoveredIdx.value])
    return null
  return pointsWithDist.value[hoveredIdx.value]
})
</script>

<template>
  <div class="chart-container">
    <div class="chart-header">
      <div class="chart-legend">
        <span class="legend-item speed">
          <span class="legend-dot speed-dot" /> Скорость (км/ч)
        </span>
        <span class="legend-item altitude">
          <span class="legend-dot alt-dot" /> Высота (м)
        </span>
      </div>

      <div
        v-if="hoveredData"
        class="chart-hover-stats"
      >
        <span>Дистанция: <strong>{{ hoveredData.distKm.toFixed(2) }} км</strong></span>
        <span>Скорость: <strong class="text-amber">{{ hoveredData.speedKmh.toFixed(1) }} км/ч</strong></span>
        <span>Высота: <strong class="text-sky">{{ hoveredData.altitudeM.toFixed(0) }} м</strong></span>
        <span
          class="badge"
          :style="{ color: activityColors[hoveredData.point.activity] }"
        >
          {{ hoveredData.point.activity }}
        </span>
      </div>
    </div>

    <svg
      :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
      class="chart-svg"
      preserveAspectRatio="none"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
    >
      <defs>
        <linearGradient
          id="speedGradient"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            stop-color="#f59e0b"
            stop-opacity="0.35"
          />
          <stop
            offset="100%"
            stop-color="#f59e0b"
            stop-opacity="0.0"
          />
        </linearGradient>
      </defs>

      <!-- Horizontal grid lines -->
      <g class="grid-lines">
        <line
          v-for="i in 4"
          :key="`grid-${i}`"
          :x1="padding.left"
          :y1="padding.top + (innerHeight / 4) * (i - 1)"
          :x2="padding.left + innerWidth"
          :y2="padding.top + (innerHeight / 4) * (i - 1)"
          stroke="#1e293b"
          stroke-width="1"
          stroke-dasharray="3 3"
        />
      </g>

      <!-- Altitude Line -->
      <path
        v-if="altitudePath"
        :d="altitudePath"
        fill="none"
        stroke="#38bdf8"
        stroke-width="1.8"
        opacity="0.8"
      />

      <!-- Speed Area & Line -->
      <path
        v-if="speedAreaPath"
        :d="speedAreaPath"
        fill="url(#speedGradient)"
      />
      <path
        v-if="speedPath"
        :d="speedPath"
        fill="none"
        stroke="#f59e0b"
        stroke-width="2.2"
      />

      <!-- Y1 axis labels (Speed) -->
      <text
        :x="padding.left - 8"
        :y="padding.top + 10"
        fill="#f59e0b"
        font-size="11"
        text-anchor="end"
      >
        {{ maxSpeedKmh }}
      </text>
      <text
        :x="padding.left - 8"
        :y="padding.top + innerHeight"
        fill="#f59e0b"
        font-size="11"
        text-anchor="end"
      >
        0
      </text>

      <!-- Y2 axis labels (Altitude) -->
      <text
        :x="padding.left + innerWidth + 8"
        :y="padding.top + 10"
        fill="#38bdf8"
        font-size="11"
        text-anchor="start"
      >
        {{ maxAltitudeM }}m
      </text>
      <text
        :x="padding.left + innerWidth + 8"
        :y="padding.top + innerHeight"
        fill="#38bdf8"
        font-size="11"
        text-anchor="start"
      >
        {{ minAltitudeM }}m
      </text>

      <!-- X-axis distance labels -->
      <text
        :x="padding.left"
        :y="chartHeight - 6"
        fill="#64748b"
        font-size="11"
      >
        0 км
      </text>
      <text
        :x="padding.left + innerWidth / 2"
        :y="chartHeight - 6"
        fill="#64748b"
        font-size="11"
        text-anchor="middle"
      >
        {{ (maxDistKm / 2).toFixed(1) }} км
      </text>
      <text
        :x="padding.left + innerWidth"
        :y="chartHeight - 6"
        fill="#64748b"
        font-size="11"
        text-anchor="end"
      >
        {{ maxDistKm.toFixed(1) }} км
      </text>

      <!-- Hover Cursor Line -->
      <g v-if="hoveredData">
        <line
          :x1="getX(hoveredData.distKm)"
          :y1="padding.top"
          :x2="getX(hoveredData.distKm)"
          :y2="padding.top + innerHeight"
          stroke="#ffffff"
          stroke-width="1.5"
          stroke-dasharray="2 2"
        />
        <circle
          :cx="getX(hoveredData.distKm)"
          :cy="getYSpeed(hoveredData.speedKmh)"
          r="4"
          fill="#f59e0b"
          stroke="#ffffff"
          stroke-width="1.5"
        />
        <circle
          :cx="getX(hoveredData.distKm)"
          :cy="getYAlt(hoveredData.altitudeM)"
          r="4"
          fill="#38bdf8"
          stroke="#ffffff"
          stroke-width="1.5"
        />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.chart-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  background: #0f172a;
  border-radius: 10px;
  border: 1px solid #1e293b;
  padding: 10px 14px 4px;
  user-select: none;
  cursor: crosshair;
  display: flex;
  flex-direction: column;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 12px;
  min-height: 24px;
}

.chart-legend {
  display: flex;
  gap: 14px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #94a3b8;
  font-size: 11px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.speed-dot {
  background: #f59e0b;
}

.alt-dot {
  background: #38bdf8;
}

.chart-hover-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #cbd5e1;
  background: rgba(30, 41, 59, 0.8);
  padding: 2px 10px;
  border-radius: 6px;
}

.chart-hover-stats strong {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
}

.text-amber {
  color: #f59e0b;
}

.text-sky {
  color: #38bdf8;
}

.badge {
  text-transform: uppercase;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.chart-svg {
  width: 100%;
  height: auto;
  min-height: 0;
  flex: 1;
  display: block;
  overflow: visible;
}
</style>
