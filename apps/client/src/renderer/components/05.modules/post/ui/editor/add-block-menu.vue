<script setup lang="ts">
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { TimelineBlockType } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'

const emit = defineEmits<{ (e: 'select', type: TimelineBlockType): void }>()

const items: KitDropdownItem[] = [
  { value: 'text', label: 'Текст', icon: 'mdi:text' },
  { value: 'gallery', label: 'Галерея', icon: 'mdi:image-multiple' },
  { value: 'location', label: 'Точка', icon: 'mdi:map-marker' },
  { value: 'route', label: 'Маршрут', icon: 'mdi:directions' },
]
</script>

<template>
  <KitDropdown :items="items" align="center" @update:model-value="val => emit('select', val as TimelineBlockType)">
    <template #trigger>
      <button class="add-block-btn">
        <Icon icon="mdi:plus" />
      </button>
    </template>
  </KitDropdown>
</template>

<style scoped>
.add-block-btn {
  width: 100%;
  padding: 8px;
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-s);
  color: var(--fg-tertiary-color);
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: center;
  align-items: center;
}
.add-block-btn:hover {
  border-color: var(--fg-accent-color);
  color: var(--fg-accent-color);
  background: var(--bg-hover-color);
}
</style>
