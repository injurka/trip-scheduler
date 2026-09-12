<script setup lang="ts">
import type { Coordinate, MapPoint, MapRoute } from '~/components/03.domain/trip-info/geolocation-section'
import type { IDay } from '~/components/04.features/trip-info/trip-plan/models/types'
import { useFullscreen } from '@vueuse/core'
import { KitDivider } from '~/components/01.kit/kit-divider'
import GeolocationMap from '~/components/03.domain/trip-info/geolocation-section/ui/geolocation-map.vue'
import { EActivitySectionType } from '~/shared/types/models/activity'

interface Props {
  day: IDay
}

const props = defineProps<Props>()

const wrapperRef = ref<HTMLElement | null>(null)
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(wrapperRef)

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
</script>

<template>
  <section v-if="hasMapData" ref="wrapperRef" class="day-route-map" :class="{ 'is-fullscreen': isFullscreen }">
    <KitDivider v-if="!isFullscreen">
      карта дня
    </KitDivider>

    <GeolocationMap
      :points="points"
      :routes="routes"
      :center="center"
      :height="isFullscreen ? '100%' : '360px'"
      :is-fullscreen="isFullscreen"
      :is-loading="false"
      :readonly="true"
      with-panel
      with-fullscreen-control
      mode="pan"
      use-static-renderer
      interactive-on-click
      @toggle-fullscreen="toggleFullscreen"
    />
  </section>
</template>

<style scoped lang="scss">
.day-route-map {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;

  &.is-fullscreen {
    position: fixed;
    inset: 0;
    z-index: 2000;
    height: 100vh;
    margin: 0;
    padding: 0;
    background-color: var(--bg-primary-color);
  }
}
</style>
