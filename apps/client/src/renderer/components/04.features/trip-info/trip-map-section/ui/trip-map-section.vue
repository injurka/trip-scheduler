<script setup lang="ts">
import type { FeatureLike } from 'ol/Feature'

import type { useGeolocationMap } from '~/components/03.domain/trip-info/plan-geolocation-section/composables/use-geolocation-map'
import type { DrawnRoute, MapPoint, MapRoute } from '~/components/03.domain/trip-info/plan-geolocation-section/models/types'
import type { IDay } from '~/components/04.features/trip-info/trip-plan/models/types'

import { Icon } from '@iconify/vue'
import { useFullscreen, useMediaQuery } from '@vueuse/core'
import { fromLonLat } from 'ol/proj'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import GeolocationMap from '~/components/03.domain/trip-info/plan-geolocation-section/ui/geolocation-map.vue'
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
const isSidebarVisible = ref(!isSmallScreen.value)

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
const allDrawnRoutes = computed(() => allGeoSections.value.flatMap(s => s.section.drawnRoutes.map((dr: any) => ({ ...dr, dayId: s.dayId }))))

const filteredPoints = computed(() => selectedDayId.value === 'all' ? allPoints.value : allPoints.value.filter(p => p.dayId === selectedDayId.value))
const filteredRoutes = computed(() => selectedDayId.value === 'all' ? allRoutes.value : allRoutes.value.filter(r => r.dayId === selectedDayId.value))
const filteredDrawnRoutes = computed(() => selectedDayId.value === 'all' ? allDrawnRoutes.value : allDrawnRoutes.value.filter(dr => dr.dayId === selectedDayId.value))

const selectedActivity = computed(() => {
  if (!selectedItemId.value)
    return null

  const geoSection = allGeoSections.value.find(s =>
    s.section.points.some((p: any) => p.id === selectedItemId.value)
    || s.section.routes.some((r: any) => r.id === selectedItemId.value)
    || s.section.drawnRoutes.some((dr: any) => dr.id === selectedItemId.value),
  )

  if (!geoSection)
    return null

  const day = props.days.find(d => d.id === geoSection.dayId)
  return day?.activities.find(a => a.id === geoSection.activityId) || null
})

const mapCenter = computed((): [number, number] => {
  if (allPoints.value.length > 0)
    return allPoints.value[0].coordinates
  if (allRoutes.value.length > 0 && allRoutes.value[0].geometry)
    return allRoutes.value[0].geometry[0]
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
const geolocationMapDrawnRoutes = computed<DrawnRoute[]>(() => filteredDrawnRoutes.value)

function onMapReady(controller: ReturnType<typeof useGeolocationMap>) {
  mapController.value = controller
}

function handleMapClick(coords: [number, number]) {
  if (mapController.value?.mapInstance.value) {
    const feature = mapController.value.mapInstance.value.forEachFeatureAtPixel(
      mapController.value.mapInstance.value.getPixelFromCoordinate(fromLonLat(coords)),
      (f: FeatureLike) => f,
      { hitTolerance: 5 },
    )
    selectedItemId.value = feature ? (feature.getId() as string) : null
  }
}

function focusOnItem(item: MapPoint | MapRoute | DrawnRoute) {
  selectedItemId.value = item.id
  if ('coordinates' in item) { // MapPoint
    mapController.value?.flyToLocation(item.coordinates[0], item.coordinates[1], 16)
  }
  else if ('geometry' in item && item.geometry && item.geometry.length > 0) { // MapRoute
    mapController.value?.flyToLocation(item.geometry[0][0], item.geometry[0][1], 14)
  }
  else if ('segments' in item && item.segments.length > 0 && item.segments[0].length > 0) { // DrawnRoute
    mapController.value?.flyToLocation(item.segments[0][0][0], item.segments[0][0][1], 14)
  }

  // На мобильных закрываем сайдбар после выбора
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
          <aside v-show="isSidebarVisible" class="sidebar">
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
              <div v-if="filteredPoints.length > 0 || filteredRoutes.length > 0 || filteredDrawnRoutes.length > 0">
                <div v-if="filteredPoints.length > 0" class="items-group">
                  <h4 class="group-title">
                    Точки интереса
                  </h4>
                  <TripMapSidebarItem v-for="point in filteredPoints" :key="point.id" :item="point" type="point" @click="focusOnItem(point)" />
                </div>
                <div v-if="filteredRoutes.length > 0" class="items-group">
                  <h4 class="group-title">
                    Маршруты
                  </h4>
                  <div v-for="route in filteredRoutes" :key="route.id" class="route-group-in-sidebar">
                    <TripMapSidebarItem :item="route" type="route" @click="focusOnItem(route)" />
                    <div class="route-points-list">
                      <TripMapSidebarItem v-for="point in route.points" :key="point.id" :item="point" type="point" @click="focusOnItem(point)" />
                    </div>
                  </div>
                </div>
                <div v-if="filteredDrawnRoutes.length > 0" class="items-group">
                  <h4 class="group-title">
                    Нарисованные маршруты
                  </h4>
                  <TripMapSidebarItem v-for="route in filteredDrawnRoutes" :key="route.id" :item="route" type="route" @click="focusOnItem(route)" />
                </div>
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
          :drawn-routes="geolocationMapDrawnRoutes"
          :readonly="true"
          :interactive-on-click="true"
          :center="mapCenter"
          height="100%"
          mode="pan"
          :with-panel="false"
          :is-fullscreen="isFullscreen"
          @map-ready="onMapReady"
          @map-click="handleMapClick"
          @toggle-fullscreen="toggleFullscreen"
        />

        <Transition name="slide-up">
          <div v-if="selectedActivity" class="details-panel" :class="{ 'sidebar-open': isSidebarVisible && !isSmallScreen }">
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
  height: calc(100vh - 180px);
  padding-bottom: 16px;
  position: relative;
}

.is-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 100;
  padding: 0;
  background-color: var(--bg-primary-color);
}

.trip-map-section {
  width: 100%;
  height: 100%;
  position: relative;

  .is-fullscreen & {
    max-width: 100%;
  }
}

.map-view {
  position: relative;
  width: 100%;
  height: 100%;
}

.sidebar {
  position: absolute;
  top: 12px;
  left: 12px;
  bottom: 12px;
  width: 320px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background-color: rgba(var(--bg-secondary-color-rgb), 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
  overflow: hidden;
  box-shadow: var(--s-l);
}

.sidebar-header {
  padding: 8px;
  border-bottom: 1px solid var(--border-secondary-color);
  display: flex;
  gap: 8px;
  align-items: center;

  :deep(.kit-select-with-search) {
    flex-grow: 1;
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
  z-index: 15;
  box-shadow: var(--s-m);
}

.sidebar-content {
  padding: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;

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

.items-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.route-group-in-sidebar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
}

.route-points-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 12px;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 4px;
    height: 90%;
    width: 1px;
    border-left: 2px solid var(--border-secondary-color);
  }
}

.group-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-tertiary-color);
  text-transform: uppercase;
  margin: 0 0 4px 8px;
  letter-spacing: 0.5px;
}

.details-panel {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  background-color: rgba(var(--bg-secondary-color-rgb), 0.9);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  box-shadow: var(--s-xl);
  z-index: 15;
  max-height: 40%;
  display: flex;
  flex-direction: column;
  transition: left 0.3s ease;

  &.sidebar-open {
    left: calc(320px + 24px);
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

// Анимации
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

@media (max-width: 768px) {
  .trip-map-section-wrapper {
    padding: 0;
    height: calc(100vh - 130px);
  }
  .map-view {
    border-radius: 0;
    border: none;
  }
  .sidebar {
    width: calc(100% - 60px);
    max-height: 100%;
  }
  .details-panel {
    &.sidebar-open {
      left: 12px;
    }
  }
}
</style>
