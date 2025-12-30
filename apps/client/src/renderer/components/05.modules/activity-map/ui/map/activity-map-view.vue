<script setup lang="ts">
import type { Map as OlMap } from 'ol'
import type { DateRange, MapBounds } from '../../models/types'
import type { ActivityItem } from '../activity-map.vue'
import type { MapMarker } from '~/components/01.kit/kit-map'
import { Icon } from '@iconify/vue'
import { toLonLat } from 'ol/proj'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitMap } from '~/components/01.kit/kit-map'
import { useActivityMapInteractions } from '../../composables/use-activity-map-interactions'
import ActivityFilters from '../controls/activity-filters.vue'

interface IProps {
  activities: ActivityItem[]
  markers: MapMarker[]
  center: [number, number]
  zoom?: number
}

const props = withDefaults(defineProps<IProps>(), {
  zoom: 10,
})

const emit = defineEmits<{
  (e: 'switchToList'): void
  (e: 'mapClick', coords: [number, number]): void
  (e: 'boundsChange', bounds: MapBounds): void
  (e: 'focusItem', coords: [number, number]): void
}>()

const dateRange = defineModel<DateRange>('dateRange', { required: true })
const hoverPopupRef = ref<HTMLElement | null>(null)

const sidebarWidth = ref(360)
const isResizing = ref(false)
const minWidth = 260
const maxWidth = 600
const sidebarLeftOffset = 16

function startResize() {
  isResizing.value = true
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onResize(e: MouseEvent) {
  if (!isResizing.value)
    return

  const newWidth = e.clientX - sidebarLeftOffset

  sidebarWidth.value = Math.max(minWidth, Math.min(maxWidth, newWidth))
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

const {
  hoveredActivity,
  initializeInteractions,
  onTooltipMouseEnter,
  onTooltipMouseLeave,
  focusOnLocation,
} = useActivityMapInteractions({
  hoverPopupRef,
  markers: toRef(props, 'markers'),
})

function onMapReady(map: OlMap) {
  initializeInteractions(map)

  map.on('moveend', () => {
    updateBoundsAndFetch(map)
  })
  updateBoundsAndFetch(map)
}

function updateBoundsAndFetch(map: OlMap) {
  const view = map.getView()
  const size = map.getSize()
  if (!size)
    return

  const centerCoordinates = view.getCenter()
  if (!centerCoordinates)
    return

  const zoom = view.getZoom() || 0
  const centerLonLat = toLonLat(centerCoordinates)
  const extent = view.calculateExtent(size)
  const topLeft = toLonLat([extent[0], extent[3]])
  const rightBottom = toLonLat([extent[2], extent[1]])

  const mapBounds: MapBounds = {
    screen: {
      leftTop: { lat: topLeft[1], lon: topLeft[0] },
      center: { lat: centerLonLat[1], lon: centerLonLat[0] },
      rightBottom: { lat: rightBottom[1], lon: rightBottom[0] },
    },
    zoomlevel: zoom,
  }

  emit('boundsChange', mapBounds)
}

function handleSidebarItemClick(act: ActivityItem) {
  focusOnLocation(act.coords)
  emit('focusItem', act.coords)
}

const controlsLeftPosition = computed(() => `${sidebarWidth.value + 32}px`)
</script>

<template>
  <div class="activity-map-view">
    <aside
      class="floating-sidebar"
      :style="{ width: `${sidebarWidth}px` }"
    >
      <div class="sidebar-header">
        <h3>Активности</h3>
        <span class="count">{{ activities.length }}</span>
      </div>
      <div class="sidebar-scroll">
        <div v-if="activities.length === 0" class="empty-sidebar">
          В этой области пусто
        </div>
        <div
          v-for="act in activities"
          :key="act.id"
          class="sidebar-item"
          @click="handleSidebarItemClick(act)"
        >
          <div class="item-icon">
            <Icon icon="mdi:map-marker" />
          </div>
          <div class="item-content">
            <div class="item-title">
              {{ act.title }}
            </div>
            <div v-if="act.date" class="item-meta">
              <Icon icon="mdi:calendar-blank" class="meta-icon" />
              <span> {{ act.date }} </span>
            </div>
          </div>
          <div class="item-arrow">
            <Icon icon="mdi:chevron-right" />
          </div>
        </div>
      </div>

      <div class="resize-handle" @mousedown.prevent="startResize" />
    </aside>

    <div
      class="floating-controls"
      :style="{ left: controlsLeftPosition }"
    >
      <KitBtn
        icon="mdi:format-list-bulleted"
        variant="tonal"
        class="glass-btn"
        @click="emit('switchToList')"
      >
        Список
      </KitBtn>

      <ActivityFilters v-model:date-range="dateRange" transparent />
    </div>

    <div class="map-container">
      <KitMap
        :center="center"
        :zoom="zoom"
        height="100%"
        width="100%"
        :markers="markers"
        @map-ready="onMapReady"
        @click="emit('mapClick', $event)"
      />
    </div>

    <div
      ref="hoverPopupRef"
      class="map-hover-card"
      @mouseenter="onTooltipMouseEnter"
      @mouseleave="onTooltipMouseLeave"
    >
      <div v-if="hoveredActivity" class="hover-card-content">
        <div class="hover-title">
          {{ hoveredActivity.markName }}
        </div>
        <div v-if="hoveredActivity.additionalInfo" class="hover-desc">
          {{ hoveredActivity.additionalInfo }}
        </div>
        <div v-if="hoveredActivity.endAt" class="hover-meta">
          {{ new Date(hoveredActivity.endAt).toLocaleDateString() }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.activity-map-view {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  isolation: isolate;

  :deep() {
    .map-container {
      border-radius: 0;
      border: none;
    }

    .kit-map-wrapper {
      border-radius: 0;
      border: none;
    }
  }
}

.map-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.floating-sidebar {
  position: absolute;
  top: 16px;
  left: 16px;
  bottom: 16px;
  background-color: rgba(var(--bg-secondary-color-rgb), 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(var(--border-secondary-color-rgb), 0.5);
  border-radius: var(--r-l);
  z-index: 10;
  display: flex;
  flex-direction: column;
  box-shadow: var(--s-xl);
  overflow: visible;
  overflow: hidden;

  @include media-down(sm) {
    display: none;
  }
}

.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 20;
  transition: background-color 0.2s;

  &:hover,
  &:active {
    background-color: rgba(var(--fg-primary-color-rgb), 0.2);
  }
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid rgba(var(--border-secondary-color-rgb), 0.3);
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
  .count {
    background: rgba(var(--bg-tertiary-color-rgb), 0.6);
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
  }
}

.sidebar-scroll {
  flex-grow: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
  }
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: rgba(var(--bg-primary-color-rgb), 0.6);
  border: 1px solid transparent;
  border-radius: var(--r-m);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--bg-primary-color);
    border-color: var(--border-secondary-color);
    transform: translateX(4px);
    box-shadow: var(--s-s);

    .item-arrow {
      opacity: 1;
      transform: translateX(0);
    }

    .item-icon {
      color: var(--fg-accent-color);
      background-color: var(--bg-accent-overlay-color);
    }
  }

  .item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    transition: all 0.2s;
  }

  .item-content {
    flex-grow: 1;
    min-width: 0;
  }

  .item-title {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--fg-primary-color);
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-meta {
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    display: flex;
    align-items: center;
    gap: 4px;

    .meta-icon {
      font-size: 0.9rem;
    }
  }

  .item-arrow {
    opacity: 0;
    transform: translateX(-4px);
    transition: all 0.2s;
    color: var(--fg-tertiary-color);
  }
}

.empty-sidebar {
  text-align: center;
  padding: 24px;
  color: var(--fg-secondary-color);
  font-size: 0.9rem;
}

.floating-controls {
  position: absolute;
  top: 16px;
  z-index: 10;
  display: flex;
  gap: 12px;
  transition: left 0.1s linear;

  @include media-down(sm) {
    left: 16px !important;
    width: calc(100% - 32px);
    overflow-x: auto;
  }
}

.glass-btn {
  background-color: rgba(var(--bg-secondary-color-rgb), 0.85) !important;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(var(--border-secondary-color-rgb), 0.5);
  box-shadow: var(--s-s);

  &:hover {
    background-color: rgba(var(--bg-secondary-color-rgb), 0.95) !important;
  }
}

.map-hover-card {
  position: absolute;
  background-color: var(--bg-primary-color);
  border-radius: var(--r-m);
  padding: 10px 14px;
  box-shadow: var(--s-xl);
  border: 1px solid var(--border-secondary-color);
  pointer-events: auto;
  white-space: nowrap;
  min-width: 150px;
  max-width: 250px;
  transform: translate(-50%, -100%);
  margin-bottom: 12px;
  z-index: 100;
  cursor: default;

  &::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 12px;
    height: 12px;
    background-color: var(--bg-primary-color);
    border-bottom: 1px solid var(--border-secondary-color);
    border-right: 1px solid var(--border-secondary-color);
  }
}

.hover-card-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hover-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--fg-primary-color);
}

.hover-desc {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  white-space: normal;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hover-meta {
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);
  margin-top: 2px;
}
</style>```
