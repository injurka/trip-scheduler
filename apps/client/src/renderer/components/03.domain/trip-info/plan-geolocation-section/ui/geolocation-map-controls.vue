<script setup lang="ts">
import type { Map } from 'ol'
import type { TileSourceId } from '../constant/map-styles'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { TILE_SOURCES } from '../constant/map-styles'

interface Props {
  mapInstance: Map | null
  isFullscreen: boolean
  portalTarget?: HTMLElement
  withPanel?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'togglePanel'): void
  (e: 'toggleFullscreen'): void
  (e: 'setTileSource', sourceId: TileSourceId): void
  (e: 'centerOnMyLocation'): void
}>()

const tillerItems = computed(() => Object.entries(TILE_SOURCES).map(([id, { label, icon }]) => ({
  value: id as TileSourceId,
  label,
  icon,
})))

function zoomIn() {
  const view = props.mapInstance?.getView()
  const currentZoom = view?.getZoom()
  if (view && currentZoom !== undefined) {
    view.animate({ zoom: currentZoom + 1, duration: 250 })
  }
}

function zoomOut() {
  const view = props.mapInstance?.getView()
  const currentZoom = view?.getZoom()
  if (view && currentZoom !== undefined) {
    view.animate({ zoom: currentZoom - 1, duration: 250 })
  }
}
</script>

<template>
  <div class="custom-map-controls">
    <KitBtn
      variant="outlined"
      color="secondary"
      icon="mdi:crosshairs-gps"
      aria-label="Мое местоположение"
      @click="$emit('centerOnMyLocation')"
    />
    <div class="zoom-controls">
      <KitBtn
        variant="outlined"
        color="secondary"
        icon="mdi:plus"
        aria-label="Приблизить"
        @click="zoomIn"
      />
      <KitBtn
        variant="outlined"
        color="secondary"
        icon="mdi:minus"
        aria-label="Отдалить"
        @click="zoomOut"
      />
    </div>
    <KitDropdown :items="tillerItems" :portal-target="portalTarget" @update:model-value="emit('setTileSource', $event as TileSourceId)">
      <template #trigger>
        <KitBtn
          variant="outlined"
          color="secondary"
          icon="mdi:layers-outline"
          aria-label="Слои карты"
        />
      </template>
    </KitDropdown>
    <KitBtn
      variant="outlined"
      color="secondary"
      :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'"
      aria-label="Во весь экран"
      @click="emit('toggleFullscreen')"
    />
    <KitBtn
      v-if="isFullscreen && withPanel"
      variant="outlined"
      color="secondary"
      icon="mdi:view-list"
      aria-label="Показать/скрыть панель"
      @click="emit('togglePanel')"
    />
  </div>
</template>

<style scoped lang="scss">
.custom-map-controls {
  position: absolute;
  top: calc(12px + env(safe-area-inset-top));
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 8;

  .kit-btn,
  :deep(.kit-btn) {
    padding: 0;
    width: 26px;
    height: 26px;
    flex-shrink: 0;
    background-color: var(--bg-secondary-color);

    &:hover {
      background-color: var(--bg-hover-color);
    }
  }
}

.zoom-controls {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
