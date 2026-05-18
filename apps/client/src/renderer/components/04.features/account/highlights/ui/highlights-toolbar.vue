<script setup lang="ts">
import type { HighlightImageQuality } from '../composables/use-highlights'
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'

const props = defineProps<{
  quality: HighlightImageQuality
}>()

const emit = defineEmits<{
  (e: 'update:quality', value: HighlightImageQuality): void
  (e: 'create'): void
}>()

const qualityOptions: KitDropdownItem<HighlightImageQuality>[] = [
  { value: 'medium', label: 'Среднее качество', icon: 'mdi:quality-medium' },
  { value: 'large', label: 'Высокое качество', icon: 'mdi:quality-high' },
  { value: 'original', label: 'Оригинал', icon: 'mdi:raw' },
]

const localQuality = computed({
  get: () => props.quality,
  set: value => emit('update:quality', value),
})
</script>

<template>
  <div class="highlights-toolbar">
    <div class="toolbar-left">
      <KitDropdown v-model="localQuality" :items="qualityOptions">
        <template #trigger>
          <KitBtn
            variant="subtle"
            color="secondary"
            size="sm"
            icon="mdi:image-size-select-actual"
          >
            Качество
          </KitBtn>
        </template>
      </KitDropdown>
    </div>

    <div class="toolbar-right">
      <KitBtn size="sm" @click="emit('create')">
        <Icon icon="mdi:plus" />
        <span class="desktop-only">Добавить фото</span>
      </KitBtn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.highlights-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.desktop-only {
  @include media-down(sm) {
    display: none;
  }
}
</style>
