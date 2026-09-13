<script setup lang="ts">
import type { LocationCoords } from '../../models/types'
import type { MapMarker } from '~/components/01.kit/kit-map'
import { computed } from 'vue'
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

const center = computed((): [number, number] => {
  return [
    props.location?.lon ?? 37.61,
    props.location?.lat ?? 55.75,
  ]
})

const markers = computed<MapMarker[]>(() => {
  if (!props.location)
    return []
  return [
    {
      id: 'booking-location-marker',
      coords: props.location,
    },
  ]
})

function closeModal() {
  emit('update:visible', false)
}
</script>

<template>
  <KitDialogWithClose
    v-if="visible"
    :visible="visible"
    :title="title"
    icon="mdi:map-marker"
    :max-width="800"
    content-class="location-dialog-content"
    @update:visible="closeModal"
  >
    <div class="location-viewer-content">
      <KitMap :center="center" :zoom="14" :markers="markers" height="500px" />
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
:deep(.location-dialog-content) {
  height: 600px;
  max-height: 85vh;
}

.location-viewer-content {
  height: 100%;
  min-height: 500px;
  display: flex;
  flex-direction: column;

  :deep(.kit-map-wrapper) {
    flex: 1;
    min-height: 500px;
  }
}
</style>
