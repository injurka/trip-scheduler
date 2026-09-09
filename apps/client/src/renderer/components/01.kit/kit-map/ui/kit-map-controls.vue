<script setup lang="ts">
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { MapLayerOption } from '../models/types'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'

import { CustomTileSettingsDialog } from '~/components/02.shared/custom-tile-settings-dialog'
import { useAppSettingsStore } from '~/shared/store/app-settings.store'

interface Props {
  mapInstance: MapLibreMap | null
  layers?: MapLayerOption[]
  activeLayerId?: string
}

const props = withDefaults(defineProps<Props>(), {
  layers: () => [],
})

const emit = defineEmits<{
  (e: 'zoomIn'): void
  (e: 'zoomOut'): void
  (e: 'update:activeLayerId', id: string): void
  (e: 'tileSettingsApplied', sourceId: 'custom' | 'maptilerStreets'): void
}>()

const appSettingsStore = useAppSettingsStore()
const isTileSettingsOpen = ref(false)

function handleTileApplied(sourceId: 'custom' | 'maptilerStreets') {
  emit('update:activeLayerId', sourceId)
  emit('tileSettingsApplied', sourceId)
}

const dropDownLayers = computed(() => {
  return [
    ...props.layers.map(l => ({
      value: l.id,
      label: l.id === 'custom' && appSettingsStore.customTileName ? appSettingsStore.customTileName : l.label,
      icon: l.icon,
    })),
    {
      value: 'configure_custom',
      label: 'Настроить свои тайлы...',
      icon: 'mdi:cog-outline',
    },
  ]
})

function handleLayerSelect(val: any) {
  if (val === 'configure_custom') {
    isTileSettingsOpen.value = true
    return
  }
  if (val === 'custom' && !appSettingsStore.customTileUrl) {
    isTileSettingsOpen.value = true
    return
  }
  emit('update:activeLayerId', val as string)
}
</script>

<template>
  <div class="kit-map-controls">
    <div class="control-group zoom-group">
      <KitBtn
        variant="text"
        color="secondary"
        icon="mdi:plus"
        size="sm"
        class="map-btn top"
        title="Приблизить"
        @click="emit('zoomIn')"
      />
      <div class="divider" />
      <KitBtn
        variant="text"
        color="secondary"
        icon="mdi:minus"
        size="sm"
        class="map-btn bottom"
        title="Отдалить"
        @click="emit('zoomOut')"
      />
    </div>

    <div v-if="layers.length > 0" class="control-group layer-group">
      <KitDropdown
        :items="dropDownLayers"
        :model-value="activeLayerId"
        align="end"
        @update:model-value="handleLayerSelect"
      >
        <template #trigger>
          <KitBtn
            variant="text"
            color="secondary"
            icon="mdi:layers-outline"
            size="sm"
            class="map-btn single"
            title="Слои карты"
          />
        </template>
      </KitDropdown>
    </div>

    <CustomTileSettingsDialog
      v-model="isTileSettingsOpen"
      @applied="handleTileApplied"
    />
  </div>
</template>

<style scoped lang="scss">
.kit-map-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 20;
}

.control-group {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.divider {
  height: 1px;
  background-color: var(--border-secondary-color);
  width: 100%;
}

:deep(.map-btn) {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 0;
  border: none;
  background-color: var(--bg-secondary-color);
  color: var(--fg-secondary-color);

  .kit-btn-content {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }

  .iconify {
    font-size: 1.2rem;
  }

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }
}
</style>
