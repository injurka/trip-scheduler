<script setup lang="ts">
import type { useGeolocationMap } from '~/components/03.domain/trip-info/geolocation-section/composables/use-geolocation-map'
import type { Coordinate, MapPoint, MapRoute } from '~/components/03.domain/trip-info/geolocation-section/models/types'
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit/kit-btn'
import GeolocationMap from '~/components/03.domain/trip-info/geolocation-section/ui/geolocation-map.vue'
import { isValidCoordinate, nominatimService } from '~/shared/services/geo'

interface Props {
  cities?: string[]
  points?: any[]
  routes?: any[]
}

const props = withDefaults(defineProps<Props>(), {
  cities: () => [],
  points: () => [],
  routes: () => [],
})

const router = useRouter()
const { smAndDown } = useDisplay()

const isLoading = ref(true)
const mapPoints = ref<MapPoint[]>([])
const mapRoutes = ref<MapRoute[]>([])
const mapCenter = ref<Coordinate>([37.6176, 55.7558])

async function fetchCoordinates(city: string): Promise<[number, number] | null> {
  try {
    const result = await nominatimService.searchSingle(city)
    if (result) {
      return [result.lon, result.lat]
    }
    return null
  }
  catch (e) {
    console.error(`Failed to geocode city: ${city}`, e)
    return null
  }
}

async function initMapData() {
  if (props.points.length > 0 || props.routes.length > 0) {
    const points: MapPoint[] = []
    const routes: MapRoute[] = []

    props.points.forEach((p) => {
      if (p && p.coordinates && isValidCoordinate(p.coordinates)) {
        let [lon, lat] = p.coordinates
        if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) {
          const temp = lat
          lat = lon
          lon = temp
        }
        points.push({
          id: p.id,
          coordinates: [lon, lat],
          type: p.type || 'poi',
          style: p.style,
          comment: p.comment,
          address: p.address,
        })
      }
    })

    props.routes.forEach((r) => {
      if (r.isVisible !== false) {
        routes.push({
          id: r.id,
          title: r.title || 'Маршрут',
          points: (r.points || []).map((rp: any) => {
            let [lon, lat] = rp.coordinates || [0, 0]
            if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) {
              const temp = lat
              lat = lon
              lon = temp
            }
            return {
              ...rp,
              coordinates: [lon, lat],
            }
          }),
          color: r.color || '#4A90E2',
          transportMode: r.transportMode,
          distance: r.distance,
          duration: r.duration,
          geometry: r.geometry,
          isVisible: true,
          isDirect: r.isDirect,
        })
      }

      if (r.points && Array.isArray(r.points)) {
        r.points.forEach((rp: any) => {
          if (rp && rp.coordinates && isValidCoordinate(rp.coordinates)) {
            let [lon, lat] = rp.coordinates
            if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) {
              const temp = lat
              lat = lon
              lon = temp
            }
            if (!points.some(m => m.id === rp.id)) {
              points.push({
                id: rp.id,
                coordinates: [lon, lat],
                type: rp.type || 'via',
                style: rp.style?.color ? rp.style : { ...rp.style, color: r.color },
                comment: rp.comment,
                address: rp.address,
              })
            }
          }
        })
      }
    })

    mapPoints.value = points
    mapRoutes.value = routes

    if (points.length > 0) {
      mapCenter.value = points[0].coordinates
    }
    else if (routes.length > 0 && routes[0].geometry && routes[0].geometry.length > 0) {
      mapCenter.value = routes[0].geometry[0]
    }

    isLoading.value = false
    return
  }

  if (props.cities.length > 0) {
    isLoading.value = true
    const points: MapPoint[] = []
    const centerSum: [number, number] = [0, 0]
    let validCount = 0

    const results = await Promise.all(props.cities.map(async (city) => {
      const coords = await fetchCoordinates(city)
      return { city, coords }
    }))

    results.forEach(({ coords, city }, index) => {
      if (coords) {
        points.push({
          id: `city-${index}`,
          coordinates: [coords[0], coords[1]],
          type: 'poi',
          comment: city,
        })
        centerSum[0] += coords[0]
        centerSum[1] += coords[1]
        validCount++
      }
    })

    if (validCount > 0) {
      mapCenter.value = [centerSum[0] / validCount, centerSum[1] / validCount]
      mapPoints.value = points
    }
    mapRoutes.value = []
    isLoading.value = false
    return
  }

  mapPoints.value = []
  mapRoutes.value = []
  isLoading.value = false
}

function openFullMap() {
  router.push({ query: { ...router.currentRoute.value.query, section: 'map' } })
}

function handleMapReady(controller: ReturnType<typeof useGeolocationMap>) {
  if (controller.mapInstance.value) {
    fitViewToData(controller.mapInstance.value)
  }
}

function fitViewToData(map: any) {
  let minLon = Number.POSITIVE_INFINITY
  let minLat = Number.POSITIVE_INFINITY
  let maxLon = Number.NEGATIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY

  const considerPoint = (coords: Coordinate) => {
    if (!isValidCoordinate(coords))
      return
    const [lon, lat] = coords
    if (lon < minLon)
      minLon = lon
    if (lon > maxLon)
      maxLon = lon
    if (lat < minLat)
      minLat = lat
    if (lat > maxLat)
      maxLat = lat
  }

  mapPoints.value.forEach(p => considerPoint(p.coordinates))

  mapRoutes.value.forEach((r) => {
    if (r.geometry && r.geometry.length > 0) {
      r.geometry.forEach(considerPoint)
    }
    else if (r.points && r.points.length > 0) {
      r.points.forEach(p => considerPoint(p.coordinates))
    }
  })

  if (minLon !== Number.POSITIVE_INFINITY && maxLon !== Number.NEGATIVE_INFINITY) {
    map.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      { padding: 40, maxZoom: 14, duration: 500 },
    )
  }
}

onMounted(() => {
  initMapData()
})

watch(() => [props.cities, props.points, props.routes], () => {
  initMapData()
}, { deep: true })
</script>

<template>
  <div class="trip-map-widget">
    <div class="widget-title">
      <Icon icon="mdi:map-search-outline" class="title-icon" />
      <span>Карта путешествия</span>
      <div class="spacer" />
      <KitBtn
        variant="text"
        size="sm"
        icon="mdi:arrow-expand"
        @click="openFullMap"
      >
        {{ smAndDown ? '' : 'Подробнее' }}
      </KitBtn>
    </div>

    <div class="map-wrapper">
      <div v-if="isLoading" class="loading-state">
        <Icon icon="mdi:loading" class="spin" />
        <span>Загрузка карты...</span>
      </div>

      <div v-else-if="mapPoints.length === 0 && mapRoutes.length === 0 && cities.length === 0" class="empty-state">
        <Icon icon="mdi:map-marker-off-outline" />
        <span>Нет отмеченных локаций</span>
      </div>

      <GeolocationMap
        v-else
        :is-loading="false"
        :center="mapCenter"
        :zoom="10"
        height="100%"
        :points="mapPoints"
        :routes="mapRoutes"
        use-static-renderer
        :readonly="true"
        :interactive-on-click="false"
        mode="pan"
        :with-panel="false"
        :is-fullscreen="false"
        class="interactive-map"
        @map-ready="handleMapReady"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.trip-map-widget {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 1rem;
  display: flex;
  flex-direction: column;

  :deep(.controls-container) {
    display: none;
  }
}

.widget-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0.5rem 0.5rem 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-secondary-color);
  color: var(--fg-primary-color);

  .title-icon {
    color: var(--fg-accent-color);
  }
}

.spacer {
  flex-grow: 1;
}

.map-wrapper {
  position: relative;
  height: 400px;
  width: 100%;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-m);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
}

:deep(.geolocation-map-container),
:deep(.kit-map-wrapper) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100% !important;
  border-radius: 0;
}

.loading-state,
.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--fg-secondary-color);
  background-color: var(--bg-tertiary-color);
  z-index: 5;

  .iconify {
    font-size: 2.5rem;
    opacity: 0.5;
  }

  span {
    font-size: 0.9rem;
    font-weight: 500;
  }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
