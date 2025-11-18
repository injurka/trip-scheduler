<script setup lang="ts">
import type { Map } from 'ol'
import { KitBtn } from '~/components/01.kit/kit-btn'

interface Props {
  mapInstance: Map | null
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'zoomIn'): void
  (e: 'zoomOut'): void
}>()
</script>

<template>
  <div class="kit-map-controls">
    <KitBtn
      variant="outlined"
      color="secondary"
      icon="mdi:plus"
      aria-label="Приблизить"
      @click="emit('zoomIn')"
    />
    <KitBtn
      variant="outlined"
      color="secondary"
      icon="mdi:minus"
      aria-label="Отдалить"
      @click="emit('zoomOut')"
    />
  </div>
</template>

<style scoped lang="scss">
.kit-map-controls {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-radius: var(--r-s);
  overflow: hidden;
  box-shadow: var(--s-m);

  .kit-btn {
    padding: 0;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    background-color: var(--bg-secondary-color);
    border-radius: 0;
    box-shadow: none;
    border: none;

    &:not(:last-child) {
      border-bottom: 1px solid var(--border-primary-color);
    }

    &:hover {
      background-color: var(--bg-hover-color);
    }
  }
}
</style>
