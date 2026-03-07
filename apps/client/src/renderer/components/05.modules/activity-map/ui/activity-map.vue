<script setup lang="ts">
import type { MapBounds } from '../models/types'
import type { MapMarker } from '~/components/01.kit/kit-map'
import type { CreateMarkInput } from '~/shared/types/models/mark'
import { toLonLat } from 'ol/proj'
import { useToast } from '~/shared/composables/use-toast'
import { useActivityUrlState } from '../composables/use-activity-url-state'
import { useActivityMapStore } from '../store/activity-map.store'
import ActivityCreateDialog from './dialogs/activity-create-dialog.vue'
import ActivityListView from './list/activity-list-view.vue'
import ActivityMapView from './map/activity-map-view.vue'

export type ActivityStatus = 'upcoming' | 'active' | 'past' | 'static'

export interface ActivityItem {
  id: string
  title: string
  description: string
  isStatic: boolean
  status: ActivityStatus
  date: string
  startIso?: string
  endIso?: string
  coords: [number, number]
  durationHours: number
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

function determineStatus(startAt: string | undefined, endAt: string, isStatic: boolean): ActivityStatus {
  if (isStatic)
    return 'static'

  const now = Date.now()
  const start = startAt ? new Date(startAt).getTime() : new Date(endAt).getTime() - 1000 * 60 * 60 * 24
  const end = new Date(endAt).getTime()

  if (now < start)
    return 'upcoming'
  if (now >= start && now <= end)
    return 'active'
  return 'past'
}

const activities = computed<ActivityItem[]>(() => {
  return marks.value.map((mark) => {
    const isStatic = mark.duration === 0 || !mark.duration
    return {
      id: String(mark.id),
      title: mark.markName,
      description: mark.additionalInfo || '',
      isStatic,
      status: determineStatus(mark.startAt, mark.endAt, isStatic),
      date: mark.startAt ? new Date(mark.startAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : new Date(mark.endAt).toLocaleDateString('ru-RU'),
      startIso: mark.startAt,
      endIso: mark.endAt,
      coords: mark.geom.coordinates,
      durationHours: mark.duration || 0,
    }
  })
})

const mapMarkers = computed<MapMarker[]>(() => {
  return activities.value.map(act => ({
    id: act.id,
    coords: { lon: act.coords[0], lat: act.coords[1] },
    payload: act,
  }))
})

function handleModeChange(newMode: 'list' | 'map') {
  viewMode.value = newMode
}

function handleMapClick(coords: [number, number]) {
  // Убрано автоматическое открытие при клике. Оставлено для контекстного меню.
}

function handleContextMenu(coords: [number, number]) {
  createFormCoords.value = coords
  isCreateDialogOpen.value = true
}

interface CreatePayload {
  title: string
  description: string
  isStatic: boolean
  startAt: string
  endAt: string
  coords: [number, number] | null
}

function mapDurationToAllowedValue(hours: number): number {
  if (hours <= 0)
    return 0
  const allowedDurations = [12, 24, 36, 48]
  const closest = allowedDurations.reduce((prev, curr) => {
    return (Math.abs(curr - hours) < Math.abs(prev - hours) ? curr : prev)
  })
  return closest
}

async function handleCreate(data: CreatePayload) {
  if (!createFormCoords.value && !data.coords)
    return

  const coords = data.coords || createFormCoords.value

  let mappedDuration = 0
  let startIso = data.startAt

  if (!data.isStatic) {
    const start = new Date(data.startAt)
    const end = new Date(data.endAt)
    const diffMs = end.getTime() - start.getTime()
    const durationHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)))
    mappedDuration = mapDurationToAllowedValue(durationHours)
  }
  else {
    // Если статика, делаем вид, что начинается сейчас и длится 0 (бесконечно)
    startIso = new Date().toISOString()
  }

  if (coords) {
    const lonLatCoords = toLonLat(coords)
    const input: CreateMarkInput = {
      markName: data.title,
      additionalInfo: data.description,
      duration: mappedDuration,
      latitude: lonLatCoords[1],
      longitude: lonLatCoords[0],
      categoryId: data.isStatic ? 2 : 1, // Допустим 2 - это POI
      startAt: startIso,
    }

    try {
      await store.createMark(input)
      isCreateDialogOpen.value = false
      createFormCoords.value = null
      toast.success(data.isStatic ? 'Место сохранено' : 'Событие добавлено')
    }
    catch {
      toast.error('Ошибка при создании активности')
    }
  }
}

async function handleDelete(id: string) {
  toast.warn(`Удаление в разработке. ID: ${id}`)
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
  setMapPosition(coords[1], coords[0], 15)
}

watch(
  dateRange,
  (newRange) => {
    store.dateRange = newRange
    store.fetchMarks()
  },
  { deep: true, immediate: true },
)

watch(
  viewMode,
  (newMode) => {
    emit('modeChange', newMode)
  },
  { immediate: true },
)

onMounted(() => {
  store.fetchMarks()
})
</script>

<template>
  <div class="activity-module">
    <div v-if="viewMode === 'list'" class="header-actions">
      <KitBtn icon="mdi:plus" @click="isCreateDialogOpen = true">
        Создать метку
      </KitBtn>
    </div>

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
      @context-menu="handleContextMenu"
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
  display: flex;
  flex-direction: column;
}
.header-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}
</style>
