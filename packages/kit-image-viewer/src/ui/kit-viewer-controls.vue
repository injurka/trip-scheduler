<script setup lang="ts">
import type { ImageQuality, KitViewerDropdownItem } from '../models/types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import KitViewerDropdown from './kit-viewer-dropdown.vue'
import KitViewerTooltip from './kit-viewer-tooltip.vue'

interface Props {
  isUiVisible: boolean
  canZoomIn: boolean
  canZoomOut: boolean
  isZoomed: boolean
  hasMetadata: boolean
  isMetadataLoading?: boolean
  quality: ImageQuality
  qualityItems?: KitViewerDropdownItem<ImageQuality>[]
  showQualitySelector: boolean
  showInfoButton: boolean
  isDownloading?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:isUiVisible', value: boolean): void
  (e: 'update:quality', value: ImageQuality): void
  (e: 'zoom-in'): void
  (e: 'zoom-out'): void
  (e: 'resetTransform'): void
  (e: 'showMetadata'): void
  (e: 'close'): void
  (e: 'download'): void
}>()

const defaultQualityOptions: KitViewerDropdownItem<ImageQuality>[] = [
  { value: 'small', label: 'Small', icon: 'mdi:image-size-select-small' },
  { value: 'medium', label: 'Medium', icon: 'mdi:image-size-select-small' },
  { value: 'large', label: 'Large', icon: 'mdi:image-size-select-large' },
  { value: 'original', label: 'Оригинал', icon: 'mdi:image-size-select-actual' },
]

const activeQualityOptions = computed(() => {
  if (props.qualityItems && props.qualityItems.length > 0)
    return props.qualityItems
  return defaultQualityOptions
})

const qualityIcon = computed(() => activeQualityOptions.value.find(q => q.value === props.quality)?.icon || 'mdi:image-outline')

const currentQuality = computed({
  get: () => props.quality,
  set: (value: ImageQuality) => emit('update:quality', value),
})
</script>

<template>
  <div class="control-buttons">
    <KitViewerTooltip :text="isUiVisible ? 'Скрыть интерфейс' : 'Показать интерфейс'">
      <button
        class="control-btn"
        @click="emit('update:isUiVisible', !isUiVisible)"
      >
        <Icon :icon="isUiVisible ? 'mdi:eye-off-outline' : 'mdi:eye-outline'" />
      </button>
    </KitViewerTooltip>
    <div v-if="isUiVisible" class="control-buttons-group">
      <KitViewerTooltip v-if="showQualitySelector && activeQualityOptions.length > 1" text="Выбрать качество">
        <KitViewerDropdown
          v-model="currentQuality"
          :items="activeQualityOptions"
          align="end"
        >
          <template #trigger>
            <button class="control-btn">
              <Icon :icon="qualityIcon" />
            </button>
          </template>
        </KitViewerDropdown>
      </KitViewerTooltip>

      <KitViewerTooltip v-if="showInfoButton" text="Информация о снимке">
        <button
          class="control-btn"
          :class="{ loading: isMetadataLoading }"
          :disabled="isMetadataLoading"
          @click.stop="emit('showMetadata')"
        >
          <Icon v-if="isMetadataLoading" icon="mdi:loading" class="spin" />
          <Icon v-else icon="mdi:information-outline" />
        </button>
      </KitViewerTooltip>

      <KitViewerTooltip text="Сбросить масштаб">
        <button
          class="control-btn"
          :disabled="!isZoomed"
          @click="emit('resetTransform')"
        >
          <Icon icon="mdi:backup-restore" />
        </button>
      </KitViewerTooltip>
    </div>

    <KitViewerTooltip text="Закрыть">
      <button class="close-btn" @click="emit('close')">
        <Icon icon="mdi:close" />
      </button>
    </KitViewerTooltip>
  </div>
</template>

<style scoped lang="scss">
.control-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}

.control-buttons-group {
  display: contents;
}

.control-btn {
  background: var(--bg-tertiary-color, rgba(40, 40, 40, 0.7));
  color: var(--fg-primary-color, #ffffff);
  border: 1px solid var(--border-primary-color, rgba(255, 255, 255, 0.2));
  border-radius: var(--r-m, 8px);
  width: 40px;
  height: 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);

  &:hover:not(:disabled) {
    background: var(--bg-hover-color, rgba(255, 255, 255, 0.2));
    border-color: var(--border-secondary-color, rgba(255, 255, 255, 0.3));
    transform: scale(1.05);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.loading {
    cursor: wait;
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

.close-btn {
  background: var(--bg-error-color, rgba(239, 68, 68, 0.2));
  color: var(--fg-error-color, #ef4444);
  border: 1px solid var(--border-error-color, rgba(239, 68, 68, 0.4));
  border-radius: var(--r-m, 8px);
  width: 40px;
  height: 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);

  &:hover {
    background: var(--border-error-color, #ef4444);
    color: #ffffff;
    transform: scale(1.05);
  }
  &:active {
    transform: scale(0.95);
  }
}

@media (max-width: 959px) {
  .control-btn,
  .close-btn {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }
  .close-btn {
    font-size: 18px;
  }
  .control-buttons {
    gap: 6px;
  }
}
</style>
