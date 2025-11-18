<script setup lang="ts">
import type { MapPoint } from '../models/types'
import { Icon } from '@iconify/vue'
import { onClickOutside } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitInput } from '~/components/01.kit/kit-input'

interface Props {
  points: MapPoint[]
  readonly?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'focusOnPoint', point: MapPoint): void
  (e: 'updatePoint', point: MapPoint): void
  (e: 'updatePointCoords', point: MapPoint): void
  (e: 'deletePoint', pointId: string): void
  (e: 'startMovePoint', pointId: string): void
  (e: 'refreshAddress', pointId: string): void
}>()

// --- Логика для меню карт ---
const mapChoicePanelRef = ref<HTMLElement | null>(null)
const mapIframeContainerRef = ref<HTMLElement | null>(null)
const isMapChoiceVisible = ref(false)
const isMapVisible = ref(false)
const selectedMapUrl = ref<string | null>(null)
const selectedPointForMap = ref<MapPoint | null>(null)

const mapProviders = [
  { name: 'Google Maps', urlTemplate: 'https://www.google.com/maps?q={lat},{lon}&output=embed' },
  { name: 'Yandex Maps', urlTemplate: 'https://yandex.ru/map-widget/v1/?ll={lon}%2C{lat}&z=15&pt={lon},{lat}' },
  { name: 'OpenStreetMap', urlTemplate: 'https://www.openstreetmap.org/export/embed.html?bbox={bbox}&layer=mapnik&marker={lat},{lon}' },
  { name: 'Baidu Maps', urlTemplate: 'http://api.map.baidu.com/marker?location={lat},{lon}&output=html' },
]

function openMapChoice(point: MapPoint) {
  selectedPointForMap.value = point
  isMapChoiceVisible.value = true
}

function selectMapProvider(provider: typeof mapProviders[0]) {
  if (!selectedPointForMap.value)
    return

  const [lon, lat] = selectedPointForMap.value.coordinates
  let url = ''

  if (provider.name === 'OpenStreetMap') {
    const delta = 0.008
    const bbox = [lon - delta, lat - delta, lon + delta, lat + delta].join(',')
    url = provider.urlTemplate.replace('{bbox}', bbox).replace('{lat}', String(lat)).replace('{lon}', String(lon))
  }
  else {
    url = provider.urlTemplate.replace('{lat}', String(lat)).replace('{lon}', String(lon))
  }

  selectedMapUrl.value = url
  isMapChoiceVisible.value = false
  isMapVisible.value = true
}

function closeMap() {
  isMapVisible.value = false
  selectedMapUrl.value = null
  selectedPointForMap.value = null
}

onClickOutside(mapChoicePanelRef, () => {
  isMapChoiceVisible.value = false
})

onClickOutside(mapIframeContainerRef, () => {
  if (isMapVisible.value)
    closeMap()
})
</script>

<template>
  <div class="poi-list">
    <div
      v-for="(point, index) in points"
      :key="point.id"
      class="poi-item"
      :class="{ 'is-readonly': readonly }"
      @click="emit('focusOnPoint', point)"
    >
      <div class="poi-marker-visual">
        <span class="poi-number" :style="{ backgroundColor: point.style?.color }">
          {{ index + 1 }}
        </span>
      </div>

      <div class="poi-info">
        <div class="poi-field">
          <Icon icon="mdi:map-marker-outline" class="field-icon" />
          <KitInlineMdEditorWrapper
            v-if="!readonly"
            :model-value="point.address!"
            class="poi-editor poi-address"
            :features="{
              'block-edit': false, 'code-mirror': false, 'cursor': false, 'image-block': false, 'latex': false, 'link-tooltip': false, 'table': false, 'toolbar': false,
            }"
            placeholder="Адрес не найден"
            @update:model-value="point.address = $event"
            @blur="emit('updatePoint', point)"
          />
          <span v-else class="poi-text">{{ point.address || 'Адрес не найден' }}</span>
          <KitBtn v-if="!readonly" icon="mdi:refresh" variant="subtle" size="xs" aria-label="Обновить адрес" @click.stop="emit('refreshAddress', point.id)" />
          <KitBtn icon="mdi:map-search-outline" variant="subtle" size="xs" aria-label="Показать на карте" @click.stop="openMapChoice(point)" />
        </div>
        <div v-if="point.comment || !readonly" class="poi-field">
          <Icon icon="mdi:comment-text-outline" class="field-icon" />
          <KitInlineMdEditorWrapper
            v-if="!readonly"
            :model-value="point.comment || ''"
            class="poi-editor poi-comment"
            :features="{
              'block-edit': false, 'code-mirror': false, 'cursor': false, 'image-block': false, 'latex': false, 'link-tooltip': false, 'table': false, 'toolbar': false,
            }"
            placeholder="Добавить комментарий"
            @update:model-value="point.comment = $event"
            @blur="emit('updatePoint', point)"
          />
          <span v-else-if="point.comment" class="poi-text poi-text-comment">{{ point.comment }}</span>
        </div>

        <div v-if="!readonly" class="poi-controls">
          <div class="poi-coords">
            <KitInput
              :model-value="point.coordinates[1]"
              size="sm"
              type="text"
              @update:model-value="point.coordinates[1] = Number($event)"
              @keydown.enter="emit('updatePointCoords', point)"
              @blur="emit('updatePointCoords', point)"
            />
            <KitInput
              :model-value="point.coordinates[0]"
              size="sm"
              type="text"
              @update:model-value="point.coordinates[0] = Number($event)"
              @keydown.enter="emit('updatePointCoords', point)"
              @blur="emit('updatePointCoords', point)"
            />
          </div>
          <div class="poi-actions">
            <KitBtn icon="mdi:arrow-all" variant="outlined" size="sm" aria-label="Переместить точку" @click="emit('startMovePoint', point.id)" />
            <KitBtn icon="mdi:delete-outline" variant="solid" size="sm" aria-label="Удалить точку" @click="emit('deletePoint', point.id)" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <!-- Модальное окно выбора карты -->
    <Transition name="fade">
      <div v-if="isMapChoiceVisible" class="map-choice-overlay">
        <div ref="mapChoicePanelRef" class="map-choice-panel">
          <h4>Выберите карту</h4>
          <div class="map-provider-list">
            <button
              v-for="provider in mapProviders"
              :key="provider.name"
              class="map-provider-btn"
              @click="selectMapProvider(provider)"
            >
              <span>{{ provider.name }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Карта в iframe -->
    <Transition name="fade">
      <div v-if="isMapVisible" class="map-overlay-iframe">
        <div ref="mapIframeContainerRef" class="map-container">
          <iframe
            v-if="selectedMapUrl"
            :src="selectedMapUrl"
            width="100%"
            height="100%"
            frameborder="0"
            style="border:0;"
            allowfullscreen
          />
        </div>
        <button class="close-map-btn" title="Закрыть карту" @click="closeMap">
          <Icon icon="mdi:close" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.poi-list {
  display: flex;
  flex-direction: column;
}

.poi-item {
  position: relative;
  display: flex;
  gap: 8px;
  padding: 12px;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-xs);
  transition: background-color 0.2s ease;
  margin: 4px;

  &.is-readonly {
    cursor: pointer;

    &:hover {
      background-color: var(--bg-hover-color);
    }
  }
}

.poi-marker-visual {
  position: absolute;
  left: -4px;
  top: -4px;
  opacity: 0.6;

  .poi-number {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Sansation';
    width: 20px;
    height: 20px;
    border-radius: var(--r-xs);
    color: white;
    font-size: 0.65rem;
    line-height: 20px;
    font-weight: 600;
    flex-shrink: 0;
  }
}

.poi-info {
  flex-grow: 1;
  display: flex;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.poi-field {
  display: flex;
  align-items: center;
  gap: 8px;

  .field-icon {
    font-size: 1.1rem;
    color: var(--fg-secondary-color);
    flex-shrink: 0;
  }
}

.poi-text {
  font-weight: 500;
  font-size: 0.9rem;
  line-height: 1.4;
  white-space: normal;
  word-break: break-word;
  flex-grow: 1;

  &-comment {
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
    font-style: italic;
  }
}

.poi-editor {
  width: 100%;
  padding: 4px 0;
  line-height: 1.4;
  min-height: 25px;
}

.poi-address {
  :deep() {
    .milkdown .ProseMirror p {
      font-weight: 500;
      font-size: 0.9rem;
      color: var(--fg-primary-color);
    }
  }
}

.poi-comment {
  :deep() {
    .milkdown .ProseMirror p {
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
    }
  }
}

.poi-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.poi-coords {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 1;
  min-width: 0;

  .kit-input-group {
    max-width: 170px;
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }
}

.poi-actions {
  display: flex;
  gap: 4px;
}
</style>

<style lang="scss">
.map-choice-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5px);
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-choice-panel {
  background-color: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  padding: 24px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-primary-color);
  box-shadow: var(--s-xl);
  width: 90%;
  max-width: 320px;

  h4 {
    margin: 0 0 20px 0;
    text-align: center;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
  }
}

.map-provider-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.map-provider-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  width: 100%;
  text-align: left;
  border-radius: var(--r-s);
  background-color: var(--bg-tertiary-color);
  color: var(--fg-primary-color);
  font-size: 1rem;
  font-weight: 500;
  transition:
    background-color 0.2s ease,
    transform 0.2s ease;

  &:hover {
    background-color: var(--bg-hover-color);
    transform: translateY(-2px);
  }

  .provider-icon {
    font-size: 22px;
    color: var(--fg-accent-color);
  }
}

.map-overlay-iframe {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  z-index: 10002;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.map-container {
  width: 100%;
  height: 100%;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-m);
  border: 1px solid var(--border-primary-color);
  overflow: hidden;
  box-shadow: var(--s-xl);
}

.close-map-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    background: rgba(220, 38, 38, 1);
    transform: scale(1.1);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
