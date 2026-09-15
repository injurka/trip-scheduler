<script setup lang="ts">
import type { DisplayTrackPoint, TrackActivityType, TrackPoint, TrackSegment, TrackStop } from '../src'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import {
  catmullRomSpline,
  collapseStayPoints,
  filterGpsOutliers,
  filterStaticDrift,
  haversineM,
  mergeStationaryPoints,
  processDayTrack,
  rdpSimplify,
} from '../src'
import SpeedAltitudeChart from './components/speed-altitude-chart.vue'
import TrackMap from './components/track-map.vue'
import { exportToGeoJson, parseGeoJsonPoints, parseGpx, PRESET_SCENARIOS } from './data/presets'

// ─── State ────────────────────────────────────────────────────────────────────

const selectedScenarioId = ref<string>('multimodal')
const rawPoints = ref<TrackPoint[]>([])
const highlightedPoint = ref<TrackPoint | null>(null)
const activeBottomTab = ref<'chart' | 'segments' | 'stays' | 'json'>('chart')
const isProcessing = ref(false)
const processingTimeMs = ref(0)
const copyNotification = ref<string | null>(null)

// Pipeline configuration
const pipelineConfig = ref({
  filterOutliers: true,
  maxSpeedKmh: 300,
  filterBoomerangs: true,
  maxAccuracyM: 60,

  filterDrift: true,
  maxDriftM: 2.5,

  mergeStationary: true,
  maxDistanceM: 5.0,
  maxGapTimeMs: 15 * 60 * 1000,
  maxStationarySpeedMs: 0.7,

  collapseStays: true,

  simplifyRdp: true,
  epsilonM: 5.0,

  smoothSpline: true,
  subdivPerSegment: 5,

  segmentDayTrack: true,
})

// Layer toggles
const layerToggles = ref({
  showRaw: true,
  showProcessed: true,
  showOutliers: true,
  showStays: true,
  showSpline: true,
})

// ─── Pipeline Execution ───────────────────────────────────────────────────────

const outliersList = ref<TrackPoint[]>([])
const processedPoints = ref<DisplayTrackPoint[]>([])
const splinePoints = ref<{ lat: number, lng: number }[]>([])
const segmentsList = ref<TrackSegment[]>([])
const staysList = ref<TrackStop[]>([])

function runPipeline() {
  if (rawPoints.value.length === 0) {
    processedPoints.value = []
    splinePoints.value = []
    segmentsList.value = []
    staysList.value = []
    outliersList.value = []
    return
  }

  isProcessing.value = true
  const startTime = performance.now()

  try {
    let current: TrackPoint[] = [...rawPoints.value]

    // 1. Filter outliers
    if (pipelineConfig.value.filterOutliers) {
      const filtered = filterGpsOutliers(current, {
        maxSpeedKmh: pipelineConfig.value.maxSpeedKmh,
        filterBoomerangs: pipelineConfig.value.filterBoomerangs,
        maxAccuracyM: pipelineConfig.value.maxAccuracyM,
      })
      const filteredSet = new Set(filtered.map(p => p.clientPointId))
      outliersList.value = current.filter(p => !filteredSet.has(p.clientPointId))
      current = filtered
    }
    else {
      outliersList.value = []
    }

    // 2. Filter static drift
    if (pipelineConfig.value.filterDrift) {
      current = filterStaticDrift(current, pipelineConfig.value.maxDriftM)
    }

    // 3. Merge stationary points
    if (pipelineConfig.value.mergeStationary) {
      current = mergeStationaryPoints(current, {
        maxDistanceM: pipelineConfig.value.maxDistanceM,
        maxGapTimeMs: pipelineConfig.value.maxGapTimeMs,
        maxStationarySpeedMs: pipelineConfig.value.maxStationarySpeedMs,
      })
    }

    // 4. Collapse stays
    let withStays: DisplayTrackPoint[] = current
    if (pipelineConfig.value.collapseStays) {
      withStays = collapseStayPoints(current)
      const foundStays: TrackStop[] = []
      for (const p of withStays) {
        if (p.stop && !foundStays.some(s => s.startedAt === p.stop?.startedAt)) {
          foundStays.push(p.stop)
        }
      }
      staysList.value = foundStays
    }
    else {
      staysList.value = []
    }

    // 5. RDP Simplification
    let simplified = withStays
    if (pipelineConfig.value.simplifyRdp && withStays.length > 2) {
      simplified = rdpSimplify(withStays, pipelineConfig.value.epsilonM)
    }

    processedPoints.value = simplified

    // 6. Spline interpolation
    if (pipelineConfig.value.smoothSpline && simplified.length >= 3) {
      splinePoints.value = catmullRomSpline(
        simplified.map(p => ({ lat: p.lat, lng: p.lng })),
        pipelineConfig.value.subdivPerSegment,
      )
    }
    else {
      splinePoints.value = []
    }

    // 7. Day track segmentation & classification
    if (pipelineConfig.value.segmentDayTrack && rawPoints.value.length > 3) {
      segmentsList.value = processDayTrack(rawPoints.value)
    }
    else {
      segmentsList.value = []
    }
  }
  finally {
    processingTimeMs.value = Math.max(0.1, performance.now() - startTime)
    isProcessing.value = false
  }
}

// ─── Scenario Loader ──────────────────────────────────────────────────────────

function loadScenario(scenarioId: string) {
  selectedScenarioId.value = scenarioId
  const found = PRESET_SCENARIOS.find(s => s.id === scenarioId)
  if (found) {
    rawPoints.value = found.generate()
    runPipeline()
  }
}

// Add random outlier / jitter on the fly
function injectSpike() {
  if (rawPoints.value.length < 5)
    return
  const idx = Math.floor(rawPoints.value.length / 2)
  const target = rawPoints.value[idx]
  rawPoints.value[idx] = {
    ...target,
    lat: target.lat + 0.025,
    lng: target.lng + 0.025,
    speed: 130,
    accuracy: 85,
  }
  rawPoints.value = [...rawPoints.value]
  runPipeline()
}

// Reset parameters
function resetConfig() {
  pipelineConfig.value = {
    filterOutliers: true,
    maxSpeedKmh: 300,
    filterBoomerangs: true,
    maxAccuracyM: 60,

    filterDrift: true,
    maxDriftM: 2.5,

    mergeStationary: true,
    maxDistanceM: 5.0,
    maxGapTimeMs: 15 * 60 * 1000,
    maxStationarySpeedMs: 0.7,

    collapseStays: true,

    simplifyRdp: true,
    epsilonM: 5.0,

    smoothSpline: true,
    subdivPerSegment: 5,

    segmentDayTrack: true,
  }
  runPipeline()
}

// ─── File Upload & Export ─────────────────────────────────────────────────────

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0)
    return

  const file = input.files[0]
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const text = e.target?.result as string
      if (file.name.endsWith('.gpx')) {
        rawPoints.value = parseGpx(text)
      }
      else {
        // Assume JSON
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) {
          rawPoints.value = parsed
        }
        else if (parsed.type === 'FeatureCollection' || parsed.type === 'Feature') {
          rawPoints.value = parseGeoJsonPoints(parsed)
        }
        else {
          showNotification('Неподдерживаемый формат JSON (ожидается массив точек TrackPoint[])')
          return
        }
      }
      selectedScenarioId.value = 'custom'
      runPipeline()
    }
    catch (err: any) {
      showNotification(`Ошибка разбора файла: ${err.message}`)
    }
  }
  reader.readAsText(file)
  input.value = ''
}

function copyGeoJson() {
  const json = exportToGeoJson(processedPoints.value, segmentsList.value)
  navigator.clipboard.writeText(json)
  showNotification('GeoJSON скопирован в буфер обмена!')
}

function copyProcessedJson() {
  const json = JSON.stringify(processedPoints.value, null, 2)
  navigator.clipboard.writeText(json)
  showNotification('JSON точек скопирован в буфер обмена!')
}

function downloadGeoJson() {
  const json = exportToGeoJson(processedPoints.value, segmentsList.value)
  const blob = new Blob([json], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `processed-track-${Date.now()}.geojson`
  a.click()
  URL.revokeObjectURL(url)
}

function showNotification(text: string) {
  copyNotification.value = text
  setTimeout(() => {
    copyNotification.value = null
  }, 3000)
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

const rawDistanceM = computed(() => {
  let dist = 0
  for (let i = 1; i < rawPoints.value.length; i++) {
    const p1 = rawPoints.value[i - 1]
    const p2 = rawPoints.value[i]
    dist += haversineM(p1.lat, p1.lng, p2.lat, p2.lng)
  }
  return dist
})

const processedDistanceM = computed(() => {
  let dist = 0
  for (let i = 1; i < processedPoints.value.length; i++) {
    const p1 = processedPoints.value[i - 1]
    const p2 = processedPoints.value[i]
    dist += haversineM(p1.lat, p1.lng, p2.lat, p2.lng)
  }
  return dist
})

const compressionRatio = computed(() => {
  if (rawPoints.value.length === 0)
    return 0
  const reduced = rawPoints.value.length - processedPoints.value.length
  return ((reduced / rawPoints.value.length) * 100).toFixed(1)
})

const totalDurationFormatted = computed(() => {
  if (rawPoints.value.length < 2)
    return '0 мин'
  const ms = rawPoints.value[rawPoints.value.length - 1].tsUtc - rawPoints.value[0].tsUtc
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  if (hours > 0)
    return `${hours} ч ${minutes % 60} мин`
  return `${minutes} мин`
})

const activityColors: Record<TrackActivityType, string> = {
  walk: '#10b981',
  bike: '#06b6d4',
  vehicle: '#f97316',
  rail: '#a855f7',
  still: '#64748b',
  unknown: '#eab308',
}

const activityNames: Record<TrackActivityType, string> = {
  walk: 'Пешком',
  bike: 'Велосипед',
  vehicle: 'Автомобиль',
  rail: 'Поезд/Метро',
  still: 'Стоянка',
  unknown: 'Неизвестно',
}

// Watchers
watch(
  pipelineConfig,
  () => {
    runPipeline()
  },
  { deep: true },
)

// Init
loadScenario(selectedScenarioId.value)
</script>

<template>
  <div class="playground-layout">
    <!-- Notification Toast -->
    <Transition name="fade">
      <div
        v-if="copyNotification"
        class="toast-notification"
      >
        <Icon icon="lucide:check-circle" />
        <span>{{ copyNotification }}</span>
      </div>
    </Transition>

    <!-- Top App Bar -->
    <header class="app-header">
      <div class="header-left">
        <div class="app-logo">
          <Icon
            icon="lucide:navigation"
            class="logo-icon"
          />
          <div class="logo-text">
            <span class="logo-title">Track Processing</span>
            <span class="logo-package">@limiteddissolve/track-processing</span>
          </div>
        </div>
        <span class="version-badge">v1.0.0</span>
      </div>

      <!-- Preset Scenarios Selector -->
      <div class="header-presets">
        <button
          v-for="scenario in PRESET_SCENARIOS"
          :key="scenario.id"
          class="preset-btn"
          :class="{ active: selectedScenarioId === scenario.id }"
          :title="scenario.description"
          @click="loadScenario(scenario.id)"
        >
          <Icon :icon="scenario.icon" />
          <span>{{ scenario.name }}</span>
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="header-actions">
        <label
          class="action-btn upload-btn"
          title="Загрузить GPX или GeoJSON/JSON"
        >
          <Icon icon="lucide:upload" />
          <span>Импорт</span>
          <input
            type="file"
            accept=".gpx,.json,.geojson"
            class="hidden-file-input"
            @change="handleFileUpload"
          >
        </label>

        <button
          class="action-btn"
          title="Скопировать GeoJSON"
          @click="copyGeoJson"
        >
          <Icon icon="lucide:copy" />
          <span>GeoJSON</span>
        </button>

        <button
          class="action-btn"
          title="Скачать GeoJSON файл"
          @click="downloadGeoJson"
        >
          <Icon icon="lucide:download" />
        </button>

        <button
          class="action-btn spike-btn"
          title="Имитировать аномальный выброс (бумеранг-спайк) на лету"
          @click="injectSpike"
        >
          <Icon icon="lucide:zap" />
          <span>+Спайк</span>
        </button>
      </div>
    </header>

    <!-- Main Workbench Area -->
    <div class="workbench-body">
      <!-- Left Sidebar: Controls & Pipeline -->
      <aside class="sidebar">
        <!-- Section: Pipeline Steps -->
        <div class="sidebar-section">
          <div class="section-title">
            <div class="title-with-icon">
              <Icon icon="lucide:cpu" />
              <span>Пайплайн обработки</span>
            </div>
            <button
              class="reset-btn"
              title="Сбросить к значениям по умолчанию"
              @click="resetConfig"
            >
              <Icon icon="lucide:rotate-ccw" />
            </button>
          </div>

          <!-- Step 1: Outliers -->
          <div class="config-card">
            <label class="switch-row">
              <input
                v-model="pipelineConfig.filterOutliers"
                type="checkbox"
              >
              <span class="step-num">1</span>
              <span class="switch-label">Фильтр выбросов GPS</span>
            </label>
            <div
              v-if="pipelineConfig.filterOutliers"
              class="card-controls"
            >
              <div class="range-field">
                <div class="range-labels">
                  <span>Макс. скорость</span>
                  <strong>{{ pipelineConfig.maxSpeedKmh }} км/ч</strong>
                </div>
                <input
                  v-model.number="pipelineConfig.maxSpeedKmh"
                  type="range"
                  min="60"
                  max="600"
                  step="20"
                >
              </div>
              <div
                class="range-field"
                style="margin-top: 8px;"
              >
                <div class="range-labels">
                  <span>Макс. погрешность (accuracy)</span>
                  <strong>{{ pipelineConfig.maxAccuracyM }} м</strong>
                </div>
                <input
                  v-model.number="pipelineConfig.maxAccuracyM"
                  type="range"
                  min="10"
                  max="120"
                  step="5"
                >
              </div>
            </div>
          </div>

          <!-- Step 2: Static Drift -->
          <div class="config-card">
            <label class="switch-row">
              <input
                v-model="pipelineConfig.filterDrift"
                type="checkbox"
              >
              <span class="step-num">2</span>
              <span class="switch-label">Статический дрейф</span>
            </label>
            <div
              v-if="pipelineConfig.filterDrift"
              class="card-controls"
            >
              <div class="range-field">
                <div class="range-labels">
                  <span>Радиус якоря</span>
                  <strong>{{ pipelineConfig.maxDriftM }} м</strong>
                </div>
                <input
                  v-model.number="pipelineConfig.maxDriftM"
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                >
              </div>
            </div>
          </div>

          <!-- Step 3: Stationary Merge -->
          <div class="config-card">
            <label class="switch-row">
              <input
                v-model="pipelineConfig.mergeStationary"
                type="checkbox"
              >
              <span class="step-num">3</span>
              <span class="switch-label">Схлопывание стоянок</span>
            </label>
            <div
              v-if="pipelineConfig.mergeStationary"
              class="card-controls"
            >
              <div class="range-field">
                <div class="range-labels">
                  <span>Дистанция скопления</span>
                  <strong>{{ pipelineConfig.maxDistanceM }} м</strong>
                </div>
                <input
                  v-model.number="pipelineConfig.maxDistanceM"
                  type="range"
                  min="2"
                  max="20"
                  step="1"
                >
              </div>
            </div>
          </div>

          <!-- Step 4: Stays Detection -->
          <div class="config-card">
            <label class="switch-row">
              <input
                v-model="pipelineConfig.collapseStays"
                type="checkbox"
              >
              <span class="step-num">4</span>
              <span class="switch-label">Детекция стоянок (TrackStop)</span>
            </label>
          </div>

          <!-- Step 5: RDP Simplification -->
          <div class="config-card">
            <label class="switch-row">
              <input
                v-model="pipelineConfig.simplifyRdp"
                type="checkbox"
              >
              <span class="step-num">5</span>
              <span class="switch-label">RDP Упрощение геометрии</span>
            </label>
            <div
              v-if="pipelineConfig.simplifyRdp"
              class="card-controls"
            >
              <div class="range-field">
                <div class="range-labels">
                  <span>Порог точности (ε)</span>
                  <strong>{{ pipelineConfig.epsilonM }} м</strong>
                </div>
                <input
                  v-model.number="pipelineConfig.epsilonM"
                  type="range"
                  min="0.5"
                  max="25"
                  step="0.5"
                >
              </div>
            </div>
          </div>

          <!-- Step 6: Catmull-Rom Spline -->
          <div class="config-card">
            <label class="switch-row">
              <input
                v-model="pipelineConfig.smoothSpline"
                type="checkbox"
              >
              <span class="step-num">6</span>
              <span class="switch-label">Catmull-Rom Сплайн</span>
            </label>
            <div
              v-if="pipelineConfig.smoothSpline"
              class="card-controls"
            >
              <div class="range-field">
                <div class="range-labels">
                  <span>Сгущение сегмента</span>
                  <strong>{{ pipelineConfig.subdivPerSegment }}x</strong>
                </div>
                <input
                  v-model.number="pipelineConfig.subdivPerSegment"
                  type="range"
                  min="2"
                  max="10"
                  step="1"
                >
              </div>
            </div>
          </div>

          <!-- Step 7: Activity Classification -->
          <div class="config-card">
            <label class="switch-row">
              <input
                v-model="pipelineConfig.segmentDayTrack"
                type="checkbox"
              >
              <span class="step-num">7</span>
              <span class="switch-label">Классификация дня (Day Track)</span>
            </label>
          </div>
        </div>

        <!-- Section: Map Layer Toggles -->
        <div class="sidebar-section">
          <div class="section-title">
            <div class="title-with-icon">
              <Icon icon="lucide:layers" />
              <span>Слои карты</span>
            </div>
          </div>
          <div class="layers-grid">
            <label class="layer-item">
              <input
                v-model="layerToggles.showRaw"
                type="checkbox"
              >
              <span
                class="layer-badge"
                style="background: #ef4444;"
              />
              <span>Сырые точки ({{ rawPoints.length }})</span>
            </label>
            <label class="layer-item">
              <input
                v-model="layerToggles.showProcessed"
                type="checkbox"
              >
              <span
                class="layer-badge"
                style="background: #10b981;"
              />
              <span>Обработанные ({{ processedPoints.length }})</span>
            </label>
            <label class="layer-item">
              <input
                v-model="layerToggles.showSpline"
                type="checkbox"
              >
              <span
                class="layer-badge"
                style="background: #38bdf8;"
              />
              <span>Сплайн линия</span>
            </label>
            <label class="layer-item">
              <input
                v-model="layerToggles.showOutliers"
                type="checkbox"
              >
              <span
                class="layer-badge"
                style="background: #f43f5e;"
              />
              <span>Выбросы ({{ outliersList.length }})</span>
            </label>
            <label class="layer-item">
              <input
                v-model="layerToggles.showStays"
                type="checkbox"
              >
              <span
                class="layer-badge"
                style="background: #6366f1;"
              />
              <span>Стоянки ({{ staysList.length }})</span>
            </label>
          </div>
        </div>
      </aside>

      <!-- Center Content: Metrics + Map + Bottom Tabs -->
      <main class="main-content">
        <!-- Top KPI Metrics Ribbon -->
        <div class="metrics-ribbon">
          <div class="metric-card">
            <span class="metric-label">Сжатие точек</span>
            <div class="metric-value">
              <strong>{{ rawPoints.length }}</strong>
              <Icon
                icon="lucide:arrow-right"
                class="arrow-icon"
              />
              <strong class="text-emerald">{{ processedPoints.length }}</strong>
              <span
                v-if="rawPoints.length > 0"
                class="compression-pill"
              >-{{ compressionRatio }}%</span>
            </div>
          </div>

          <div class="metric-card">
            <span class="metric-label">Дистанция трека</span>
            <div class="metric-value">
              <strong>{{ (processedDistanceM / 1000).toFixed(2) }} км</strong>
              <span class="metric-sub">исх: {{ (rawDistanceM / 1000).toFixed(2) }} км</span>
            </div>
          </div>

          <div class="metric-card">
            <span class="metric-label">Длительность</span>
            <div class="metric-value">
              <strong>{{ totalDurationFormatted }}</strong>
            </div>
          </div>

          <div class="metric-card">
            <span class="metric-label">Время обработки</span>
            <div class="metric-value">
              <strong class="text-sky">{{ processingTimeMs.toFixed(2) }} мс</strong>
              <span class="metric-sub">алгоритмы</span>
            </div>
          </div>

          <div class="metric-card">
            <span class="metric-label">Сегментов дня</span>
            <div class="metric-value">
              <strong>{{ segmentsList.length }}</strong>
              <span class="metric-sub">стоянок: {{ staysList.length }}</span>
            </div>
          </div>
        </div>

        <!-- Interactive Map -->
        <div class="map-wrapper">
          <TrackMap
            :raw-points="rawPoints"
            :processed-points="processedPoints"
            :segments="segmentsList"
            :outliers="outliersList"
            :stays="staysList"
            :spline-points="splinePoints"
            :highlighted-point="highlightedPoint"
            :show-raw="layerToggles.showRaw"
            :show-processed="layerToggles.showProcessed"
            :show-outliers="layerToggles.showOutliers"
            :show-stays="layerToggles.showStays"
            :show-spline="layerToggles.showSpline"
            @select-point="(pt) => highlightedPoint = pt"
          />
        </div>

        <!-- Bottom Detail Panel -->
        <div class="bottom-panel">
          <!-- Tab Headers -->
          <div class="panel-tabs">
            <button
              class="panel-tab"
              :class="{ active: activeBottomTab === 'chart' }"
              @click="activeBottomTab = 'chart'"
            >
              <Icon icon="lucide:activity" />
              <span>Профиль скорости и высоты</span>
            </button>
            <button
              class="panel-tab"
              :class="{ active: activeBottomTab === 'segments' }"
              @click="activeBottomTab = 'segments'"
            >
              <Icon icon="lucide:layers" />
              <span>Сегменты активностей ({{ segmentsList.length }})</span>
            </button>
            <button
              class="panel-tab"
              :class="{ active: activeBottomTab === 'stays' }"
              @click="activeBottomTab = 'stays'"
            >
              <Icon icon="lucide:map-pin" />
              <span>Стоянки и остановки ({{ staysList.length }})</span>
            </button>
            <button
              class="panel-tab"
              :class="{ active: activeBottomTab === 'json' }"
              @click="activeBottomTab = 'json'"
            >
              <Icon icon="lucide:code" />
              <span>Данные JSON</span>
            </button>
          </div>

          <!-- Tab Content 1: Speed & Altitude Profile Chart -->
          <div
            v-if="activeBottomTab === 'chart'"
            class="tab-body"
          >
            <SpeedAltitudeChart
              :points="processedPoints"
              :segments="segmentsList"
              @hover-point="(pt) => highlightedPoint = pt"
            />
          </div>

          <!-- Tab Content 2: Segments Table -->
          <div
            v-if="activeBottomTab === 'segments'"
            class="tab-body table-scroll"
          >
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Активность</th>
                  <th>Точек</th>
                  <th>Достоверность</th>
                  <th>Медианная скорость</th>
                  <th>p90 Скорость</th>
                  <th>Вариация cV</th>
                  <th>Дистанция</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(seg, idx) in segmentsList"
                  :key="idx"
                >
                  <td class="idx-col">
                    {{ idx + 1 }}
                  </td>
                  <td>
                    <span
                      class="activity-badge"
                      :style="{ backgroundColor: `${activityColors[seg.activity]}25`, color: activityColors[seg.activity], borderColor: activityColors[seg.activity] }"
                    >
                      {{ activityNames[seg.activity] || seg.activity }}
                    </span>
                  </td>
                  <td>{{ seg.points.length }}</td>
                  <td><strong>{{ seg.confidence }}%</strong></td>
                  <td>{{ seg.features.p50SpeedKmh.toFixed(1) }} км/ч</td>
                  <td>{{ seg.features.p90SpeedKmh.toFixed(1) }} км/ч</td>
                  <td>{{ seg.features.speedCv.toFixed(2) }}</td>
                  <td>{{ (seg.features.distanceM / 1000).toFixed(2) }} км</td>
                </tr>
                <tr v-if="segmentsList.length === 0">
                  <td
                    colspan="8"
                    class="empty-state"
                  >
                    Сегменты не сформированы. Включите шаг 7 в пайплайне слева.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tab Content 3: Stays Table -->
          <div
            v-if="activeBottomTab === 'stays'"
            class="tab-body table-scroll"
          >
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Координаты</th>
                  <th>Радиус</th>
                  <th>Замеров (samples)</th>
                  <th>Начало</th>
                  <th>Окончание</th>
                  <th>Длительность</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(stay, idx) in staysList"
                  :key="idx"
                >
                  <td class="idx-col">
                    {{ idx + 1 }}
                  </td>
                  <td class="mono">
                    {{ stay.lat.toFixed(5) }}, {{ stay.lng.toFixed(5) }}
                  </td>
                  <td><strong>{{ stay.radiusM.toFixed(1) }} м</strong></td>
                  <td>{{ stay.samplesCount }}</td>
                  <td class="mono">
                    {{ new Date(stay.startedAt).toLocaleTimeString() }}
                  </td>
                  <td class="mono">
                    {{ new Date(stay.endedAt).toLocaleTimeString() }}
                  </td>
                  <td>{{ Math.round((stay.endedAt - stay.startedAt) / 60000) }} мин</td>
                </tr>
                <tr v-if="staysList.length === 0">
                  <td
                    colspan="7"
                    class="empty-state"
                  >
                    Стоянки не обнаружены на текущем треке.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tab Content 4: JSON Inspector -->
          <div
            v-if="activeBottomTab === 'json'"
            class="tab-body json-view"
          >
            <div class="json-actions">
              <button
                class="copy-json-btn"
                @click="copyProcessedJson"
              >
                <Icon icon="lucide:copy" />
                <span>Копировать JSON точек</span>
              </button>
            </div>
            <pre class="json-code">{{ JSON.stringify(processedPoints.slice(0, 15), null, 2) }}
// ... и еще {{ Math.max(0, processedPoints.length - 15) }} точек</pre>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.playground-layout {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background-color: #090d16;
  color: #f1f5f9;
  overflow: hidden;
  font-family: 'Rubik', system-ui, sans-serif;
}

/* ─── Header ─────────────────────────────────────────────────────────────────── */
.app-header {
  height: 60px;
  background-color: #0f172a;
  border-bottom: 1px solid #1e293b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  gap: 16px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 24px;
  color: #38bdf8;
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.logo-title {
  font-weight: 700;
  font-size: 15px;
  color: #f8fafc;
  line-height: 1.2;
}

.logo-package {
  font-size: 11px;
  color: #64748b;
  font-family: 'JetBrains Mono', monospace;
}

.version-badge {
  background: #1e293b;
  color: #38bdf8;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
}

.header-presets {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding: 4px 0;
}

.preset-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #1e293b;
  border: 1px solid #334155;
  color: #94a3b8;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.preset-btn:hover {
  background: #334155;
  color: #f8fafc;
}

.preset-btn.active {
  background: #0284c7;
  border-color: #38bdf8;
  color: #ffffff;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #1e293b;
  border: 1px solid #334155;
  color: #cbd5e1;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #334155;
  color: #ffffff;
}

.upload-btn {
  position: relative;
}

.hidden-file-input {
  display: none;
}

.spike-btn {
  background: #3f152b;
  border-color: #f43f5e;
  color: #fca5a5;
}

.spike-btn:hover {
  background: #be123c;
  color: #ffffff;
}

/* ─── Body ───────────────────────────────────────────────────────────────────── */
.workbench-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ─── Sidebar ────────────────────────────────────────────────────────────────── */
.sidebar {
  width: 320px;
  background: #0d1322;
  border-right: 1px solid #1e293b;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex-shrink: 0;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.title-with-icon {
  display: flex;
  align-items: center;
  gap: 6px;
}

.reset-btn {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 2px;
}

.reset-btn:hover {
  color: #f8fafc;
}

.config-card {
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: 8px;
  padding: 10px 12px;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.step-num {
  background: #1e293b;
  color: #38bdf8;
  font-size: 10px;
  font-weight: 700;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.switch-label {
  font-size: 12px;
  font-weight: 500;
  color: #e2e8f0;
}

.card-controls {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #1f2937;
}

.range-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
}

.range-labels strong {
  color: #38bdf8;
  font-family: 'JetBrains Mono', monospace;
}

input[type='range'] {
  width: 100%;
  accent-color: #38bdf8;
}

.layers-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: 8px;
  padding: 10px 12px;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #cbd5e1;
  cursor: pointer;
}

.layer-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* ─── Main Content ───────────────────────────────────────────────────────────── */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #090d16;
}

/* ─── Metrics Ribbon ─────────────────────────────────────────────────────────── */
.metrics-ribbon {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #0d1322;
  border-bottom: 1px solid #1e293b;
  flex-shrink: 0;
  overflow-x: auto;
}

.metric-card {
  background: #111827;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 8px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 140px;
}

.metric-label {
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-value {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-family: 'JetBrains Mono', monospace;
}

.metric-sub {
  font-size: 11px;
  color: #64748b;
  font-family: 'Rubik', sans-serif;
}

.arrow-icon {
  font-size: 12px;
  color: #64748b;
}

.compression-pill {
  background: #064e3b;
  color: #34d399;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.text-emerald {
  color: #34d399;
}

.text-sky {
  color: #38bdf8;
}

/* ─── Map Wrapper ────────────────────────────────────────────────────────────── */
.map-wrapper {
  flex: 1;
  padding: 12px 16px 6px;
  min-height: 280px;
}

/* ─── Bottom Panel ───────────────────────────────────────────────────────────── */
.bottom-panel {
  height: clamp(280px, 32vh, 380px);
  background: #0d1322;
  border-top: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.panel-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 16px;
  background: #0a0f1d;
  border-bottom: 1px solid #1e293b;
}

.panel-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #94a3b8;
  padding: 8px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.panel-tab:hover {
  color: #f1f5f9;
}

.panel-tab.active {
  color: #38bdf8;
  border-bottom-color: #38bdf8;
  font-weight: 600;
}

.tab-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 8px 16px;
}

.table-scroll {
  overflow-y: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  text-align: left;
}

.data-table th {
  color: #94a3b8;
  font-weight: 500;
  padding: 6px 10px;
  border-bottom: 1px solid #1e293b;
  position: sticky;
  top: 0;
  background: #0d1322;
}

.data-table td {
  padding: 6px 10px;
  border-bottom: 1px solid #161f30;
  color: #cbd5e1;
}

.idx-col {
  color: #64748b;
  width: 30px;
}

.mono {
  font-family: 'JetBrains Mono', monospace;
}

.activity-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid;
  font-size: 11px;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  color: #64748b;
  padding: 24px;
}

.json-view {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
}

.json-actions {
  display: flex;
  justify-content: flex-end;
}

.copy-json-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #1e293b;
  border: 1px solid #334155;
  color: #cbd5e1;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.copy-json-btn:hover {
  background: #334155;
  color: #ffffff;
}

.json-code {
  flex: 1;
  background: #080c14;
  border: 1px solid #1e293b;
  border-radius: 6px;
  padding: 10px;
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #38bdf8;
  overflow: auto;
}

/* ─── Toast ──────────────────────────────────────────────────────────────────── */
.toast-notification {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999;
  background: #0284c7;
  color: #ffffff;
  padding: 10px 18px;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.25s,
    transform 0.25s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
