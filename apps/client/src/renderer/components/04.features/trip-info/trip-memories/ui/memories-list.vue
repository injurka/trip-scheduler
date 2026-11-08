<script setup lang="ts">
import type { IProcessingMemory } from '../types'
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { IMemory } from '~/components/05.modules/trip-info/models/types'
import type { Activity } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { useMediaQuery } from '@vueuse/core'
import { KitBottomSheet } from '~/components/01.kit/kit-bottom-sheet'
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
  isFullScreen?: boolean
}

withDefaults(defineProps<Props>(), {
  isFullScreen: false,
})
const emit = defineEmits<{
  (e: 'upload'): void
  (e: 'addNote'): void
  (e: 'addActivity'): void
  (e: 'import', activity: Activity): void
}>()

const { memories: memoriesStore } = useModuleStore(['memories'])
const isMobile = useMediaQuery('(max-width: 768px)')

const { memoriesWithGeoForSelectedDay, memoriesToProcess } = storeToRefs(memoriesStore)
const isMapVisible = ref(false)
const showImportSheet = ref(false)

function handleImportSelect(activity: Activity) {
  emit('import', activity)
  showImportSheet.value = false
}
</script>

<template>
  <div class="memories-list" :class="{ 'fullscreen-layout': isFullScreen }">
    <div v-if="!isViewMode" class="upload-section">
      <div class="panel-header">
        <span class="panel-title">Добавить в этот день</span>
        <Icon icon="mdi:plus" class="panel-header-icon" aria-hidden="true" />
      </div>

      <button class="upload-button" :disabled="isProcessing" @click="emit('upload')">
        <Icon :icon="isProcessing ? 'mdi:loading' : 'mdi:camera-outline'" class="upload-icon" :class="{ spin: isProcessing }" />
        <span>{{ isProcessing ? `Загрузка (${processingMemories.length})...` : 'Загрузить медиа' }}</span>
      </button>

      <div class="secondary-actions-group">
        <button class="secondary-action-btn" @click="emit('addActivity')">
          <Icon icon="mdi:calendar-plus-outline" class="action-icon" />
          <span>Активность</span>
        </button>

        <button class="secondary-action-btn" @click="emit('addNote')">
          <Icon icon="mdi:notebook-edit-outline" class="action-icon" />
          <span>Заметка</span>
        </button>

        <template v-if="isMobile">
          <button
            class="secondary-action-btn"
            :disabled="importOptions.length === 0"
            @click="showImportSheet = true"
          >
            <Icon icon="mdi:file-import-outline" class="action-icon" />
            <span>Из плана</span>
          </button>

          <KitBottomSheet
            v-model="showImportSheet"
            title="Импорт из плана"
          >
            <div class="import-sheet-list">
              <button
                v-for="item in importOptions"
                :key="String(item.value)"
                class="import-sheet-item"
                @click="handleImportSelect(item.value)"
              >
                <span class="import-sheet-item-icon-wrap">
                  <Icon v-if="item.icon" :icon="item.icon" />
                </span>
                <span class="import-sheet-item-label">{{ item.label }}</span>
              </button>
            </div>
          </KitBottomSheet>
        </template>

        <KitDropdown
          v-else
          :items="importOptions"
          align="end"
          @update:model-value="emit('import', $event)"
        >
          <template #trigger>
            <button class="secondary-action-btn" :disabled="importOptions.length === 0">
              <Icon icon="mdi:file-import-outline" class="action-icon" />
              <span>Из плана</span>
            </button>
          </template>
        </KitDropdown>
      </div>
    </div>

    <UploadingIndicator
      v-if="isProcessing"
      :processing-memories="processingMemories"
      @cancel="memoriesStore.cancelMemoryUpload"
      @retry="memoriesStore.retryMemoryUpload"
      @remove="memoriesStore.removeProcessingMemory"
      @retry-all="memoriesStore.retryAllFailedUploads"
    />

    <ProcessingQueue v-if="!isViewMode && memoriesToProcess.length > 0" />

    <MemoriesTimeline
      v-if="memories.length > 0"
      :is-view-mode="isViewMode"
      :gallery-images="galleryImages"
      :is-full-screen="isFullScreen"
    />

    <div v-if="memoriesWithGeoForSelectedDay.length > 0 && !isMapVisible" class="map-button-container">
      <KitBtn
        variant="outlined"
        color="secondary"
        @click="isMapVisible = true"
      >
        <Icon icon="mdi:map-marker-outline" />
        Показать фотографии на карте
      </KitBtn>
    </div>

    <MemoriesMap
      v-if="isMapVisible"
      :memories="memoriesWithGeoForSelectedDay"
      @close="isMapVisible = false"
    />
  </div>
</template>

<style scoped lang="scss">
.memories-list {
  display: flex;
  flex-direction: column;
  gap: 32px;
  margin-bottom: 16px;

  &.fullscreen-layout {
    gap: 48px;
    max-width: 90%;
    margin: 0 auto;
    width: 100%;
  }
}

.upload-section {
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-l);
  border: 1px solid var(--border-secondary-color);
  margin-top: 16px;

  @include media-down(sm) {
    padding: 14px 14px 12px;
  }

  .fullscreen-layout & {
    max-width: 1200px;
    width: 100%;
    margin: 16px auto;
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  letter-spacing: -0.01em;
}

.panel-header-icon {
  font-size: 1.15rem;
  color: var(--fg-secondary-color);
  opacity: 0.6;
}

.upload-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 13px 18px;
  min-height: 48px;
  border-radius: var(--r-m);
  cursor: pointer;
  background-color: rgba(var(--fg-accent-color-rgb, 255, 136, 86), 0.08);
  border: 1px solid rgba(var(--fg-accent-color-rgb, 255, 136, 86), 0.35);
  color: var(--fg-primary-color);
  font-size: 0.95rem;
  font-weight: 600;
  font-family: inherit;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    transform 0.1s ease;
  white-space: nowrap;

  .upload-icon {
    font-size: 1.35rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
  }

  &:hover:not(:disabled) {
    background-color: rgba(var(--fg-accent-color-rgb, 255, 136, 86), 0.16);
    border-color: var(--fg-accent-color);
  }

  &:active:not(:disabled) {
    transform: scale(0.99);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.7;
  }
}

.secondary-actions-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 10px;
  width: 100%;
}

.secondary-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 54px;
  padding: 10px 6px;
  border-radius: var(--r-m);
  background-color: transparent;
  border: 1px solid transparent;
  color: var(--fg-primary-color);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    transform 0.1s ease;
  font-size: 0.8rem;
  font-weight: 500;
  font-family: inherit;
  line-height: 1.2;
  white-space: nowrap;

  .action-icon {
    font-size: 1.35rem;
    color: var(--fg-primary-color);
    transition: transform 0.15s ease;
  }

  &:hover:not(:disabled) {
    background-color: var(--bg-hover-color);
    border-color: var(--border-secondary-color);

    .action-icon {
      transform: translateY(-1px);
    }
  }

  &:active:not(:disabled) {
    transform: scale(0.97);
    background-color: var(--bg-tertiary-color);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.import-sheet-list {
  display: flex;
  flex-direction: column;
  padding: 8px 0 16px;
}

.import-sheet-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease;
  width: 100%;

  &:hover,
  &:active {
    background-color: var(--bg-hover-color);
  }

  &-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--r-s);
    background-color: var(--bg-secondary-color);
    color: var(--fg-secondary-color);
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  &-label {
    flex-grow: 1;
    font-size: 0.95rem;
    color: var(--fg-primary-color);
    line-height: 1.4;
    text-align: left;
  }
}

.map-button-container {
  display: flex;
  justify-content: center;
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
