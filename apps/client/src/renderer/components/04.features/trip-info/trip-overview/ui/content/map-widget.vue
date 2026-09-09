<script setup lang="ts">
import type { KitMapRoute, MapMarker } from '~/components/01.kit/kit-map'
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitMap } from '~/components/01.kit/kit-map'
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
const mapMarkers = ref<MapMarker[]>([])
const mapRoutes = ref<KitMapRoute[]>([])
const mapCenter = ref<[number, number]>([37.6176, 55.7558])

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
    const markers: MapMarker[] = []
    const routes: KitMapRoute[] = []

    props.points.forEach((p) => {
      if (p && p.coordinates && isValidCoordinate(p.coordinates)) {
        let [lon, lat] = p.coordinates
        if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) {
          const temp = lat
          lat = lon
          lon = temp
        }
        markers.push({
          id: p.id,
          coords: { lon, lat },
          color: p.style?.color,
          pointType: p.type || 'poi',
          comment: p.comment,
          address: p.address,
          payload: p,
        })
      }
    })

    props.routes.forEach((r) => {
      if (r.isVisible !== false && r.geometry && r.geometry.length >= 2) {
        routes.push({
          id: r.id,
          title: r.title,
          color: r.color || '#4A90E2',
          geometry: r.geometry,
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
            if (!markers.some(m => m.id === rp.id)) {
              markers.push({
                id: rp.id,
                coords: { lon, lat },
                color: rp.style?.color || r.color,
                pointType: rp.type,
                comment: rp.comment,
                address: rp.address,
                payload: rp,
              })
            }
          }
        })
      }
    })

    mapMarkers.value = markers
    mapRoutes.value = routes

    if (markers.length > 0) {
      mapCenter.value = [markers[0].coords.lon, markers[0].coords.lat]
    }
    else if (routes.length > 0 && routes[0].geometry && routes[0].geometry.length > 0) {
      mapCenter.value = routes[0].geometry[0]
    }

    isLoading.value = false
    return
  }

  if (props.cities.length > 0) {
    isLoading.value = true
    const markers: MapMarker[] = []
    const centerSum: [number, number] = [0, 0]
    let validCount = 0

    const results = await Promise.all(props.cities.map(async (city) => {
      const coords = await fetchCoordinates(city)
      return { city, coords }
    }))

    results.forEach(({ coords }, index) => {
      if (coords) {
        markers.push({
          id: `city-${index}`,
          coords: { lon: coords[0], lat: coords[1] },
        })
        centerSum[0] += coords[0]
        centerSum[1] += coords[1]
        validCount++
      }
    })

    if (validCount > 0) {
      mapCenter.value = [centerSum[0] / validCount, centerSum[1] / validCount]
      mapMarkers.value = markers
    }
    mapRoutes.value = []
    isLoading.value = false
    return
  }

  mapMarkers.value = []
  mapRoutes.value = []
  isLoading.value = false
}

function openFullMap() {
  router.push({ query: { ...router.currentRoute.value.query, section: 'map' } })
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

      <div v-else-if="mapMarkers.length === 0 && mapRoutes.length === 0 && cities.length === 0" class="empty-state">
        <Icon icon="mdi:map-marker-off-outline" />
        <span>Нет отмеченных локаций</span>
      </div>

      <KitMap
        v-else
        :center="mapCenter"
        :zoom="10"
        height="100%"
        :markers="mapMarkers"
        :routes="mapRoutes"
        :auto-pan="true"
        class="interactive-map"
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
