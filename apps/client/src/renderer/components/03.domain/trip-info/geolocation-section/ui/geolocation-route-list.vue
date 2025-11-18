<script setup lang="ts">
import type { DrawnRoute, MapPoint, MapRoute } from '../models/types'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import GeolocationPoiList from './geolocation-poi-list.vue'

interface Props {
  routes: MapRoute[]
  drawnRoutes: DrawnRoute[]
  readonly?: boolean
  activeRouteId: string | null
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'focusOnPoint', point: MapPoint): void
  (e: 'updatePoint', routeId: string, point: MapPoint): void
  (e: 'updateRoute', route: (MapRoute | DrawnRoute)): void
  (e: 'updatePointCoords', point: MapPoint): void
  (e: 'deletePoint', routeId: string, pointId: string): void
  (e: 'deleteRoute', routeId: string): void
  (e: 'startMovePoint', pointId: string): void
  (e: 'setActiveRoute', routeId: string | null): void
  (e: 'addSegment', routeId: string): void
  (e: 'deleteSegment', routeId: string, segmentIndex: number): void
  (e: 'refreshAddress', routeId: string, pointId: string): void
}>()

const openRoutes = ref<Set<string>>(new Set())
const collapsedGroups = ref<Set<string>>(new Set())

function toggleRoute(routeId: string) {
  if (openRoutes.value.has(routeId))
    openRoutes.value.delete(routeId)
  else
    openRoutes.value.add(routeId)
}

function toggleGroup(groupId: string) {
  if (collapsedGroups.value.has(groupId))
    collapsedGroups.value.delete(groupId)
  else
    collapsedGroups.value.add(groupId)
}

function formatDistance(distance?: number): string {
  if (distance === undefined)
    return '...'

  if (distance > 1000)
    return `${(distance / 1000).toFixed(2)} км`

  return `${Math.round(distance)} м`
}
</script>

<template>
  <div class="route-list-wrapper">
    <!-- Маршруты по точкам -->
    <div v-if="routes.length > 0" class="route-group">
      <h4 class="group-title" @click="toggleGroup('points')">
        <span>Маршруты по точкам</span>
        <Icon :icon="collapsedGroups.has('points') ? 'mdi:chevron-double-up' : 'mdi:chevron-double-down'" />
      </h4>
      <div v-if="!collapsedGroups.has('points')">
        <div
          v-for="route in routes"
          :key="route.id"
          class="route-item"
          :class="{ 'is-active': activeRouteId === route.id }"
        >
          <div class="route-header" @click="toggleRoute(route.id)">
            <div class="route-title">
              <Icon icon="mdi:directions" :style="{ color: route.color }" />
              <KitInlineMdEditorWrapper
                v-if="!readonly"
                :model-value="route.title"
                class="route-title-editor"
                @update:model-value="route.title = $event"
                @blur="emit('updateRoute', route)"
              />
              <span v-else>{{ route.title }}</span>
              <span v-if="route.isFetching" class="loader" />
            </div>
            <div class="route-summary">
              <span>{{ formatDistance(route.distance) }}</span>
              <KitBtn v-if="!readonly" icon="mdi:pencil-outline" variant="outlined" size="sm" aria-label="Редактировать маршрут" @click.stop="emit('setActiveRoute', route.id)" />
              <KitBtn v-if="!readonly" icon="mdi:delete-outline" variant="solid" size="sm" aria-label="Удалить маршрут" @click.stop="emit('deleteRoute', route.id)" />
              <Icon :icon="openRoutes.has(route.id) ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="toggle-icon" />
            </div>
          </div>
          <div v-if="openRoutes.has(route.id)" class="route-points">
            <GeolocationPoiList
              :points="route.points.map(p => ({ ...p, style: { ...p.style, color: route.color } }))"
              :readonly="!!readonly"
              @focus-on-point="emit('focusOnPoint', $event)"
              @update-point="emit('updatePoint', route.id, $event)"
              @update-point-coords="emit('updatePointCoords', $event)"
              @start-move-point="emit('startMovePoint', $event)"
              @delete-point="emit('deletePoint', route.id, $event)"
              @refresh-address="emit('refreshAddress', route.id, $event)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Нарисованные маршруты -->
    <div v-if="drawnRoutes.length > 0" class="route-group">
      <h4 class="group-title" @click="toggleGroup('drawn')">
        <span>Нарисованные маршруты</span>
        <Icon :icon="collapsedGroups.has('drawn') ? 'mdi:chevron-double-up' : 'mdi:chevron-double-down'" />
      </h4>
      <div v-if="!collapsedGroups.has('drawn')">
        <div v-for="route in drawnRoutes" :key="route.id" class="route-item is-drawn">
          <div class="route-header" @click="toggleRoute(route.id)">
            <div class="route-title">
              <Icon icon="mdi:draw" :style="{ color: route.color }" />
              <KitInlineMdEditorWrapper
                v-if="!readonly"
                :model-value="route.title"
                class="route-title-editor"
                @update:model-value="route.title = $event"
                @blur="emit('updateRoute', route)"
              />
              <span v-else>{{ route.title }}</span>
            </div>
            <div class="route-summary">
              <KitBtn v-if="!readonly" icon="mdi:delete-outline" variant="solid" size="sm" aria-label="Удалить маршрут" @click.stop="emit('deleteRoute', route.id)" />
              <Icon :icon="openRoutes.has(route.id) ? 'mdi:chevron-double-up' : 'mdi:chevron-double-down'" class="toggle-icon" />
            </div>
          </div>
          <div v-if="openRoutes.has(route.id)" class="route-segments">
            <div
              v-for="(_, index) in route.segments"
              :key="index"
              class="segment-item"
            >
              <span>Сегмент {{ index + 1 }}</span>
              <KitBtn
                v-if="!readonly"
                icon="mdi:delete-outline"
                variant="solid"
                size="sm"
                aria-label="Удалить сегмент"
                @click="emit('deleteSegment', route.id, index)"
              />
            </div>
            <div class="add-segment-action">
              <KitBtn
                v-if="!readonly"
                icon="mdi:plus"
                size="sm"
                variant="outlined"
                @click="emit('addSegment', route.id)"
              >
                Добавить сегмент
              </KitBtn>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.route-list-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.route-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.group-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--fg-tertiary-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 8px;
  margin: 0;
  margin-top: 8px;
  cursor: pointer;
}
.route-item {
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-xs);
  transition: all 0.2s ease;
  overflow: hidden;

  &.is-active {
    border-color: var(--c-primary);
    box-shadow: 0 0 0 2px rgba(var(--c-primary-rgb), 0.2);
  }
}
.route-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;

  .is-drawn & {
    cursor: pointer;
  }

  &:hover {
    background-color: var(--bg-hover-color);
  }
}
.route-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  flex-grow: 1;
  min-width: 0;
}
.route-title-editor {
  width: 100%;
  :deep() {
    .milkdown .ProseMirror p {
      font-weight: 600;
    }
  }
}
.route-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-secondary-color);
  font-size: 0.9rem;
}
.route-points {
  padding: 4px;
  border-top: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
}
.route-segments {
  padding: 8px;
  border-top: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.segment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-xs);
  font-size: 0.85rem;
}
.add-segment-action {
  margin-top: 4px;
}
.no-routes-message {
  text-align: center;
  padding: 8px;
  color: var(--fg-tertiary-color);
  font-size: 0.9rem;
}

.loader {
  width: 14px;
  height: 14px;
  border: 2px solid var(--c-primary);
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  box-sizing: border-box;
  animation: rotation 1s linear infinite;
  flex-shrink: 0;
}

@keyframes rotation {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
