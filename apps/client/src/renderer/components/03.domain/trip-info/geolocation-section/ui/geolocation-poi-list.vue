<script setup lang="ts">
import type { MapPoint } from '../models/types'
import { Icon } from '@iconify/vue'
import { onClickOutside } from '@vueuse/core'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { isMobileApp } from '~/shared/lib/env'
import { openExternalUrl } from '~/shared/lib/opener'

interface Props {
  points: MapPoint[]
  readonly?: boolean
  isRoutePoints?: boolean
}

withDefaults(defineProps<Props>(), {
  readonly: false,
  isRoutePoints: false,
})

const emit = defineEmits<{
  (e: 'focusOnPoint', point: MapPoint): void
  (e: 'updatePoint', point: MapPoint): void
  (e: 'updatePointCoords', point: MapPoint): void
  (e: 'deletePoint', pointId: string): void
  (e: 'startMovePoint', pointId: string): void
  (e: 'refreshAddress', pointId: string): void
}>()

function togglePointConnect(point: MapPoint) {
  if (point.type === 'connect') {
    emit('updatePoint', {
      ...point,
      type: 'via',
      address: point.address || 'Промежуточная остановка',
      comment: undefined,
    })
  }
  else {
    emit('updatePoint', {
      ...point,
      type: 'connect',
      address: undefined,
      comment: undefined,
    })
  }
}

interface MapProvider {
  name: string
  icon: string
  getExternalUrl: (lat: number, lon: number) => string
  getEmbedUrl: (lat: number, lon: number) => string
}

const mapChoicePanelRef = ref<HTMLElement | null>(null)
const mapIframeContainerRef = ref<HTMLElement | null>(null)
const isMapChoiceVisible = ref(false)
const isMapVisible = ref(false)
const selectedMapUrl = ref<string | null>(null)
const selectedPointForMap = ref<MapPoint | null>(null)

const mapProviders: MapProvider[] = [
  {
    name: 'Google Maps',
    icon: 'mdi:google-maps',
    getExternalUrl: (lat, lon) => `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
    getEmbedUrl: (lat, lon) => `https://www.google.com/maps?q=${lat},${lon}&output=embed`,
  },
  {
    name: 'Yandex Maps',
    icon: 'mdi:map-marker',
    getExternalUrl: (lat, lon) => `https://yandex.ru/maps/?pt=${lon},${lat}&z=16&l=map`,
    getEmbedUrl: (lat, lon) => `https://yandex.ru/map-widget/v1/?ll=${lon}%2C${lat}&z=15&pt=${lon},${lat}`,
  },
  {
    name: '2GIS',
    icon: 'mdi:map-marker-radius',
    getExternalUrl: (lat, lon) => `https://2gis.ru/geo/${lon},${lat}`,
    getEmbedUrl: (lat, lon) => `https://2gis.ru/geo/${lon},${lat}`,
  },
  {
    name: 'OpenStreetMap',
    icon: 'mdi:map',
    getExternalUrl: (lat, lon) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`,
    getEmbedUrl: (lat, lon) => {
      const delta = 0.008
      const bbox = [lon - delta, lat - delta, lon + delta, lat + delta].join(',')
      return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`
    },
  },
  {
    name: 'Baidu Maps',
    icon: 'mdi:map-legend',
    getExternalUrl: (lat, lon) => `https://api.map.baidu.com/marker?location=${lat},${lon}&output=html`,
    getEmbedUrl: (lat, lon) => `http://api.map.baidu.com/marker?location=${lat},${lon}&output=html`,
  },
]

function openMapChoice(point: MapPoint) {
  selectedPointForMap.value = point
  isMapChoiceVisible.value = true
}

async function selectMapProvider(provider: MapProvider) {
  if (!selectedPointForMap.value)
    return

  const [lon, lat] = selectedPointForMap.value.coordinates
  isMapChoiceVisible.value = false

  if (isMobileApp) {
    const url = provider.getExternalUrl(lat, lon)
    await openExternalUrl(url)
    selectedPointForMap.value = null
    return
  }

  const url = provider.getEmbedUrl(lat, lon)
  selectedMapUrl.value = url
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
      :class="{ 'is-readonly': readonly, 'is-connect': point.type === 'connect' }"
      @click="emit('focusOnPoint', point)"
    >
      <div class="poi-marker-visual">
        <span
          class="poi-number"
          :class="[
            point.type === 'start' ? 'is-start' : '',
            point.type === 'end' ? 'is-end' : '',
            point.type === 'connect' ? 'is-connect' : '',
          ]"
          :style="{ backgroundColor: point.style?.color || 'var(--fg-accent-color)' }"
        >
          <span v-if="point.type === 'connect'" class="connect-dot" />
          <span v-else-if="isRoutePoints && point.type === 'start'">A</span>
          <span v-else-if="isRoutePoints && point.type === 'end'">B</span>
          <span v-else>{{ index + 1 }}</span>
        </span>
      </div>

      <div class="poi-divider" />

      <div class="poi-info">
        <template v-if="point.type === 'connect'">
          <div class="connect-row">
            <div class="connect-label-group">
              <Icon icon="mdi:vector-polyline" class="connect-icon" />
              <span class="connect-text">Точка коррекции маршрута</span>
            </div>

            <div v-if="!readonly" class="connect-actions">
              <KitTooltip text="Превратить в именованную метку">
                <button type="button" class="mini-btn" @click.stop="togglePointConnect(point)">
                  <Icon icon="mdi:rename-box" />
                </button>
              </KitTooltip>
              <KitTooltip text="Переместить точку по карте">
                <button type="button" class="mini-btn" @click.stop="emit('startMovePoint', point.id)">
                  <Icon icon="mdi:cursor-move" />
                </button>
              </KitTooltip>
              <KitTooltip text="Удалить точку">
                <button type="button" class="mini-btn delete-btn" @click.stop="emit('deletePoint', point.id)">
                  <Icon icon="mdi:trash-can-outline" />
                </button>
              </KitTooltip>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="poi-field">
            <span v-if="isRoutePoints && point.type === 'start'" class="role-badge start">Старт</span>
            <span v-else-if="isRoutePoints && point.type === 'end'" class="role-badge end">Финиш</span>
            <Icon v-else icon="mdi:map-marker-outline" class="field-icon" />

            <KitInlineMdEditorWrapper
              v-if="!readonly"
              :model-value="point.address || ''"
              class="poi-editor poi-address"
              :features="{
                'block-edit': false, 'code-mirror': false, 'cursor': false, 'image-block': false, 'latex': false, 'link-tooltip': false, 'table': false, 'toolbar': false,
              }"
              :placeholder="isRoutePoints ? 'Название точки маршрута...' : 'Адрес не найден'"
              @update:model-value="point.address = $event"
              @blur="emit('updatePoint', point)"
            />
            <span v-else class="poi-text">{{ point.address || 'Без названия' }}</span>

            <div class="poi-inline-actions">
              <KitTooltip v-if="isRoutePoints && !readonly && point.type !== 'start' && point.type !== 'end'" text="Превратить в точку коррекции (убрать текст)">
                <button type="button" class="mini-btn" @click.stop="togglePointConnect(point)">
                  <Icon icon="mdi:vector-polyline" />
                </button>
              </KitTooltip>
              <KitTooltip v-if="!readonly" text="Обновить адрес">
                <button type="button" class="mini-btn" @click.stop="emit('refreshAddress', point.id)">
                  <Icon icon="mdi:refresh" />
                </button>
              </KitTooltip>
              <KitTooltip text="Открыть на внешней карте">
                <button type="button" class="mini-btn" @click.stop="openMapChoice(point)">
                  <Icon icon="mdi:map-search-outline" />
                </button>
              </KitTooltip>
            </div>
          </div>

          <div
            v-if="(!readonly && point.comment) || (readonly && point.comment && point.comment.trim() !== point.address?.trim())"
            class="poi-field comment-field"
          >
            <Icon icon="mdi:comment-text-outline" class="field-icon" />
            <KitInlineMdEditorWrapper
              v-if="!readonly"
              :model-value="point.comment || ''"
              class="poi-editor poi-comment"
              :features="{
                'block-edit': false, 'code-mirror': false, 'cursor': false, 'image-block': false, 'latex': false, 'link-tooltip': false, 'table': false, 'toolbar': false,
              }"
              placeholder="Добавить комментарий..."
              @update:model-value="point.comment = $event"
              @blur="emit('updatePoint', point)"
            />
            <span v-else class="poi-text poi-text-comment">{{ point.comment }}</span>
          </div>

          <div v-if="!readonly" class="poi-controls">
            <div class="poi-coords">
              <span class="coord-label">LAT</span>
              <KitInput
                :model-value="point.coordinates[1]"
                type="text"
                class="coord-input"
                @update:model-value="point.coordinates[1] = Number($event)"
                @keydown.enter="emit('updatePointCoords', point)"
                @blur="emit('updatePointCoords', point)"
              />
              <span class="coord-label">LON</span>
              <KitInput
                :model-value="point.coordinates[0]"
                type="text"
                class="coord-input"
                @update:model-value="point.coordinates[0] = Number($event)"
                @keydown.enter="emit('updatePointCoords', point)"
                @blur="emit('updatePointCoords', point)"
              />
            </div>

            <div class="poi-actions">
              <KitTooltip text="Переместить точку по карте">
                <button
                  type="button"
                  class="action-btn"
                  @click.stop="emit('startMovePoint', point.id)"
                >
                  <Icon icon="mdi:cursor-move" />
                </button>
              </KitTooltip>

              <KitTooltip text="Удалить точку">
                <button
                  type="button"
                  class="action-btn delete-btn"
                  @click.stop="emit('deletePoint', point.id)"
                >
                  <Icon icon="mdi:trash-can-outline" />
                </button>
              </KitTooltip>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isMapChoiceVisible" class="map-choice-overlay">
        <div ref="mapChoicePanelRef" class="map-choice-panel">
          <h4>Выберите карту</h4>
          <div class="map-provider-list">
            <button
              v-for="provider in mapProviders"
              :key="provider.name"
              type="button"
              class="map-provider-btn"
              @click="selectMapProvider(provider)"
            >
              <Icon :icon="provider.icon" class="provider-icon" />
              <span>{{ provider.name }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

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
        <KitTooltip text="Закрыть карту" class="close-map-btn-tooltip">
          <button type="button" class="close-map-btn" @click="closeMap">
            <Icon icon="mdi:close" />
          </button>
        </KitTooltip>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.poi-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.poi-item {
  position: relative;
  display: flex;
  gap: 0;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  overflow: hidden;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease;

  @include hover {
    & {
      border-color: var(--border-primary-color);
      box-shadow: var(--s-s);
    }
  }

  &.is-readonly {
    cursor: pointer;

    &:hover {
      background-color: var(--bg-tertiary-color);
    }
  }

  &.is-connect {
    align-items: center;
  }
}

// Левая цветная полоса — визуальный акцент
.poi-marker-visual {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 10px 0 10px 10px;
  gap: 0;

  .is-connect & {
    padding: 8px 0 8px 10px;
    justify-content: center;
  }
}

.poi-number {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono, monospace);
  width: 24px;
  height: 24px;
  border-radius: var(--r-xs);
  color: white;
  font-size: 0.68rem;
  font-weight: 800;
  flex-shrink: 0;
  letter-spacing: 0.02em;
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);

  .is-connect & {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
  }
}

.connect-dot {
  display: block;
  width: 5px;
  height: 5px;
  background-color: white;
  border-radius: 50%;
}

// Разделитель между маркером и контентом
.poi-divider {
  width: 1px;
  align-self: stretch;
  background-color: var(--border-secondary-color);
  margin: 8px 10px;
  flex-shrink: 0;
}

.poi-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 8px 10px 8px 0;

  .is-connect & {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px 6px 0;
  }
}

.poi-field {
  display: flex;
  align-items: center;
  gap: 6px;

  .field-icon {
    font-size: 0.95rem;
    color: var(--fg-tertiary-color);
    flex-shrink: 0;
  }

  &.comment-field {
    margin-top: 1px;

    .field-icon {
      font-size: 0.85rem;
    }
  }

  &.connect-field {
    opacity: 0.6;
  }
}

.role-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--r-2xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;

  &.start {
    background-color: rgba(46, 204, 113, 0.15);
    color: #2ecc71;
    border: 1px solid rgba(46, 204, 113, 0.35);
  }

  &.end {
    background-color: rgba(231, 76, 60, 0.15);
    color: #e74c3c;
    border: 1px solid rgba(231, 76, 60, 0.35);
  }
}

.connect-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
}

.connect-label-group {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--fg-secondary-color);
  font-size: 0.78rem;

  .connect-icon {
    font-size: 0.95rem;
    color: var(--fg-accent-color);
  }

  .connect-text {
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}

.connect-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.poi-text {
  font-weight: 500;
  font-size: 0.83rem;
  line-height: 1.45;
  white-space: normal;
  word-break: break-word;
  flex-grow: 1;
  color: var(--fg-primary-color);

  &-comment {
    font-size: 0.78rem;
    color: var(--fg-secondary-color);
    font-weight: 400;
    font-style: italic;
  }

  &.connect-text {
    font-size: 0.78rem;
    font-style: italic;
    color: var(--fg-tertiary-color);
  }
}

.poi-inline-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 4px;
}

.mini-btn {
  width: 26px;
  height: 26px;
  border-radius: var(--r-xs);
  border: none;
  background-color: transparent;
  color: var(--fg-tertiary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1rem;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }
}

.poi-editor {
  flex: 1;
  padding: 1px 0;
  line-height: 1.45;
  min-height: 20px;
}

.poi-address {
  :deep() {
    .milkdown .ProseMirror p {
      font-weight: 500;
      font-size: 0.83rem;
      color: var(--fg-primary-color);
    }
  }
}

.poi-comment {
  :deep() {
    .milkdown .ProseMirror p {
      font-size: 0.78rem;
      color: var(--fg-secondary-color);
      font-style: italic;
    }
  }
}

.poi-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border-secondary-color);

  &.connect-controls {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }
}

.poi-coords {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 0;

  .coord-label {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--fg-tertiary-color);
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }

  .coord-input {
    flex: 1;
    max-width: 130px;
    font-family: var(--font-mono, monospace);

    :deep(input) {
      height: 34px;
      padding: 0 8px;
      font-size: 0.8rem;
      font-family: var(--font-mono, monospace);
    }
  }
}

.poi-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  width: 34px;
  height: 34px;
  border-radius: var(--r-xs);
  border: none;
  background-color: transparent;
  color: var(--fg-tertiary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.1rem;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &.delete-btn:hover {
    background-color: rgba(var(--fg-error-color-rgb), 0.12);
    color: var(--fg-error-color);
  }
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
  padding: 20px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-primary-color);
  box-shadow: var(--s-xl);
  width: 90%;
  max-width: 320px;

  h4 {
    margin: 0 0 16px 0;
    text-align: center;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
}

.map-provider-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.map-provider-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  width: 100%;
  text-align: left;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-tertiary-color);
  color: var(--fg-primary-color);
  font-size: 0.92rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  @include hover {
    & {
      background-color: var(--bg-hover-color);
      border-color: var(--fg-accent-color);
      transform: translateY(-1px);
    }
  }

  .provider-icon {
    font-size: 1.2rem;
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

.close-map-btn-tooltip {
  position: absolute;
  top: 1rem;
  right: 1rem;
}

.close-map-btn {
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

  @include hover {
    & {
      background: rgba(220, 38, 38, 1);
      transform: scale(1.1);
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
