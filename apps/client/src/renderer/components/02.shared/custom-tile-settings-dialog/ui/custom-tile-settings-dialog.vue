<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { useToast } from '~/shared/composables/use-toast'
import { useAppSettingsStore } from '~/shared/store/app-settings.store'

interface TilePreset {
  id: string
  name: string
  url: string
  icon: string
  badge?: string
}

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'applied', sourceId: 'custom' | 'maptilerStreets'): void
}>()

const TILE_PRESETS: TilePreset[] = [
  {
    id: 'carto-voyager',
    name: 'CARTO Voyager (Туризм)',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    icon: 'mdi:map-outline',
    badge: 'Популярно',
  },
  {
    id: 'esri-satellite',
    name: 'Esri Satellite (Спутник)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    icon: 'mdi:satellite-variant',
    badge: 'HD',
  },
  {
    id: 'opentopomap',
    name: 'OpenTopoMap (Топография)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    icon: 'mdi:image-filter-hdr',
  },
  {
    id: 'esri-topo',
    name: 'Esri Topo (Рельеф)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    icon: 'mdi:terrain',
  },
  {
    id: 'carto-light',
    name: 'CARTO Positron (Светлая)',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    icon: 'mdi:white-balance-sunny',
  },
  {
    id: 'carto-dark',
    name: 'CARTO Dark (Тёмная)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    icon: 'mdi:weather-night',
  },
  {
    id: 'esri-street',
    name: 'Esri Street (Дороги)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    icon: 'mdi:road',
  },
  {
    id: 'osm-de',
    name: 'OSM Standard',
    url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
    icon: 'mdi:map-marker-path',
  },
  {
    id: 'osm-hot',
    name: 'OSM Humanitarian (HOT)',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    icon: 'mdi:heart-pulse',
  },
]

const appSettingsStore = useAppSettingsStore()
const toast = useToast()

const localKey = ref(appSettingsStore.customMapTilerKey || '')
const localUrl = ref(appSettingsStore.customTileUrl || '')
const localName = ref(appSettingsStore.customTileName || 'Пользовательская карта')

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    localKey.value = appSettingsStore.customMapTilerKey || ''
    localUrl.value = appSettingsStore.customTileUrl || ''
    localName.value = appSettingsStore.customTileName || 'Пользовательская карта'
  }
})

function close() {
  emit('update:modelValue', false)
}

function selectPreset(preset: TilePreset, instant = false) {
  localUrl.value = preset.url
  localName.value = preset.name
  if (instant) {
    handleSave(true)
  }
}

function handleSave(applyCustom = true) {
  const cleanKey = localKey.value.trim()
  const cleanUrl = localUrl.value.trim()
  const cleanName = localName.value.trim() || 'Пользовательская карта'

  appSettingsStore.customMapTilerKey = cleanKey
  appSettingsStore.customTileUrl = cleanUrl
  appSettingsStore.customTileName = cleanName

  if (cleanUrl) {
    appSettingsStore.activeTileSource = 'custom'
  }
  else if (cleanKey) {
    appSettingsStore.activeTileSource = 'maptilerStreets'
  }

  toast.success('Настройки тайлов сохранены')
  close()

  if (applyCustom && cleanUrl) {
    emit('applied', 'custom')
  }
  else if (applyCustom && cleanKey) {
    emit('applied', 'maptilerStreets')
  }
}

function handleReset() {
  localKey.value = ''
  localUrl.value = ''
  localName.value = 'Пользовательская карта'
  appSettingsStore.customMapTilerKey = ''
  appSettingsStore.customTileUrl = ''
  appSettingsStore.customTileName = 'Пользовательская карта'
  appSettingsStore.activeTileSource = 'maptilerStreets'
  toast.info('Настройки тайлов сброшены на стандартные')
  close()
  emit('applied', 'maptilerStreets')
}
</script>

<template>
  <KitDialogWithClose
    :visible="modelValue"
    title="Настройка тайлов и карт"
    class="custom-tile-dialog"
    @update:visible="emit('update:modelValue', $event)"
  >
    <div class="dialog-body">
      <p class="dialog-desc">
        Выберите готовый пресет из каталога или укажите собственный источник растровых/векторных тайлов.
      </p>

      <!-- Каталог пресетов -->
      <div class="form-group">
        <label class="group-label">
          <Icon icon="mdi:view-grid-outline" class="label-icon" />
          <span>Каталог популярных пресетов карт</span>
        </label>

        <div class="presets-grid">
          <button
            v-for="preset in TILE_PRESETS"
            :key="preset.id"
            type="button"
            class="preset-card"
            :class="{ 'is-active': localUrl === preset.url }"
            @click="selectPreset(preset)"
            @dblclick="selectPreset(preset, true)"
          >
            <div class="preset-card-leading">
              <Icon :icon="preset.icon" class="preset-icon" />
              <div class="preset-meta">
                <span class="preset-name">{{ preset.name }}</span>
                <span v-if="preset.badge" class="preset-badge">{{ preset.badge }}</span>
              </div>
            </div>
            <div class="preset-check" :class="{ 'is-visible': localUrl === preset.url }">
              <Icon icon="mdi:check-circle" />
            </div>
          </button>
        </div>
        <span class="group-hint">
          Кликните по пресету для выбора или дважды для немедленного применения.
        </span>
      </div>

      <!-- Пользовательский URL тайлов -->
      <div class="form-group">
        <label class="group-label">
          <Icon icon="mdi:web" class="label-icon" />
          <span>URL пользовательских тайлов / Style JSON</span>
        </label>
        <KitInput
          v-model="localUrl"
          placeholder="https://{s}.tile.example.com/{z}/{x}/{y}.png или ссылка на style.json"
          size="sm"
        />
        <span class="group-hint">
          Поддерживаются растровые XYZ-шаблоны (с <code>{z}</code>, <code>{x}</code>, <code>{y}</code>) и прямые ссылки на MapLibre/Mapbox <code>style.json</code>.
        </span>
      </div>

      <!-- Название источника -->
      <div v-if="localUrl" class="form-group">
        <label class="group-label">
          <Icon icon="mdi:format-title" class="label-icon" />
          <span>Название карты в меню</span>
        </label>
        <KitInput
          v-model="localName"
          placeholder="Моя карта"
          size="sm"
        />
      </div>

      <!-- Персональный MapTiler Key -->
      <div class="form-group key-section">
        <label class="group-label">
          <Icon icon="mdi:key-outline" class="label-icon" />
          <span>Персональный MapTiler API Key (опционально)</span>
        </label>
        <KitInput
          v-model="localKey"
          placeholder="Например: aBcDeF1234567890..."
          size="sm"
        />
        <span class="group-hint">
          Снимает лимиты на загрузку детальных карт (Улицы, Природа, Спутник, 3D-рельеф). Получить ключ можно бесплатно на <a href="https://cloud.maptiler.com" target="_blank" rel="noopener">maptiler.com</a>.
        </span>
      </div>

      <!-- Футер с действиями -->
      <div class="dialog-actions">
        <KitBtn
          variant="subtle"
          color="secondary"
          size="sm"
          @click="handleReset"
        >
          Сбросить
        </KitBtn>
        <div class="spacer" />
        <KitBtn
          variant="outlined"
          color="secondary"
          size="sm"
          @click="close"
        >
          Отмена
        </KitBtn>
        <KitBtn
          variant="solid"
          color="primary"
          size="sm"
          icon="mdi:check"
          @click="handleSave(true)"
        >
          Сохранить и применить
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.custom-tile-dialog {
  max-width: 600px;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

.dialog-desc {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  line-height: 1.4;
  margin: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &.key-section {
    padding-top: 10px;
    border-top: 1px dashed var(--border-secondary-color);
  }

  .group-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--fg-primary-color);

    .label-icon {
      color: var(--fg-accent-color);
    }
  }

  .group-hint {
    font-size: 0.75rem;
    color: var(--fg-tertiary-color);
    line-height: 1.35;

    a {
      color: var(--fg-accent-color);
      text-decoration: none;
      &:hover {
        text-decoration: underline;
      }
    }

    code {
      font-size: 0.72rem;
      background: var(--bg-tertiary-color);
      padding: 1px 4px;
      border-radius: 3px;
    }
  }
}

.presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 8px;
  margin-top: 4px;
  max-height: 230px;
  overflow-y: auto;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-secondary-color);
    border-radius: 2px;
  }
}

.preset-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s, 8px);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  user-select: none;

  &:hover {
    background: var(--bg-hover-color);
    border-color: var(--fg-accent-color);
  }

  &.is-active {
    background: rgba(var(--fg-accent-color-rgb, 67, 99, 216), 0.12);
    border-color: var(--fg-accent-color);
    box-shadow: 0 0 0 1px var(--fg-accent-color);

    .preset-name {
      color: var(--fg-accent-color);
      font-weight: 600;
    }

    .preset-icon {
      color: var(--fg-accent-color);
    }
  }

  .preset-card-leading {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .preset-icon {
    font-size: 1.15rem;
    color: var(--fg-secondary-color);
    flex-shrink: 0;
  }

  .preset-meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .preset-name {
    font-size: 0.77rem;
    font-weight: 500;
    color: var(--fg-primary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .preset-badge {
    font-size: 0.62rem;
    color: var(--fg-accent-color);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .preset-check {
    font-size: 1rem;
    color: var(--fg-accent-color);
    opacity: 0;
    transform: scale(0.7);
    transition: all 0.15s ease;
    flex-shrink: 0;

    &.is-visible {
      opacity: 1;
      transform: scale(1);
    }
  }
}

.dialog-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-secondary-color);

  .spacer {
    flex-grow: 1;
  }
}
</style>
