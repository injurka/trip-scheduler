<script setup lang="ts">
import type { DrawnRoute, MapPoint, MapRoute, TransportMode } from '../models/types'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import GeolocationPoiList from './geolocation-poi-list.vue'

interface Props {
  routes: MapRoute[]
  drawnRoutes: DrawnRoute[]
  readonly?: boolean
  activeRouteId: string | null
}

const props = defineProps<Props>()

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
  (e: 'setTransportMode', routeId: string, mode: TransportMode): void
}>()

const openRoutes = ref<Set<string>>(new Set())
const collapsedGroups = ref<Set<string>>(new Set())

const transportModes: Array<{ mode: TransportMode, icon: string, label: string }> = [
  { mode: 'foot', icon: 'mdi:walk', label: 'Пешком' },
  { mode: 'bike', icon: 'mdi:bicycle', label: 'Велосипед' },
  { mode: 'car', icon: 'mdi:car', label: 'Авто' },
]

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
  if (distance === undefined || distance === 0)
    return ''
  if (distance >= 1000)
    return `${(distance / 1000).toFixed(1)} км`
  return `${Math.round(distance)} м`
}

function formatDuration(duration?: number): string {
  if (!duration || duration === 0)
    return ''
  if (duration >= 3600) {
    const hours = Math.floor(duration / 3600)
    const mins = Math.round((duration % 3600) / 60)
    return mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`
  }
  const mins = Math.max(1, Math.round(duration / 60))
  return `${mins} мин`
}

function getTransportIcon(mode?: TransportMode): string {
  if (mode === 'car')
    return 'mdi:car'
  if (mode === 'bike')
    return 'mdi:bicycle'
  return 'mdi:walk'
}

function handleTransportChange(route: MapRoute, mode: TransportMode) {
  if (props.readonly || route.transportMode === mode)
    return
  emit('setTransportMode', route.id, mode)
}
</script>

<template>
  <div class="route-list-wrapper">
    <!-- Маршруты по точкам -->
    <div v-if="routes.length > 0" class="route-group">
      <div class="group-header" @click="toggleGroup('points')">
        <span class="group-title">
          <Icon icon="mdi:routes" class="group-icon" />
          Маршруты по точкам ({{ routes.length }})
        </span>
        <Icon
          :icon="collapsedGroups.has('points') ? 'mdi:chevron-down' : 'mdi:chevron-up'"
          class="group-chevron"
        />
      </div>

      <div v-if="!collapsedGroups.has('points')" class="routes-container">
        <div
          v-for="route in routes"
          :key="route.id"
          class="route-card"
          :class="{ 'is-active': activeRouteId === route.id }"
        >
          <!-- Акцентная полоса цвета маршрута -->
          <div class="route-color-stripe" :style="{ backgroundColor: route.color || 'var(--fg-accent-color)' }" />

          <div class="route-main">
            <!-- Верхняя строка карточки -->
            <div class="route-header" @click="toggleRoute(route.id)">
              <div class="route-title-block">
                <Icon :icon="getTransportIcon(route.transportMode)" class="route-mode-icon" :style="{ color: route.color }" />
                <KitInlineMdEditorWrapper
                  v-if="!readonly"
                  :model-value="route.title"
                  class="route-title-editor"
                  :features="{
                    'block-edit': false, 'code-mirror': false, 'cursor': false, 'image-block': false, 'latex': false, 'link-tooltip': false, 'table': false, 'toolbar': false,
                  }"
                  @update:model-value="route.title = $event"
                  @blur="emit('updateRoute', route)"
                />
                <span v-else class="route-title-static">{{ route.title }}</span>
                <span v-if="route.isFetching" class="route-loader" />
              </div>

              <!-- Переключатель транспорта -->
              <div v-if="!readonly" class="transport-switcher" @click.stop>
                <KitTooltip
                  v-for="tm in transportModes"
                  :key="tm.mode"
                  :text="tm.label"
                >
                  <button
                    type="button"
                    class="transport-btn"
                    :class="{ 'is-active': (route.transportMode || 'foot') === tm.mode }"
                    @click="handleTransportChange(route, tm.mode)"
                  >
                    <Icon :icon="tm.icon" />
                  </button>
                </KitTooltip>
              </div>

              <!-- Метрики маршрута (Дистанция и Время) -->
              <div class="route-metrics">
                <span v-if="route.distance" class="metric-badge">
                  <Icon icon="mdi:map-marker-distance" class="metric-icon" />
                  {{ formatDistance(route.distance) }}
                </span>
                <span v-if="route.duration" class="metric-badge time-badge">
                  <Icon icon="mdi:clock-outline" class="metric-icon" />
                  {{ formatDuration(route.duration) }}
                </span>
              </div>

              <!-- Действия над маршрутом -->
              <div class="route-actions" @click.stop>
                <KitTooltip v-if="!readonly" :text="activeRouteId === route.id ? 'Завершить редактирование' : 'Добавить точки'">
                  <button
                    type="button"
                    class="action-btn"
                    :class="{ 'is-active': activeRouteId === route.id }"
                    @click="emit('setActiveRoute', activeRouteId === route.id ? null : route.id)"
                  >
                    <Icon icon="mdi:map-marker-path" />
                  </button>
                </KitTooltip>

                <KitTooltip v-if="!readonly" text="Удалить маршрут">
                  <button
                    type="button"
                    class="action-btn delete-btn"
                    @click="emit('deleteRoute', route.id)"
                  >
                    <Icon icon="mdi:trash-can-outline" />
                  </button>
                </KitTooltip>

                <button type="button" class="action-btn chevron-btn" @click="toggleRoute(route.id)">
                  <Icon :icon="openRoutes.has(route.id) ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
                </button>
              </div>
            </div>

            <!-- Список точек маршрута при раскрытии -->
            <div v-if="openRoutes.has(route.id)" class="route-content">
              <div v-if="route.points.length === 0" class="empty-route-points">
                <p>В этом маршруте пока нет точек.</p>
                <KitBtn
                  v-if="!readonly"
                  size="xs"
                  variant="subtle"
                  icon="mdi:map-marker-plus"
                  @click="emit('setActiveRoute', route.id)"
                >
                  Кликните на карту для добавления точек
                </KitBtn>
              </div>

              <GeolocationPoiList
                v-else
                :points="route.points.map(p => ({ ...p, style: { ...p.style, color: route.color } }))"
                :readonly="!!readonly"
                @focus-on-point="emit('focusOnPoint', $event)"
                @update-point="emit('updatePoint', route.id, $event)"
                @update-point-coords="emit('updatePointCoords', $event)"
                @start-move-point="emit('startMovePoint', $event)"
                @delete-point="emit('deletePoint', route.id, $event)"
                @refresh-address="emit('refreshAddress', route.id, $event)"
              />

              <div v-if="!readonly && activeRouteId !== route.id" class="add-point-to-route-bar">
                <KitBtn
                  size="xs"
                  variant="text"
                  icon="mdi:plus"
                  @click="emit('setActiveRoute', route.id)"
                >
                  Добавить точку в маршрут
                </KitBtn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Нарисованные от руки маршруты -->
    <div v-if="drawnRoutes.length > 0" class="route-group">
      <div class="group-header" @click="toggleGroup('drawn')">
        <span class="group-title">
          <Icon icon="mdi:draw" class="group-icon" />
          Нарисованные линии ({{ drawnRoutes.length }})
        </span>
        <Icon
          :icon="collapsedGroups.has('drawn') ? 'mdi:chevron-down' : 'mdi:chevron-up'"
          class="group-chevron"
        />
      </div>

      <div v-if="!collapsedGroups.has('drawn')" class="routes-container">
        <div
          v-for="route in drawnRoutes"
          :key="route.id"
          class="route-card is-drawn"
        >
          <div class="route-color-stripe" :style="{ backgroundColor: route.color || 'var(--fg-accent-color)' }" />

          <div class="route-main">
            <div class="route-header" @click="toggleRoute(route.id)">
              <div class="route-title-block">
                <Icon icon="mdi:draw-pen" class="route-mode-icon" :style="{ color: route.color }" />
                <KitInlineMdEditorWrapper
                  v-if="!readonly"
                  :model-value="route.title"
                  class="route-title-editor"
                  :features="{
                    'block-edit': false, 'code-mirror': false, 'cursor': false, 'image-block': false, 'latex': false, 'link-tooltip': false, 'table': false, 'toolbar': false,
                  }"
                  @update:model-value="route.title = $event"
                  @blur="emit('updateRoute', route)"
                />
                <span v-else class="route-title-static">{{ route.title }}</span>
              </div>

              <div class="route-metrics">
                <span class="metric-badge">
                  {{ route.segments.length }} {{ route.segments.length === 1 ? 'сегмент' : 'сегментов' }}
                </span>
              </div>

              <div class="route-actions" @click.stop>
                <KitTooltip v-if="!readonly" text="Удалить нарисованный маршрут">
                  <button
                    type="button"
                    class="action-btn delete-btn"
                    @click="emit('deleteRoute', route.id)"
                  >
                    <Icon icon="mdi:trash-can-outline" />
                  </button>
                </KitTooltip>
                <button type="button" class="action-btn chevron-btn" @click="toggleRoute(route.id)">
                  <Icon :icon="openRoutes.has(route.id) ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
                </button>
              </div>
            </div>

            <div v-if="openRoutes.has(route.id)" class="route-content">
              <div class="drawn-segments-list">
                <div
                  v-for="(_, index) in route.segments"
                  :key="index"
                  class="drawn-segment-item"
                >
                  <span class="segment-label">
                    <Icon icon="mdi:vector-polyline" />
                    Линия {{ index + 1 }}
                  </span>
                  <button
                    v-if="!readonly"
                    type="button"
                    class="action-btn delete-btn"
                    @click="emit('deleteSegment', route.id, index)"
                  >
                    <Icon icon="mdi:trash-can-outline" />
                  </button>
                </div>
              </div>

              <div v-if="!readonly" class="add-segment-bar">
                <KitBtn
                  icon="mdi:plus"
                  size="xs"
                  variant="subtle"
                  @click="emit('addSegment', route.id)"
                >
                  Дорисовать сегмент
                </KitBtn>
              </div>
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
  gap: 10px;
}

.route-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  cursor: pointer;
  user-select: none;

  .group-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;

    .group-icon {
      font-size: 0.95rem;
      color: var(--fg-accent-color);
    }
  }

  .group-chevron {
    font-size: 1rem;
    color: var(--fg-secondary-color);
  }
}

.routes-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.route-card {
  position: relative;
  display: flex;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  overflow: hidden;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
  }

  &.is-active {
    border-color: var(--fg-accent-color);
    box-shadow: 0 0 0 1px var(--fg-accent-color);
  }
}

.route-color-stripe {
  width: 4px;
  flex-shrink: 0;
}

.route-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.route-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  flex-wrap: wrap;

  &:hover {
    background-color: var(--bg-hover-color);
  }
}

.route-title-block {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 140px;

  .route-mode-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }
}

.route-title-editor {
  flex: 1;
  :deep() {
    .milkdown .ProseMirror p {
      font-weight: 600;
      font-size: 0.88rem;
      color: var(--fg-primary-color);
    }
  }
}

.route-title-static {
  font-weight: 600;
  font-size: 0.88rem;
  color: var(--fg-primary-color);
}

.transport-switcher {
  display: flex;
  align-items: center;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-xs);
  padding: 2px;
  gap: 2px;
  flex-shrink: 0;
}

.transport-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 24px;
  border-radius: var(--r-2xs);
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.15s ease;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &.is-active {
    background-color: var(--fg-accent-color);
    color: var(--fg-inverted-color);
  }
}

.route-metrics {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.metric-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
  background-color: var(--bg-secondary-color);
  padding: 2px 6px;
  border-radius: var(--r-2xs);
  border: 1px solid var(--border-secondary-color);

  .metric-icon {
    font-size: 0.85rem;
    color: var(--fg-accent-color);
  }

  &.time-badge {
    color: var(--fg-primary-color);
  }
}

.route-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--r-xs);
  border: 1px solid transparent;
  background: transparent;
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.15s ease;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &.is-active {
    background-color: var(--fg-accent-color);
    color: var(--fg-inverted-color);
  }

  &.delete-btn:hover {
    background-color: rgba(var(--fg-error-color-rgb), 0.12);
    color: var(--fg-error-color);
  }
}

.route-content {
  padding: 8px 12px 12px;
  background-color: var(--bg-secondary-color);
  border-top: 1px solid var(--border-secondary-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-route-points {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 8px;
  font-size: 0.82rem;
  color: var(--fg-secondary-color);
  text-align: center;
}

.add-point-to-route-bar {
  display: flex;
  justify-content: center;
  padding-top: 4px;
}

.drawn-segments-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drawn-segment-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-xs);
  border: 1px solid var(--border-secondary-color);
  font-size: 0.8rem;
  color: var(--fg-secondary-color);

  .segment-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
}

.add-segment-bar {
  display: flex;
  justify-content: flex-start;
  padding-top: 4px;
}

.route-loader {
  width: 12px;
  height: 12px;
  border: 2px solid var(--fg-accent-color);
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
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
