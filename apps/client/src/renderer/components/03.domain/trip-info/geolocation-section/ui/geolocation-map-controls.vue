<script setup lang="ts">
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { TileSourceId } from '../../../../../shared/lib/map-styles-sources'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { CustomTileSettingsDialog } from '~/components/02.shared/custom-tile-settings-dialog'

import { useAppSettingsStore } from '~/shared/store/app-settings.store'
import { TILE_SOURCES } from '../../../../../shared/lib/map-styles-sources'

interface Props {
  mapInstance: MapLibreMap | null
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

const appSettingsStore = useAppSettingsStore()
const isTileSettingsOpen = ref(false)

const tillerItems = computed(() => [
  ...Object.entries(TILE_SOURCES).map(([id, { label, icon }]) => ({
    value: id,
    label: id === 'custom' && appSettingsStore.customTileName ? appSettingsStore.customTileName : label,
    icon,
  })),
  {
    value: 'configure_custom',
    label: 'Настроить свои тайлы...',
    icon: 'mdi:cog-outline',
  },
])

function handleTileSourceSelect(selected: any) {
  if (selected === 'configure_custom') {
    isTileSettingsOpen.value = true
    return
  }
  if (selected === 'custom' && !appSettingsStore.customTileUrl) {
    isTileSettingsOpen.value = true
    return
  }
  emit('setTileSource', selected as TileSourceId)
}

function handleTileSettingsApplied(sourceId: any) {
  emit('setTileSource', sourceId as TileSourceId)
}

function zoomIn() {
  if (props.mapInstance) {
    props.mapInstance.zoomTo(props.mapInstance.getZoom() + 1, { duration: 250 })
  }
}

function zoomOut() {
  if (props.mapInstance) {
    props.mapInstance.zoomTo(props.mapInstance.getZoom() - 1, { duration: 250 })
  }
}
</script>

<template>
  <div class="custom-map-controls" :class="{ 'is-fullscreen': isFullscreen }">
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
    <KitDropdown :items="tillerItems" :portal-target="portalTarget" @update:model-value="handleTileSourceSelect">
      <template #trigger>
        <KitBtn
          variant="outlined"
          color="secondary"
          icon="mdi:layers-outline"
          aria-label="Слои карты"
        />
      </template>
    </KitDropdown>

    <CustomTileSettingsDialog
      v-model="isTileSettingsOpen"
      @applied="handleTileSettingsApplied"
    />
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
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 8;

  &.is-fullscreen {
    top: calc(12px + var(--safe-area-inset-top));
  }

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
