<script setup lang="ts">
import type { MapPoint } from '~/components/03.domain/trip-info/geolocation-section'
import type { PostDetail } from '~/shared/types/models/post'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import GeolocationMap from '~/components/03.domain/trip-info/geolocation-section/ui/geolocation-map.vue'

interface Props {
  visible: boolean
  post: PostDetail
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()

const mapPoints = computed<MapPoint[]>(() => {
  const points: MapPoint[] = []
  props.post.elements.forEach((element, sIndex) => {
    element.content.forEach((block) => {
      if (block.type === 'location' && block.location && block.location.lat) {
        points.push({
          id: block.id,
          type: 'poi',
          coordinates: [block.location.lng, block.location.lat],
          address: block.location.address,
          comment: block.location.label,
          style: {
            color: getColorForIndex(sIndex),
          },
        })
      }
    })
  })
  return points
})

const mapCenter = computed((): [number, number] => {
  if (mapPoints.value.length > 0) {
    return mapPoints.value[0].coordinates
  }

  return [props.post.longitude, props.post.latitude]
})

function getColorForIndex(index: number) {
  const colors = ['#7367F0', '#28C76F', '#EA5455', '#FF9F43', '#00CFE8']
  return colors[index % colors.length]
}

function handleMapReady() { }
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Карта маршрута"
    icon="mdi:map-legend"
    :max-width="1000"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="map-modal-content">
      <div v-if="mapPoints.length === 0" class="empty-map">
        <p>В этом посте нет отмеченных локаций.</p>
      </div>
      <GeolocationMap
        v-else
        :points="mapPoints"
        :routes="[]"
        :drawn-routes="[]"
        mode="pan"
        :center="mapCenter"
        height="600px"
        :is-loading="false"
        :readonly="true"
        :is-fullscreen="false"
        :with-panel="false"
        @map-ready="handleMapReady"
      />
    </div>
  </KitDialogWithClose>
</template>

<style scoped>
.map-modal-content {
  height: 600px;
  background: var(--bg-tertiary-color);
  border-radius: var(--r-m);
  overflow: hidden;
}

.empty-map {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-secondary-color);
}
</style>
