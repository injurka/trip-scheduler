<script setup lang="ts">
import type { MapMarker } from '~/components/01.kit/kit-map'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitMap, useKitMapSearch } from '~/components/01.kit/kit-map'
import { useToast } from '~/shared/composables/use-toast'

interface Props {
  visible: boolean
  initialCoords?: { lat: number, lng: number }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', coords: { lat: number, lng: number }): void
}>()

const selectedCoords = ref<{ lat: number, lon: number } | null>(null)
const markers = ref<MapMarker[]>([])
const searchQuery = ref('')

const { searchLocation, isSearching } = useKitMapSearch()

function handleMapClick(coords: [number, number]) {
  selectedCoords.value = { lat: coords[1], lon: coords[0] }
  updateMarker()
}

function updateMarker() {
  if (!selectedCoords.value)
    return

  markers.value = [{
    id: 'selected-point',
    coords: selectedCoords.value,
  }]
}

async function handleSearch() {
  if (!searchQuery.value.trim())
    return

  try {
    const result = await searchLocation(searchQuery.value)

    if (result) {
      selectedCoords.value = { lat: result.lat, lon: result.lon }
      updateMarker()
      useToast().success(`Найдено: ${result.displayName.split(',')[0]}`)
    }
    else {
      useToast().error('Место не найдено')
    }
  }
  catch {
    useToast().error('Ошибка при поиске локации')
  }
}

function handleConfirm() {
  if (selectedCoords.value) {
    emit('confirm', { lat: selectedCoords.value.lat, lng: selectedCoords.value.lon })
    emit('update:visible', false)
  }
}

const mapCenter = computed((): [number, number] => {
  if (selectedCoords.value)
    return [selectedCoords.value.lon, selectedCoords.value.lat]
  return [37.6173, 55.7558] // Москва по умолчанию
})

watch(() => props.visible, (isOpen) => {
  if (isOpen) {
    if (props.initialCoords && props.initialCoords.lat !== 0) {
      selectedCoords.value = { lat: props.initialCoords.lat, lon: props.initialCoords.lng }
      updateMarker()
    }
    else {
      selectedCoords.value = null
      markers.value = []
    }
    searchQuery.value = ''
  }
})
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Указать местоположение"
    :max-width="700"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="picker-content">
      <div class="search-bar">
        <KitInput
          v-model="searchQuery"
          placeholder="Введите адрес или место..."
          size="sm"
          @keydown.enter="handleSearch"
        />
        <KitBtn
          icon="mdi:magnify"
          size="xs"
          variant="solid"
          :loading="isSearching"
          @click="handleSearch"
        />
      </div>

      <div class="map-wrapper">
        <KitMap
          :center="mapCenter"
          :zoom="12"
          :markers="markers"
          height="100%"
          @click="handleMapClick"
        />
      </div>

      <div class="picker-footer">
        <div v-if="selectedCoords" class="coords-info">
          {{ selectedCoords.lat.toFixed(6) }}, {{ selectedCoords.lon.toFixed(6) }}
        </div>
        <div v-else class="coords-info placeholder">
          Кликните на карту или используйте поиск
        </div>

        <div class="actions">
          <KitBtn variant="outlined" color="secondary" @click="emit('update:visible', false)">
            Отмена
          </KitBtn>
          <KitBtn :disabled="!selectedCoords" @click="handleConfirm">
            Выбрать
          </KitBtn>
        </div>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.picker-content {
  display: flex;
  flex-direction: column;
  height: 60vh;
  gap: 12px;
}

.search-bar {
  display: flex;
  gap: 8px;

  :deep(.kit-input-wrapper) {
    flex: 1;
  }
}

.map-wrapper {
  flex: 1;
  border-radius: var(--r-m);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-tertiary-color);
  min-height: 200px;
}

.picker-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.coords-info {
  font-family: monospace;
  font-size: 0.9rem;
  color: var(--fg-primary-color);
  background: var(--bg-tertiary-color);
  padding: 4px 8px;
  border-radius: var(--r-s);

  &.placeholder {
    color: var(--fg-tertiary-color);
    font-family: inherit;
  }
}

.actions {
  display: flex;
  gap: 8px;
}
</style>
