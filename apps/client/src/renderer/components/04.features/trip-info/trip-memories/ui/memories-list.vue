<script setup lang="ts">
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { IProcessingMemory } from '~/components/04.features/trip-info/trip-memories/store'
import type { IMemory } from '~/components/05.modules/trip-info/models/types'
import type { Activity } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import MemoriesMap from './memories-map.vue'
import ProcessingQueue from './processing/processing-queue.vue'
import UploadingIndicator from './processing/uploading-indicator.vue'
import MemoriesTimeline from './timeline/memories-timeline.vue'

interface Props {
  memories: IMemory[]
  galleryImages: ImageViewerImage[]
  importOptions: { value: Activity, label: string, icon?: string }[]
  isViewMode: boolean
  isProcessing: boolean
  processingMemories: IProcessingMemory[]
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'upload'): void
  (e: 'addNote'): void
  (e: 'addActivity'): void
  (e: 'import', activity: Activity): void
}>()

const { memories: memoriesStore } = useModuleStore(['memories'])
const { memoriesWithGeo, memoriesToProcess } = storeToRefs(memoriesStore)

const isMapVisible = ref(false)
</script>

<template>
  <div class="memories-list">
    <div v-if="!isViewMode" class="upload-section">
      <button class="upload-button" :disabled="isProcessing" @click="emit('upload')">
        <Icon :icon="isProcessing ? 'mdi:loading' : 'mdi:camera-plus-outline'" :class="{ spin: isProcessing }" />
        <span>{{ isProcessing ? `Загрузка (${processingMemories.length})...` : 'Загрузить фотографии' }}</span>
      </button>
      <button class="add-note-button" @click="emit('addActivity')">
        <Icon icon="mdi:plus-box-outline" />
        <span>Добавить активность</span>
      </button>
      <button class="add-note-button" @click="emit('addNote')">
        <Icon icon="mdi:note-plus-outline" />
        <span>Добавить заметку</span>
      </button>
      <KitDropdown :items="importOptions" align="end" @update:model-value="emit('import', $event)">
        <template #trigger>
          <button class="add-note-button" :disabled="importOptions.length === 0">
            <Icon icon="mdi:import" />
            <span>Импорт из плана</span>
          </button>
        </template>
      </KitDropdown>
    </div>

    <UploadingIndicator
      v-if="isProcessing"
      :processing-memories="processingMemories"
      @cancel="memoriesStore.cancelMemoryUpload"
      @retry="memoriesStore.retryMemoryUpload"
      @remove="memoriesStore.removeProcessingMemory"
    />

    <ProcessingQueue v-if="!isViewMode && memoriesToProcess.length > 0" />

    <MemoriesMap
      v-if="isMapVisible"
      :memories="memoriesWithGeo"
      @close="isMapVisible = false"
    />

    <MemoriesTimeline
      v-if="memories.length > 0"
      :memories="memories"
      :is-view-mode="isViewMode"
      :gallery-images="galleryImages"
    />

    <div v-if="memoriesWithGeo.length > 0 && !isMapVisible" class="map-button-container">
      <KitBtn
        variant="outlined"
        color="secondary"
        @click="isMapVisible = true"
      >
        <Icon icon="mdi:map-marker-outline" />
        Показать фотографии на карте
      </KitBtn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.memories-list {
  display: flex;
  flex-direction: column;
  gap: 32px;
  margin-bottom: 16px;
}

.upload-section {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 24px;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-l);
  border: 1px solid var(--border-secondary-color);
  margin-top: 16px;

  @include media-up(sm) {
    grid-template-columns: repeat(2, 1fr);
  }
  @include media-up(md) {
    grid-template-columns: repeat(4, 1fr);
  }
}

.upload-button,
.add-note-button {
  flex: 1;
  padding: 16px;
  border-radius: var(--r-s);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.upload-button {
  background-color: transparent;
  border: 2px dashed var(--border-primary-color);
  color: var(--fg-accent-color);
  grid-column: 1 / -1;

  @include media-up(sm) {
    grid-column: auto;
  }

  &:hover:not(:disabled) {
    background-color: var(--bg-hover-color);
    border-color: var(--fg-accent-color);
  }
  &:disabled {
    cursor: wait;
    opacity: 0.7;
  }
}

.add-note-button {
  background-color: var(--bg-tertiary-color);
  border: 2px solid var(--bg-tertiary-color);
  color: var(--fg-primary-color);
  &:hover:not(:disabled) {
    background-color: var(--bg-hover-color);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.map-button-container {
  display: flex;
  justify-content: center;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-secondary-color);
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
