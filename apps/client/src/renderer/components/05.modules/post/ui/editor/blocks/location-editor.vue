<script setup lang="ts">
import type { LocationBlock } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { KitInput } from '~/components/01.kit/kit-input'
import PostMapPicker from '../tools/post-map-picker.vue'

defineProps<{
  block: LocationBlock
}>()

const emit = defineEmits<{
  (e: 'update', payload: Partial<LocationBlock>): void
}>()

const isMapOpen = ref(false)

function handleMapConfirm(coords: { lat: number, lng: number }) {
  emit('update', { coords })
}
</script>

<template>
  <div class="location-editor">
    <div class="inputs-row">
      <div class="main-inputs">
        <KitInput
          :model-value="block.name"
          placeholder="Название места (напр. Эйфелева башня)"
          class="name-input"
          @update:model-value="val => emit('update', { name: val as string })"
        />
        <KitInput
          :model-value="block.address"
          placeholder="Адрес (текстом)"
          icon="mdi:map-marker-outline"
          size="sm"
          @update:model-value="val => emit('update', { address: val as string })"
        />
      </div>

      <button
        class="map-btn"
        :class="{ 'has-coords': block.coords?.lat }"
        @click="isMapOpen = true"
      >
        <Icon icon="mdi:map-search-outline" />
        <span v-if="block.coords?.lat" class="coords-badge">✓</span>
      </button>
    </div>

    <PostMapPicker
      v-model:visible="isMapOpen"
      :initial-coords="block.coords"
      @confirm="handleMapConfirm"
    />
  </div>
</template>

<style scoped lang="scss">
.location-editor {
  width: 100%;
}

.inputs-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.main-inputs {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.name-input :deep(input) {
  font-weight: 600;
}

.map-btn {
  width: 42px;
  height: 42px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.2s;
  flex-shrink: 0;
  margin-top: 2px;

  &:hover {
    background: var(--bg-hover-color);
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
  }

  &.has-coords {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    background: rgba(var(--fg-accent-color-rgb), 0.1);
  }
}

.coords-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--fg-success-color);
  color: white;
  font-size: 10px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
