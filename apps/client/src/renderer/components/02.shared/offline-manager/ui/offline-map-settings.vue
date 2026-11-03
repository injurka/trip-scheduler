<script setup lang="ts">
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { TileSourceId } from '~/shared/lib/map-styles-sources'
import type { OfflineMapCoverage, OfflineMapOptions } from '~/shared/lib/offline-map-options'
import type { TripWithDays } from '~/shared/types/models/trip'
import { computed, onMounted, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { getCustomTileUrl, getEffectiveMapTilerKey } from '~/shared/lib/map-styles-sources'
import { estimateOfflineMap } from '~/shared/lib/offline-map'
import { getOfflineMapAreas, getOfflineMapStyle } from '~/shared/lib/offline-map-options'

interface Props {
  trip: TripWithDays
  coverage?: OfflineMapCoverage[]
}
const props = defineProps<Props>()
const options = defineModel<OfflineMapOptions>({ required: true })

const availableBytes = ref<number | null>(null)
const hasTerrain = Boolean(getEffectiveMapTilerKey())
const zoomItems: KitDropdownItem<10 | 12 | 15>[] = [
  { label: 'Обзор — масштаб до 10', value: 10 },
  { label: 'Города — масштаб до 12', value: 12 },
  { label: 'Подробно — масштаб до 15', value: 15 },
]
const styleItems: KitDropdownItem<TileSourceId>[] = [
  { label: 'Улицы и город', value: 'maptilerStreets' },
  { label: 'Природа и тропы', value: 'maptilerOutdoor' },
  { label: 'OpenStreetMap', value: 'osm' },
  { label: 'Спутник', value: 'satellite' },
  ...(getCustomTileUrl() ? [{ label: 'Свои тайлы', value: 'custom' as const }] : []),
]

const areas = computed(() => getOfflineMapAreas(props.trip))
const selected = computed(() => options.value.areaIds ?? areas.value.map(area => area.id))
const zoom = computed(() => options.value.maxZoom ?? 15)
const style = computed(() => options.value.style ?? getOfflineMapStyle())
const estimate = computed(() => estimateOfflineMap(props.trip, options.value))
const estimateLabel = computed(() => selected.value.length
  ? `Примерно ${formatSize(estimate.value.minBytes)} – ${formatSize(estimate.value.maxBytes)}`
  : 'Выберите хотя бы одну область')

function formatSize(bytes: number) {
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} ГБ` : `${Math.ceil(bytes / 1024 ** 2)} МБ`
}
function setZoom(value: unknown) {
  if (value === 10 || value === 12 || value === 15)
    options.value = { ...options.value, maxZoom: value }
}
function setStyle(value: unknown) {
  if (value === 'maptilerStreets' || value === 'maptilerOutdoor' || value === 'osm' || value === 'custom' || value === 'satellite')
    options.value = { ...options.value, style: value }
}
function toggleArea(id: string, checked: boolean | undefined) {
  const ids = new Set(selected.value)

  if (checked)
    ids.add(id)
  else
    ids.delete(id)

  options.value = { ...options.value, areaIds: [...ids] }
}
function selectAreas(all: boolean) {
  options.value = { ...options.value, areaIds: all ? areas.value.map(area => area.id) : [] }
}
function setTerrain(terrain: boolean | undefined) {
  options.value = { ...options.value, terrain }
}
function setRefresh(refresh: boolean | undefined) {
  options.value = { ...options.value, refresh }
}
function isSaved(id: string) {
  return props.coverage?.some(part => part.areaId === id && part.style === style.value && part.maxZoom >= zoom.value && part.terrain === Boolean(options.value.terrain))
}

onMounted(async () => {
  try {
    const storage = await navigator.storage?.estimate?.()

    if (storage?.quota !== undefined && storage.usage !== undefined)
      availableBytes.value = Math.max(0, storage.quota - storage.usage)
  }
  catch {
    // Storage estimates are optional, particularly in native WebViews.
  }
})
</script>

<template>
  <section class="map-settings" aria-label="Настройки оффлайн-карты">
    <KitSelectWithSearch
      :model-value="zoom"
      :items="zoomItems"
      label="Детализация карты"
      :clearable="false"
      @update:model-value="setZoom"
    />
    <KitSelectWithSearch
      :model-value="style"
      :items="styleItems"
      label="Вид карты"
      :clearable="false"
      @update:model-value="setStyle"
    />
    <KitCheckbox v-if="hasTerrain" :model-value="Boolean(options.terrain)" @update:model-value="setTerrain">
      Добавить 3D-рельеф (увеличивает объём)
    </KitCheckbox>
    <div class="map-area-actions">
      <span>Области: {{ selected.length }} из {{ areas.length }}</span>
      <KitBtn size="sm" variant="text" @click="selectAreas(true)">
        Все
      </KitBtn>
      <KitBtn size="sm" variant="text" @click="selectAreas(false)">
        Снять
      </KitBtn>
    </div>
    <div class="map-areas">
      <div v-for="area in areas" :key="area.id" class="map-area">
        <KitCheckbox :model-value="selected.includes(area.id)" @update:model-value="toggleArea(area.id, $event)">
          {{ area.title }}
          <span v-if="isSaved(area.id)" class="map-saved">Сохранено</span>
        </KitCheckbox>
      </div>
    </div>
    <p class="map-estimate" role="status">
      {{ estimateLabel }}
    </p>
    <p v-if="availableBytes !== null" class="map-help">
      Доступно приложению: {{ formatSize(availableBytes) }}.
    </p>
    <p v-if="availableBytes !== null && estimate.minBytes > availableBytes" class="map-warning">
      Места может не хватить. Выберите меньше областей или меньшую детализацию.
    </p>
    <p class="map-help">
      Оценка предварительная. Участки сохраняются по очереди; общие ресурсы загружаются один раз. Можно докачать остальные области этой же поездки позже.
    </p>
    <KitCheckbox :model-value="Boolean(options.refresh)" @update:model-value="setRefresh">
      Обновить уже скачанные участки
    </KitCheckbox>
  </section>
</template>

<style scoped lang="scss">
.map-settings {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
}
.map-area-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.map-area-actions > span {
  flex: 1;
}
.map-areas {
  display: grid;
  gap: 12px;
  max-height: 200px;
  overflow-y: auto;
  padding: 4px;
}
.map-area {
  min-width: 0;
}
.map-saved {
  margin-left: 6px;
  color: var(--fg-secondary-color);
  font-size: 0.8rem;
}
.map-estimate {
  font-weight: 600;
  margin: 0;
}
.map-help,
.map-warning {
  margin: 0;
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
}
.map-warning {
  color: var(--color-warning, #b36b00);
}
</style>
