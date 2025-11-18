<script setup lang="ts">
import type Map from 'ol/Map'
import type { LocationCoords } from '../../models/types'
import { Feature } from 'ol'
import { Point } from 'ol/geom'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Icon as OlIcon, Style } from 'ol/style'
import { computed, nextTick, ref, watch } from 'vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitMap } from '~/components/01.kit/kit-map'

interface Props {
  location: LocationCoords | undefined
  title?: string
  visible: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Просмотр локации',
})
const emit = defineEmits(['update:visible'])

const mapInstance = ref<Map | null>(null)
const markerSource = new VectorSource()
const markerLayer = new VectorLayer({ source: markerSource, zIndex: 10 })

const center = computed((): [number, number] => {
  return [
    props.location?.lon ?? 37.61,
    props.location?.lat ?? 55.75,
  ]
})

function updateMarkerPosition() {
  if (!mapInstance.value || !props.location)
    return
  markerSource.clear()
  const marker = new Feature({
    geometry: new Point([props.location.lon, props.location.lat]),
  })
  const svg = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#3498db"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>`
  marker.setStyle(
    new Style({
      image: new OlIcon({
        src: `data:image/svg+xml;base64,${btoa(svg)}`,
        scale: 1.5,
        anchor: [0.5, 1],
      }),
    }),
  )
  markerSource.addFeature(marker)
}

function onMapReady(map: Map) {
  mapInstance.value = map
  mapInstance.value.addLayer(markerLayer)
  updateMarkerPosition()
}

watch(() => props.visible, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      if (mapInstance.value) {
        mapInstance.value.getView().setCenter(center.value)
        mapInstance.value.updateSize()
        updateMarkerPosition()
      }
    })
  }
})

function closeModal() {
  emit('update:visible', false)
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    :title="title"
    icon="mdi:map-marker"
    :max-width="800"
    content-class="location-dialog-content"
    @update:visible="closeModal"
  >
    <div class="location-viewer-content">
      <KitMap :center="center" :zoom="14" @map-ready="onMapReady" />
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.location-viewer-content {
  height: 100%;
  min-height: 400px;
  display: flex;
  flex-direction: column;

  :deep(.ol-viewport) {
    min-height: 600px;
  }
}
</style>
