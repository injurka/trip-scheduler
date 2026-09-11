<script setup lang="ts">
import type { useGeolocationMap } from '~/components/03.domain/trip-info/geolocation-section/composables/use-geolocation-map'
import type { ActivitySectionGeolocation, MapPoint, MapRoute } from '~/components/03.domain/trip-info/geolocation-section/models/types'
import type { IDay } from '~/components/04.features/trip-info/trip-plan/models/types'

import { Icon } from '@iconify/vue'
import { useFullscreen, useMediaQuery } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import GeolocationMap from '~/components/03.domain/trip-info/geolocation-section/ui/geolocation-map.vue'
import { timeToMinutes } from '~/shared/lib/date-time'
import { EActivitySectionType } from '~/shared/types/models/activity'
import { TripMapDetailsItem } from './details'
import TripMapSidebarItem from './trip-map-sidebar-item.vue'

interface Props {
  days: IDay[]
}
const props = defineProps<Props>()

const mapSectionWrapperRef = ref<HTMLElement | null>(null)
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(mapSectionWrapperRef)

const mapController = ref<ReturnType<typeof useGeolocationMap>>()
const selectedDayId = ref('all')
const selectedItemId = ref<string | null>(null)

const isSmallScreen = useMediaQuery('(max-width: 1200px)')
const isLargeScreen = useMediaQuery('(min-width: 1920px)')

const isSidebarVisible = ref(!isSmallScreen.value)
const sidebarWidth = ref(320)
const isSidebarResizing = ref(false)

function startSidebarResize(e: MouseEvent) {
  isSidebarResizing.value = true
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  const doResize = (moveEvent: MouseEvent) => {
    if (!isSidebarResizing.value)
      return
    const newWidth = startWidth + (moveEvent.clientX - startX)
    if (newWidth > 200 && newWidth < 600) {
      sidebarWidth.value = newWidth
    }
  }

  const stopResize = () => {
    isSidebarResizing.value = false
    document.removeEventListener('mousemove', doResize)
    document.removeEventListener('mouseup', stopResize)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const detailsPanelSize = ref(isLargeScreen ? 600 : 300)
const isDetailsResizing = ref(false)

function startDetailsResize(e: MouseEvent) {
  isDetailsResizing.value = true
  const startX = e.clientX
  const startY = e.clientY
  const startSize = detailsPanelSize.value
  const isSideMode = isLargeScreen.value

  const doResize = (moveEvent: MouseEvent) => {
    if (!isDetailsResizing.value)
      return

    if (isSideMode) {
      const diff = startX - moveEvent.clientX
      const newWidth = startSize + diff
      if (newWidth > 300 && newWidth < 1000) {
        detailsPanelSize.value = newWidth
      }
    }
    else {
      const diff = startY - moveEvent.clientY
      const newHeight = startSize + diff
      if (newHeight > 150 && newHeight < 600) {
        detailsPanelSize.value = newHeight
      }
    }
  }

  const stopResize = () => {
    isDetailsResizing.value = false
    document.removeEventListener('mousemove', doResize)
    document.removeEventListener('mouseup', stopResize)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = isSideMode ? 'col-resize' : 'row-resize'
  document.body.style.userSelect = 'none'
}

interface TimelineItem {
  item: MapPoint | MapRoute
  type: 'point' | 'route'
}

interface TimelineActivity {
  id: string
  dayNumber: number
  dayTitle: string
  title: string
  startTime: string
  endTime: string
  items: TimelineItem[]
}

const dayOptions = computed(() => {
  const options: any[] = [{ value: 'all', label: 'Все дни', dayNumber: null }]
  props.days.forEach((day, index) => {
    options.push({ value: day.id, label: day.title || `День ${index + 1}`, dayNumber: index + 1 })
  })
  return options
})

const allGeoSections = computed(() => {
  const sections: { section: any, dayId: string, activityId: string, activityTitle: string }[] = []
  props.days.forEach((day) => {
    day.activities.forEach((activity) => {
      activity.sections?.forEach((section) => {
        if (section.type === EActivitySectionType.GEOLOCATION) {
          sections.push({ section, dayId: day.id, activityId: activity.id, activityTitle: activity.title })
        }
      })
    })
  })
  return sections
})

const allPoints = computed(() => allGeoSections.value.flatMap(s => s.section.points.map((p: any) => ({ ...p, dayId: s.dayId }))))
const allRoutes = computed(() => allGeoSections.value.flatMap(s => s.section.routes.map((r: any) => ({ ...r, dayId: s.dayId }))))

const filteredPoints = computed(() => selectedDayId.value === 'all' ? allPoints.value : allPoints.value.filter(p => p.dayId === selectedDayId.value))
const filteredRoutes = computed(() => selectedDayId.value === 'all' ? allRoutes.value : allRoutes.value.filter(r => r.dayId === selectedDayId.value))

const timelineActivities = computed<TimelineActivity[]>(() => props.days.flatMap((day, dayIndex) => {
  if (selectedDayId.value !== 'all' && day.id !== selectedDayId.value)
    return []

  return [...day.activities]
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
    .map((activity) => {
      const geoSections = activity.sections?.filter((section): section is ActivitySectionGeolocation => section.type === EActivitySectionType.GEOLOCATION) ?? []
      const items = geoSections.flatMap((section): TimelineItem[] => [
        ...section.points.map(point => ({ item: point, type: 'point' as const })),
        ...section.routes.flatMap(route => [
          { item: route, type: 'route' as const },
          ...route.points.map(point => ({ item: point, type: 'point' as const })),
        ]),
      ])

      return {
        id: activity.id,
        dayNumber: dayIndex + 1,
        dayTitle: day.title || `День ${dayIndex + 1}`,
        title: activity.title,
        startTime: activity.startTime,
        endTime: activity.endTime,
        items,
      }
    })
    .filter(activity => activity.items.length > 0)
}))

const selectedActivity = computed(() => {
  if (!selectedItemId.value)
    return null

  const geoSection = allGeoSections.value.find(s =>
    s.section.points.some((p: any) => p.id === selectedItemId.value)
    || s.section.routes.some((route: MapRoute) =>
      route.id === selectedItemId.value
      || route.points.some(point => point.id === selectedItemId.value),
    ),
  )

  if (!geoSection)
    return null

  const day = props.days.find(d => d.id === geoSection.dayId)
  return day?.activities.find(a => a.id === geoSection.activityId) || null
})

const detailsPanelStyle = computed(() => {
  const style: Record<string, string> = {}

  if (isLargeScreen.value) {
    style.width = `${detailsPanelSize.value}px`
  }
  else {
    style.height = `${detailsPanelSize.value}px`

    if (isSidebarVisible.value && !isSmallScreen.value) {
      style.left = `${sidebarWidth.value + 24}px`
    }
  }

  return style
})

const mapCenter = computed((): [number, number] => {
  if (allPoints.value.length > 0)
    return allPoints.value[0].coordinates
  const firstRoute = allRoutes.value[0]
  if (firstRoute?.geometry?.length)
    return firstRoute.geometry[0]
  if (firstRoute?.points?.length)
    return firstRoute.points[0].coordinates
  return [37.6176, 55.7558] // Moscow
})

const geolocationMapPoints = computed<MapPoint[]>(() => {
  const routePoints = filteredRoutes.value.flatMap(route =>
    route.points.map((point: { style: any }) => ({
      ...point,
      style: { ...point.style, color: route.color },
    })),
  )
  return [...filteredPoints.value, ...routePoints]
})
const geolocationMapRoutes = computed<MapRoute[]>(() => filteredRoutes.value)

function onMapReady(controller: ReturnType<typeof useGeolocationMap>) {
  mapController.value = controller
}

function handleMapClick(coords: [number, number]) {
  if (mapController.value?.mapInstance.value) {
    const map = mapController.value.mapInstance.value
    const point = map.project(coords)
    const features = map.queryRenderedFeatures([point.x, point.y])
    const routeFeature = features.find(f => f.properties?.id)
    if (routeFeature?.properties?.id) {
      selectedItemId.value = routeFeature.properties.id
    }
    else {
      selectedItemId.value = mapController.value.activePointId.value ?? null
    }
  }
}

function focusOnItem(item: MapPoint | MapRoute) {
  selectedItemId.value = item.id
  if ('coordinates' in item) { // MapPoint
    mapController.value?.flyToLocation(item.coordinates[0], item.coordinates[1], 16)
  }
  else if ('geometry' in item) { // MapRoute
    const start = item.geometry?.[0] || item.points[0]?.coordinates
    if (start)
      mapController.value?.flyToLocation(start[0], start[1], 14)
  }

  if (isSmallScreen.value) {
    isSidebarVisible.value = false
  }
}
</script>

<template>
  <div ref="mapSectionWrapperRef" class="trip-map-section-wrapper" :class="{ 'is-fullscreen': isFullscreen }">
    <div class="trip-map-section">
      <main class="map-view">
        <Transition name="slide-left">
          <aside
            v-show="isSidebarVisible"
            class="sidebar"
            :style="{ width: !isSmallScreen ? `${sidebarWidth}px` : undefined }"
          >
            <div class="resizer sidebar-resizer" @mousedown.prevent="startSidebarResize" />

            <div class="sidebar-header">
              <KitSelectWithSearch
                v-model="selectedDayId"
                :items="dayOptions"
                :clearable="false" size="sm"
              >
                <template #item="{ item }">
                  <div class="day-option-content">
                    <div v-if="(item as any).dayNumber" class="day-number-badge">
                      {{ (item as any).dayNumber }}
                    </div>
                    <span>{{ item.label }}</span>
                  </div>
                </template>
              </KitSelectWithSearch>
              <KitBtn
                variant="text"
                size="sm"
                icon="mdi:chevron-left"
                title="Скрыть панель"
                class="close-sidebar-btn"
                @click="isSidebarVisible = false"
              />
            </div>
            <div class="sidebar-content">
              <div v-if="timelineActivities.length > 0" class="timeline-list">
                <section v-for="activity in timelineActivities" :key="activity.id" class="timeline-activity">
                  <p v-if="selectedDayId === 'all'" class="timeline-day">
                    День {{ activity.dayNumber }} · {{ activity.dayTitle }}
                  </p>
                  <div class="timeline-activity-header">
                    <span class="timeline-time">{{ activity.startTime }}–{{ activity.endTime }}</span>
                    <span class="timeline-title">{{ activity.title }}</span>
                  </div>
                  <div class="timeline-items">
                    <TripMapSidebarItem
                      v-for="entry in activity.items"
                      :key="`${entry.type}-${entry.item.id}`"
                      :item="entry.item"
                      :type="entry.type"
                      :active="selectedItemId === entry.item.id"
                      @click="focusOnItem(entry.item)"
                    />
                  </div>
                </section>
              </div>
              <div v-else class="empty-state">
                <Icon icon="mdi:map-marker-off-outline" />
                <p>Нет данных для отображения.</p>
              </div>
            </div>
          </aside>
        </Transition>

        <KitBtn
          v-show="!isSidebarVisible"
          class="sidebar-open-btn"
          icon="mdi:menu"
          variant="solid"
          color="secondary"
          title="Показать список"
          @click="isSidebarVisible = true"
        />

        <GeolocationMap
          :is-loading="false"
          :points="geolocationMapPoints"
          :routes="geolocationMapRoutes"
          use-static-renderer
          :readonly="true"
          :interactive-on-click="true"
          :center="mapCenter"
          height="100%"
          mode="pan"
          :with-panel="false"
          :is-fullscreen="isFullscreen"
          :active-item-id="selectedItemId"
          @map-ready="onMapReady"
          @map-click="handleMapClick"
          @toggle-fullscreen="toggleFullscreen"
        />

        <Transition name="slide-up">
          <div
            v-if="selectedActivity"
            class="details-panel"
            :class="{ 'is-side-panel': isLargeScreen }"
            :style="detailsPanelStyle"
          >
            <div class="resizer details-resizer" @mousedown.prevent="startDetailsResize" />

            <div class="details-header">
              <h4>Активность: {{ selectedActivity.title }}</h4>
              <KitBtn icon="mdi:close" variant="text" size="sm" @click="selectedItemId = null" />
            </div>
            <div class="details-content">
              <TripMapDetailsItem :activity="selectedActivity" />
            </div>
          </div>
        </Transition>
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.trip-map-section-wrapper {
  display: flex;
  justify-content: center;
  width: 100%;
  position: relative;
  z-index: 6;
}

.is-fullscreen {
  position: fixed;
  top: var(--safe-area-inset-top) !important;
  left: 0;
  width: 100vw;
  height: calc(100vh - var(--safe-area-inset-top)) !important;
  z-index: 100;
  padding: 0;
  background-color: var(--bg-primary-color);
}

.trip-map-section {
  width: 100%;
  position: relative;
  display: flex;
  flex-direction: column;

  .is-fullscreen & {
    max-width: 100%;
  }
}

.map-view {
  position: relative;
  width: 100%;
  height: 100%;
  flex: 1;
  background-color: var(--bg-primary-color);
  overflow: hidden;
}

.sidebar {
  position: absolute;
  top: 12px;
  left: 12px;
  bottom: 12px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background-color: rgba(var(--bg-secondary-color-rgb), 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
  box-shadow: var(--s-l);
  min-width: 200px;
  max-width: 80vw;
}

.resizer {
  position: absolute;
  z-index: 21;
  background-color: transparent;
  transition: background-color 0.2s;

  &:hover,
  &:active {
    background-color: var(--primary-color);
    opacity: 0.5;
  }
}

.sidebar-resizer {
  top: 0;
  right: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
}

.sidebar-header {
  padding: 8px;
  border-bottom: 1px solid var(--border-secondary-color);
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;

  :deep(.kit-select-with-search) {
    flex-grow: 1;
    min-width: 0;
  }
  :deep(.dropdown-panel) {
    width: calc(50vh);
    max-width: calc(50vh);
    max-height: calc(50vh);
  }
  :deep(.day-option-content) {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.day-number-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}

.close-sidebar-btn {
  flex-shrink: 0;
  color: var(--fg-secondary-color);
  &:hover {
    color: var(--fg-primary-color);
  }
}

.sidebar-open-btn {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 7;
  box-shadow: var(--s-m);
}

.sidebar-content {
  padding: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-primary-color);
    border-radius: 4px;
  }
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timeline-activity {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: var(--r-s);
  background-color: rgba(var(--bg-tertiary-color-rgb), 0.45);
  border: 1px solid var(--border-secondary-color);
}

.timeline-day {
  margin: 0 0 2px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-tertiary-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.timeline-activity-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.timeline-time {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--fg-accent-color);
}

.timeline-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.timeline-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.details-panel {
  position: absolute;
  background-color: rgba(var(--bg-secondary-color-rgb), 0.9);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  box-shadow: var(--s-xl);
  z-index: 15;
  display: flex;
  flex-direction: column;

  bottom: 12px;
  left: 12px;
  right: 12px;
  max-height: 60%;

  .details-resizer {
    top: 0;
    left: 0;
    width: 100%;
    height: 5px;
    cursor: row-resize;
  }

  &.is-side-panel {
    top: 12px;
    bottom: 12px;
    right: 12px;
    left: auto !important;
    max-height: 100%;

    .details-resizer {
      top: 0;
      left: 0;
      width: 5px;
      height: 100%;
      cursor: col-resize;
    }
  }

  .details-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 8px 8px 16px;
    border-bottom: 1px solid var(--border-secondary-color);
    flex-shrink: 0;

    h4 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .details-content {
    overflow-y: auto;
    padding: 1rem;
    flex: 1;
  }
}

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--fg-tertiary-color);
  display: flex;
  flex-direction: column;
  align-items: center;

  .iconify {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
    opacity: 0.7;
  }

  p {
    margin: 0;
    font-size: 0.85rem;
  }
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
}
.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (max-width: 1200px) {
  .resizer {
    display: none !important;
  }
  .sidebar {
    width: 320px !important;
  }
  .details-panel {
    height: auto !important;
    max-height: 40%;
  }
}

@media (max-width: 768px) {
  .trip-map-section-wrapper {
    padding: 0;
  }
  .map-view {
    border-radius: 0;
    border: none;
  }
  .sidebar {
    width: calc(100% - 60px) !important;
    max-height: 100%;
  }
  .details-panel {
    left: 12px !important;
  }
}
</style>
