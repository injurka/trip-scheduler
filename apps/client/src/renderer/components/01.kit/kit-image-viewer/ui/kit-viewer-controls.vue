<script setup lang="ts">
import type { ImageQuality } from '../models/types'
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import { Icon } from '@iconify/vue'
import KitViewerDropdown from './kit-viewer-dropdown.vue'

interface Props {
  isUiVisible: boolean
  canZoomIn: boolean
  canZoomOut: boolean
  isZoomed: boolean
  hasMetadata: boolean
  quality: ImageQuality
  showQualitySelector: boolean
  showInfoButton: boolean
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
}>()

const qualityOptions: KitDropdownItem<ImageQuality>[] = [
  { value: 'medium', label: 'Среднее', icon: 'mdi:quality-medium' },
  { value: 'large', label: 'Высокое', icon: 'mdi:quality-high' },
  { value: 'original', label: 'Оригинал', icon: 'mdi:raw' },
]

const qualityIcon = computed(() => qualityOptions.find(q => q.value === props.quality)?.icon || 'mdi:image-outline')

const currentQuality = computed({
  get: () => props.quality,
  set: (value: ImageQuality) => emit('update:quality', value),
})
</script>

<template>
  <div class="control-buttons">
    <button
      class="control-btn"
      :title="isUiVisible ? 'Скрыть интерфейс' : 'Показать интерфейс'"
      @click="emit('update:isUiVisible', !isUiVisible)"
    >
      <Icon :icon="isUiVisible ? 'mdi:eye-off-outline' : 'mdi:eye-outline'" />
    </button>
    <div v-if="isUiVisible" class="control-buttons-group">
      <KitViewerDropdown
        v-if="showQualitySelector"
        v-model="currentQuality"
        :items="qualityOptions"
        align="end"
      >
        <template #trigger>
          <button class="control-btn" title="Выбрать качество">
            <Icon :icon="qualityIcon" />
          </button>
        </template>
      </KitViewerDropdown>
      <button
        v-if="hasMetadata && showInfoButton"
        class="control-btn"
        title="Информация о снимке"
        @click="emit('showMetadata')"
      >
        <Icon icon="mdi:information-outline" />
      </button>
      <button
        class="control-btn"
        title="Reset zoom"
        :disabled="!isZoomed"
        @click="emit('resetTransform')"
      >
        <Icon icon="mdi:backup-restore" />
      </button>
    </div>
    <button class="close-btn" title="Close" @click="emit('close')">
      <Icon icon="mdi:close" />
    </button>
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
  background: var(--bg-tertiary-color);
  color: var(--fg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-m);
  width: 40px;
  height: 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--bg-hover-color);
    border-color: var(--border-secondary-color);
    transform: scale(1.05);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.close-btn {
  background: var(--bg-error-color);
  color: var(--fg-error-color);
  border: 1px solid var(--border-error-color);
  border-radius: var(--r-m);
  width: 40px;
  height: 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: all 0.2s ease;

  &:hover {
    background: var(--border-error-color);
    color: var(--fg-primary-color);
    transform: scale(1.05);
  }
  &:active {
    transform: scale(0.95);
  }
}

@include media-down(md) {
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
