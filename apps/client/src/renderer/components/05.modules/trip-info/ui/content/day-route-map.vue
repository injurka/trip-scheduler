<script setup lang="ts">
import type { Coordinate, MapPoint, MapRoute } from '~/components/03.domain/trip-info/geolocation-section'
import type { IDay } from '~/components/04.features/trip-info/trip-plan/models/types'
import { Icon } from '@iconify/vue'
import { useFullscreen, useStorage } from '@vueuse/core'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import GeolocationMap from '~/components/03.domain/trip-info/geolocation-section/ui/geolocation-map.vue'
import { EActivitySectionType } from '~/shared/types/models/activity'

interface Props {
  day: IDay
}

const props = defineProps<Props>()

const wrapperRef = ref<HTMLElement | null>(null)
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(wrapperRef)

// Запоминаем состояние развернутости в localStorage
const isExpanded = useStorage<boolean>('trip-day-route-map-expanded', false)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

function handleToggleFullscreen() {
  if (!isFullscreen.value && !isExpanded.value) {
    isExpanded.value = true
  }
  toggleFullscreen()
}

const geoSections = computed(() => props.day.activities.flatMap(activity =>
  activity.sections?.filter(section => section.type === EActivitySectionType.GEOLOCATION) ?? [],
))

const routes = computed<MapRoute[]>(() => geoSections.value.flatMap(section => section.routes))
const standalonePoints = computed<MapPoint[]>(() => geoSections.value.flatMap(section => section.points))
const routePoints = computed<MapPoint[]>(() => routes.value.flatMap(route =>
  route.points.map(point => ({
    ...point,
    style: { ...point.style, color: route.color },
  })),
))
const points = computed(() => [...standalonePoints.value, ...routePoints.value])

const center = computed<Coordinate>(() => {
  const firstPoint = points.value[0]
  if (firstPoint)
    return firstPoint.coordinates

  const firstRoute = routes.value[0]
  return firstRoute?.geometry?.[0] ?? firstRoute?.points[0]?.coordinates ?? [37.6176, 55.7558]
})

const hasMapData = computed(() => points.value.length > 0 || routes.value.length > 0)

function pluralize(n: number, one: string, few: string, many: string) {
  const abs = Math.abs(n) % 100
  const rem = abs % 10
  if (abs > 10 && abs < 20)
    return many
  if (rem > 1 && rem < 5)
    return few
  if (rem === 1)
    return one
  return many
}

const locationsCount = computed(() => points.value.length)
const routesCount = computed(() => routes.value.length)

const locationsLabel = computed(() => {
  const count = locationsCount.value
  return `${count} ${pluralize(count, 'локация', 'локации', 'локаций')}`
})

const routesLabel = computed(() => {
  const count = routesCount.value
  return `${count} ${pluralize(count, 'маршрут', 'маршрута', 'маршрутов')}`
})

const totalDistanceMeters = computed(() => {
  return routes.value.reduce((acc, r) => acc + (r.distance || 0), 0)
})

const distanceLabel = computed(() => {
  if (!totalDistanceMeters.value)
    return null
  if (totalDistanceMeters.value >= 1000) {
    return `${(totalDistanceMeters.value / 1000).toFixed(1)} км`
  }
  return `${Math.round(totalDistanceMeters.value)} м`
})
</script>

<template>
  <section
    v-if="hasMapData"
    ref="wrapperRef"
    class="day-route-map-card"
    :class="{
      'is-expanded': isExpanded,
      'is-fullscreen': isFullscreen,
    }"
  >
    <header
      class="day-route-map-card__header"
      role="button"
      tabindex="0"
      :aria-expanded="isExpanded"
      @click="toggleExpand"
      @keydown.enter.prevent="toggleExpand"
      @keydown.space.prevent="toggleExpand"
    >
      <div class="day-route-map-card__info">
        <div class="map-badge-icon">
          <Icon icon="mdi:map-marker-distance" />
        </div>

        <div class="day-route-map-card__title-row">
          <span class="card-title">Карта дня</span>
          <div class="stat-pills">
            <span v-if="locationsCount > 0" class="stat-pill" title="Отмеченные локации">
              <Icon icon="mdi:map-marker-outline" />
              <span>{{ locationsLabel }}</span>
            </span>

            <span v-if="routesCount > 0" class="stat-pill" title="Маршруты дня">
              <Icon icon="mdi:routes" />
              <span>{{ routesLabel }}</span>
            </span>

            <span v-if="distanceLabel" class="stat-pill stat-pill--highlight" title="Общая длина маршрутов">
              <Icon icon="mdi:navigation-variant-outline" />
              <span>{{ distanceLabel }}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="day-route-map-card__actions" @click.stop>
        <KitTooltip :text="isFullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'">
          <button
            type="button"
            class="map-icon-action-btn"
            :class="{ 'is-active': isFullscreen }"
            :aria-label="isFullscreen ? 'Свернуть полноэкранный режим' : 'Открыть на весь экран'"
            @click="handleToggleFullscreen"
          >
            <Icon :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" />
          </button>
        </KitTooltip>

        <button
          type="button"
          class="map-expand-btn"
          :class="{ 'is-expanded': isExpanded }"
          @click="toggleExpand"
        >
          <span class="btn-label">{{ isExpanded ? 'Свернуть карту' : 'Развернуть карту' }}</span>
          <Icon icon="mdi:chevron-down" class="btn-chevron" :class="{ 'is-rotated': isExpanded }" />
        </button>
      </div>
    </header>

    <Transition name="expand-map">
      <div v-if="isExpanded || isFullscreen" class="day-route-map-card__content">
        <GeolocationMap
          :points="points"
          :routes="routes"
          :center="center"
          :height="isFullscreen ? '100%' : '380px'"
          :is-fullscreen="isFullscreen"
          :is-loading="false"
          :readonly="true"
          with-panel
          with-fullscreen-control
          mode="pan"
          use-static-renderer
          interactive-on-click
          @toggle-fullscreen="handleToggleFullscreen"
        />
      </div>
    </Transition>
  </section>
</template>

<style scoped lang="scss">
.day-route-map-card {
  position: relative;
  display: flex;
  flex-direction: column;
  margin-top: 20px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  overflow: hidden;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--fg-accent-color) 35%, var(--border-secondary-color));
  }

  &.is-expanded {
    box-shadow: var(--s-m);

    .day-route-map-card__header {
      border-bottom: 1px solid var(--border-secondary-color);
    }
  }

  &.is-fullscreen {
    position: fixed;
    inset: 0;
    z-index: 2000;
    height: 100vh;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 0;
    background-color: var(--bg-primary-color);
    box-shadow: none;

    .day-route-map-card__header {
      border-radius: 0;
      border-bottom: 1px solid var(--border-secondary-color);
      background-color: var(--bg-secondary-color);
      flex-shrink: 0;
    }

    .day-route-map-card__content {
      flex: 1;
      height: calc(100vh - 54px);
    }
  }
}

.day-route-map-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  gap: 12px;
  cursor: pointer;
  user-select: none;
  background-color: var(--bg-secondary-color);
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--bg-hover-color);

    .map-badge-icon {
      background-color: color-mix(in srgb, var(--fg-accent-color) 20%, transparent);
      color: var(--fg-accent-color);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: -2px;
  }
}

.day-route-map-card__info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.map-badge-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--r-s);
  background-color: color-mix(in srgb, var(--fg-accent-color) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--fg-accent-color) 22%, transparent);
  color: var(--fg-accent-color);
  font-size: 1.15rem;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.day-route-map-card__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-width: 0;
}

.card-title {
  font-family: var(--font-accent);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.stat-pills {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.76rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 999px;
  padding: 4px 9px;
  line-height: 1.2;
  transition: all 0.15s ease;

  .iconify {
    font-size: 0.88rem;
    color: var(--fg-accent-color);
  }

  &--highlight {
    background-color: color-mix(in srgb, var(--fg-accent-color) 8%, var(--bg-primary-color));
    border-color: color-mix(in srgb, var(--fg-accent-color) 25%, transparent);
    color: var(--fg-primary-color);
  }
}

.day-route-map-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.map-icon-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: transparent;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  color: var(--fg-secondary-color);
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.2s ease;

  &:hover {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }

  &.is-active {
    color: var(--fg-accent-color);
    background-color: color-mix(in srgb, var(--fg-accent-color) 12%, transparent);
    border-color: var(--fg-accent-color);
  }
}

.map-expand-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  color: var(--fg-secondary-color);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  height: 30px;

  &:hover {
    color: var(--fg-primary-color);
    border-color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }

  &.is-expanded {
    color: var(--fg-accent-color);
    border-color: color-mix(in srgb, var(--fg-accent-color) 40%, transparent);
    background-color: color-mix(in srgb, var(--fg-accent-color) 8%, transparent);
  }

  .btn-chevron {
    font-size: 1rem;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);

    &.is-rotated {
      transform: rotate(180deg);
    }
  }
}

.day-route-map-card__content {
  position: relative;
  width: 100%;
}

.expand-map-enter-active,
.expand-map-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  max-height: 600px;
  opacity: 1;
  overflow: hidden;
}

.expand-map-enter-from,
.expand-map-leave-to {
  max-height: 0;
  opacity: 0;
}

@include media-down(sm) {
  .day-route-map-card__header {
    padding: 10px 12px;
  }

  .card-title {
    font-size: 0.88rem;
  }

  .stat-pill {
    padding: 1px 7px;
    font-size: 0.72rem;
  }

  .map-expand-btn .btn-label {
    display: none;
  }

  .map-expand-btn {
    padding: 5px 8px;
  }
}
</style>
