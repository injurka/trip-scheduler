<script setup lang="ts">
import type { MapBounds } from '../models/types'
import type { MapMarker } from '~/components/01.kit/kit-map'
import type { CreateMarkInput } from '~/shared/types/models/mark'
import { storeToRefs } from 'pinia'
import { useToast } from '~/shared/composables/use-toast'
import { useActivityUrlState } from '../composables/use-activity-url-state'
import { useActivityMapStore } from '../store/activity-map.store'
import ActivityCreateDialog from './dialogs/activity-create-dialog.vue'
import ActivityListView from './list/activity-list-view.vue'
import ActivityMapView from './map/activity-map-view.vue'

export interface ActivityItem {
  id: string
  title: string
  description: string
  date: string
  coords: [number, number]
  duration: string
}

const emit = defineEmits<{
  (e: 'modeChange', mode: 'list' | 'map'): void
}>()

const toast = useToast()
const store = useActivityMapStore()

const { marks, isCreating } = storeToRefs(store)

const viewMode = ref<'list' | 'map'>('list')
const isCreateDialogOpen = ref(false)
const createFormCoords = ref<[number, number] | null>(null)

const {
  dateRange,
  mapCenterView,
  mapZoomView,
  setMapPosition,
} = useActivityUrlState({
  defaultCenter: [37.6176, 55.7558],
  defaultZoom: 10,
  viewMode,
})

const activities = computed<ActivityItem[]>(() => {
  return marks.value.map(mark => ({
    id: String(mark.id),
    title: mark.markName,
    description: mark.additionalInfo || '',
    date: new Date(mark.endAt).toLocaleDateString(),
    coords: mark.geom.coordinates,
    duration: '',
  }))
})

const mapMarkers = computed<MapMarker[]>(() => {
  return marks.value.map(mark => ({
    id: String(mark.id),
    coords: { lon: mark.geom.coordinates[0], lat: mark.geom.coordinates[1] },
    payload: mark,
  }))
})

function handleModeChange(newMode: 'list' | 'map') {
  viewMode.value = newMode
}

function handleMapClick(coords: [number, number]) {
  if (viewMode.value === 'map') {
    createFormCoords.value = coords
    isCreateDialogOpen.value = true
  }
}

async function handleCreate(data: any) {
  if (!createFormCoords.value && !data.coords)
    return

  const coords = data.coords || createFormCoords.value

  const input: CreateMarkInput = {
    markName: data.title,
    additionalInfo: data.description,
    duration: Number.parseInt(data.duration) || 24,
    latitude: coords[1],
    longitude: coords[0],
    categoryId: 1,
    startAt: new Date().toISOString(),
  }

  try {
    await store.createMark(input)
    isCreateDialogOpen.value = false
    createFormCoords.value = null
    toast.success('Активность добавлена')
  }
  catch {
    toast.error('Ошибка при создании активности')
  }
}

async function handleDelete(id: string) {
  toast.warn(`В разработке ${id}`)
}

function handleMapBoundsChange(bounds: MapBounds) {
  setMapPosition(
    bounds.screen.center.lat,
    bounds.screen.center.lon,
    bounds.zoomlevel,
  )

  store.fetchMarks(bounds)
}

function handleFocusItem(coords: [number, number]) {
  // Focus on the point and zoom in slightly
  setMapPosition(coords[1], coords[0], 14)
}

watch(
  dateRange,
  (newRange) => {
    store.dateRange = newRange
    store.fetchMarks()
  },
  { deep: true, immediate: true },
)

watch(viewMode, (newMode) => {
  emit('modeChange', newMode)
}, { immediate: true })

onMounted(() => {
  store.fetchMarks()
})
</script>

<template>
  <div class="activity-module">
    <ActivityListView
      v-if="viewMode === 'list'"
      v-model:date-range="dateRange"
      :activities="activities"
      @delete="handleDelete"
      @switch-to-map="handleModeChange('map')"
    />

    <ActivityMapView
      v-else
      v-model:date-range="dateRange"
      :center="mapCenterView"
      :zoom="mapZoomView"
      :activities="activities"
      :markers="mapMarkers"
      @switch-to-list="handleModeChange('list')"
      @map-click="handleMapClick"
      @bounds-change="handleMapBoundsChange"
      @focus-item="handleFocusItem"
    />

    <ActivityCreateDialog
      v-model:visible="isCreateDialogOpen"
      :initial-coords="createFormCoords"
      :is-loading="isCreating"
      @create="handleCreate"
    />
  </div>
</template>

<style scoped>
.activity-module {
  width: 100%;
  height: 100%;
}
</style>
