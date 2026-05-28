<script setup lang="ts">
import KitBtn from '~/components/01.kit/kit-btn/ui/kit-btn.vue'

defineProps<{
  showList: boolean
  isFullscreen: boolean
  hasCities: boolean
  showReset?: boolean
}>()

defineEmits<{
  toggleList: []
  toggleFullscreen: []
  reset: []
}>()
</script>

<template>
  <div class="trip-map-toolbar trip-map-toolbar-left">
    <KitBtn
      v-if="hasCities"
      variant="text"
      color="secondary"
      size="sm"
      :icon="showList ? 'mdi:format-list-bulleted-square' : 'mdi:format-list-bulleted'"
      class="trip-map-toolbar-btn"
      :class="{ 'trip-map-toolbar-btn-active': showList }"
      :aria-label="showList ? 'Скрыть список' : 'Список мест'"
      @click.stop="$emit('toggleList')"
    />
  </div>

  <div class="trip-map-toolbar trip-map-toolbar-right">
    <KitBtn
      v-if="showReset"
      variant="text"
      color="secondary"
      size="sm"
      icon="mdi:image-filter-center-focus"
      class="trip-map-toolbar-btn reset-btn"
      title="Сбросить центрирование карты"
      @click.stop="$emit('reset')"
    />

    <KitBtn
      variant="text"
      color="secondary"
      size="sm"
      :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'"
      class="trip-map-toolbar-btn"
      :aria-label="isFullscreen ? 'Выйти из полноэкранного режима' : 'Открыть на весь экран'"
      @click.stop="$emit('toggleFullscreen')"
    />
  </div>
</template>

<style scoped lang="scss">
.trip-map-toolbar {
  position: absolute;
  top: 10px;
  z-index: 10;
  display: flex;
  gap: 8px;

  &-left {
    left: 10px;
  }

  &-right {
    right: 10px;
  }
}

:deep(.trip-map-toolbar-btn) {
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--border-secondary-color);
  background: rgba(var(--bg-secondary-color-rgb), 0.85);
  backdrop-filter: blur(6px);
  box-shadow: none;
}

:deep(.trip-map-toolbar-btn:hover) {
  background: rgba(var(--bg-secondary-color-rgb), 0.97);
  transform: none;
}

:deep(.trip-map-toolbar-btn-active) {
  color: var(--fg-accent-color);
  box-shadow: 0 0 0 2px var(--fg-accent-color);
}

:deep(.reset-btn) {
  color: var(--fg-primary-color);
}
</style>
