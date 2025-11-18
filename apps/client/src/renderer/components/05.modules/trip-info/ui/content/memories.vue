<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useDropZone } from '@vueuse/core'
import { TripMemoriesView } from '~/components/04.features/trip-info/trip-memories'
import { useModuleStore } from '../../composables/use-trip-info-module'

const { ui, memories } = useModuleStore(['ui', 'memories'])
const { activeView, isViewMode } = storeToRefs(ui)

const dropZoneRef = ref<HTMLDivElement | null>(null)

const { isOverDropZone } = useDropZone(dropZoneRef, { onDrop })

function onDrop(files: File[] | null) {
  if (!files || activeView.value !== 'memories' || isViewMode.value)
    return

  const imageFiles = files.filter(file => file.type.startsWith('image/'))
  if (imageFiles.length > 0)
    memories.enqueueFilesForUpload(imageFiles)
}
</script>

<template>
  <TripMemoriesView ref="dropZoneRef" />

  <div v-if="isOverDropZone && activeView === 'memories' && !isViewMode" class="drop-overlay">
    <div class="drop-overlay-content">
      <Icon icon="mdi:upload-multiple" />
      <span>Перетащите файлы сюда для загрузки</span>
    </div>
  </div>
</template>
