<script setup lang="ts">
import type { IImageViewerImageMeta } from '../models/types'
import type { MapMarker } from '~/components/01.kit/kit-map'
import { Icon } from '@iconify/vue'
import { onClickOutside } from '@vueuse/core'
import { KitMap } from '~/components/01.kit/kit-map/ui'

interface Props {
  visible: boolean
  meta: IImageViewerImageMeta
}
const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const panelRef = ref<HTMLElement | null>(null)

const showExtended = ref(false)

// --- Состояния для управления картой ---
const showMap = ref(false)

onClickOutside(panelRef, () => {
  if (props.visible)
    emit('close')
})

const gpsCoordinates = computed(() => {
  if (props.meta.latitude != null && props.meta.longitude != null) {
    return { latitude: props.meta.latitude, longitude: props.meta.longitude }
  }
  return null
})

function toggleMap() {
  if (gpsCoordinates.value)
    showMap.value = !showMap.value
}

const mapCenter = computed((): [number, number] => {
  const coords = gpsCoordinates.value
  if (!coords)
    return [0, 0] // Default, should not be visible anyway
  // [longitude, latitude] for OpenLayers
  return [coords.longitude, coords.latitude]
})

const mapMarkers = computed((): MapMarker[] => {
  const coords = gpsCoordinates.value
  if (!coords)
    return []
  return [{
    id: 'geolocation-marker',
    coords: {
      lon: coords.longitude,
      lat: coords.latitude,
    },
  }]
})

const googleMapsLink = computed(() => {
  const coords = gpsCoordinates.value
  if (!coords)
    return '#'
  return `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`
})

const osmLink = computed(() => {
  const coords = gpsCoordinates.value
  if (!coords)
    return '#'
  return `https://www.openstreetmap.org/?mlat=${coords.latitude}&mlon=${coords.longitude}#map=16/${coords.latitude}/${coords.longitude}`
})

const takenAtDate = computed(() => {
  if (!props.meta.takenAt)
    return ''

  return new Date(props.meta.takenAt).toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    // hour: '2-digit',
    // minute: '2-digit',
  })
})

function formatFlash(flashValue: number | boolean | undefined): string {
  if (flashValue === null || typeof flashValue === 'undefined')
    return ''

  if (typeof flashValue === 'boolean')
    return flashValue ? 'Сработала' : 'Не сработала'

  const flashMap: Record<number, string> = {
    0: 'Не сработала',
    1: 'Сработала',
    5: 'Сработала (без детекции света)',
    7: 'Сработала (с детекцией света)',
    9: 'Принудительно',
    15: 'Принудительно (с детекцией)',
    16: 'Не сработала (принудительно)',
    24: 'Авто (не сработала)',
    25: 'Авто (сработала)',
    31: 'Авто (сработала, с детекцией)',
  }

  return flashMap[flashValue] ?? `Код ${flashValue}`
}

// --- Вычисляемые свойства для категорий ---

const cameraInfo = computed(() => {
  const meta = props.meta
  const items = [
    { label: 'Производитель', value: meta?.camera?.make, icon: 'mdi:factory' },
    { label: 'Модель', value: meta?.camera?.model, icon: 'mdi:camera' },
    { label: 'Объектив', value: meta?.camera?.lens, icon: 'mdi:lens' },
  ]
  return items.filter(item => item.value)
})

const settingsInfo = computed(() => {
  const settings = props.meta?.settings
  if (!settings)
    return []

  const shutterSpeed = settings.shutterSpeed
    ? settings.shutterSpeed
    : settings.exposureTime && settings.exposureTime < 1 && settings.exposureTime > 0
      ? `1/${Math.round(1 / settings.exposureTime)}s`
      : `${settings.exposureTime}s`

  const flashDisplayValue = formatFlash(settings.flash)
  const exposureModeValue = { 0: 'Авто' }[settings.exposureMode as number] ?? String(settings.exposureMode)
  const meteringModeValue = { 2: 'По центру' }[settings.meteringMode as number] ?? String(settings.meteringMode)
  const whiteBalanceValue = { 0: 'Авто' }[settings.whiteBalance as number] ?? String(settings.whiteBalance)

  const items = [
    { label: 'Диафрагма', value: settings.aperture ? `ƒ/${settings.aperture}` : '', icon: 'mdi:camera-iris' },
    { label: 'Выдержка', value: shutterSpeed, icon: 'mdi:timer-outline' },
    { label: 'ISO', value: settings.iso, icon: 'mdi:brightness-6' },
    { label: 'Фокусное расстояние', value: settings.focalLength ? `${settings.focalLength}mm` : '', icon: 'mdi:image-filter-center-focus' },
    { label: 'Вспышка', value: flashDisplayValue, icon: 'mdi:flash' },
    { label: 'Режим экспозиции', value: exposureModeValue, icon: 'mdi:camera-control' },
    { label: 'Режим замера', value: meteringModeValue, icon: 'mdi:camera-metering-center' },
    { label: 'Баланс белого', value: whiteBalanceValue, icon: 'mdi:white-balance-auto' },
  ]
  return items.filter(item => item.value)
})

const technicalInfo = computed(() => {
  const tech = props.meta?.technical
  const items = [
    { label: 'Разрешение', value: (props.meta.width && props.meta.height) ? `${props.meta.width} x ${props.meta.height}px` : '', icon: 'mdi:aspect-ratio' },
    { label: 'Размер файла', value: tech?.fileSize ? `${(tech.fileSize / 1024 / 1024).toFixed(2)} МБ` : '', icon: 'mdi:file-chart-outline' },
    { label: 'Формат', value: tech?.format, icon: 'mdi:file-outline' },
  ]
  return items.filter(item => item.value)
})

const generalInfo = computed(() => {
  const items: Array<{ label: string, value: any, icon: string, isMap?: boolean }> = [
    { label: 'Дата съемки', value: takenAtDate.value, icon: 'mdi:calendar-clock' },
  ]
  if (gpsCoordinates.value) {
    items.push({ label: 'GPS Координаты', value: 'Показать на карте', icon: 'mdi:map-marker', isMap: true })
  }
  return items.filter(item => item.value)
})

/**
 * Рекурсивно "уплощает" вложенный объект метаданных для удобного отображения.
 */
function flattenMetadata(obj: Record<string, any> | null | undefined, parentKey = ''): Record<string, any> {
  if (!obj)
    return {}
  return Object.entries(obj).reduce((acc, [key, value]) => {
    const newKey = parentKey ? `${parentKey}.${key}` : key
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(acc, flattenMetadata(value, newKey))
    }
    else {
      acc[newKey] = value
    }
    return acc
  }, {} as Record<string, any>)
}

const extendedInfo = computed(() => {
  const metadata = props.meta
  if (!metadata)
    return []

  const excludedKeys = new Set([
    'camera.make',
    'camera.model',
    'camera.lens',
    'settings.aperture',
    'settings.apertureValue',
    'settings.shutterSpeed',
    'settings.exposureTime',
    'settings.iso',
    'settings.focalLength',
    'settings.flash',
    'settings.exposureMode',
    'settings.meteringMode',
    'settings.whiteBalance',
    'technical.orientation',
    'technical.fileSize',
    'technical.format',
    'gps.bearing',
    'gps.gpsDate',
    'gps.altitude',
    'software.modifyDate',
  ])

  const flattened = flattenMetadata(metadata)

  return Object.entries(flattened)
    .filter(([key]) => !excludedKeys.has(key) && !key.startsWith('rawExif'))
    .map(([key, value]) => ({
      key,
      value: Array.isArray(value) ? value.join(', ') : (typeof value === 'object' ? JSON.stringify(value) : value),
    }))
    .filter(item => item.value !== null && item.value !== undefined)
})
</script>

<template>
  <Teleport to="body">
    <!-- Метаданные -->
    <Transition name="slide-from-right">
      <div v-if="visible" class="metadata-overlay">
        <div ref="panelRef" class="metadata-panel">
          <header class="panel-header">
            <div class="panel-title">
              <Icon icon="mdi:image-text" />
              <h3>Информация о снимке</h3>
            </div>
            <button class="close-btn-panel" title="Закрыть" @click="$emit('close')">
              <Icon icon="mdi:close" />
            </button>
          </header>
          <div class="panel-content">
            <!-- Общая информация -->
            <section class="info-section">
              <dl class="info-list">
                <div v-for="item in generalInfo" :key="item.label" class="info-item">
                  <dt>
                    <Icon :icon="item.icon" class="info-icon" />
                    <span>{{ item.label }}</span>
                  </dt>
                  <dd>
                    <button v-if="item.isMap" class="map-link" @click="toggleMap">
                      <span>{{ item.value }}</span>
                      <Icon :icon="showMap ? 'mdi:chevron-up' : 'mdi:map-search-outline'" class="link-icon" />
                    </button>
                    <template v-else>
                      {{ item.value }}
                    </template>
                  </dd>
                </div>
              </dl>
              <Transition name="fade-height">
                <div v-if="showMap && gpsCoordinates" class="map-display-area">
                  <div class="kit-map-wrapper">
                    <ClientOnly>
                      <KitMap
                        class="embedded-map"
                        :center="mapCenter"
                        :zoom="15"
                        height="220px"
                        :markers="mapMarkers"
                      />
                    </ClientOnly>
                  </div>
                  <div class="external-map-links">
                    <a :href="googleMapsLink" target="_blank" rel="noopener noreferrer" class="external-map-btn">
                      <Icon icon="mdi:google-maps" />
                      <span>Google Maps</span>
                    </a>
                    <a :href="osmLink" target="_blank" rel="noopener noreferrer" class="external-map-btn">
                      <Icon icon="mdi:map-marker-outline" />
                      <span>OpenStreetMap</span>
                    </a>
                  </div>
                </div>
              </Transition>
            </section>

            <!-- Камера и объектив -->
            <section v-if="cameraInfo.length" class="info-section">
              <h4>Камера и объектив</h4>
              <dl class="info-list">
                <div v-for="item in cameraInfo" :key="item.label" class="info-item">
                  <dt>
                    <Icon :icon="item.icon" class="info-icon" />
                    <span>{{ item.label }}</span>
                  </dt>
                  <dd>{{ item.value }}</dd>
                </div>
              </dl>
            </section>

            <!-- Параметры съёмки -->
            <section v-if="settingsInfo.length" class="info-section">
              <h4>Параметры съёмки</h4>
              <dl class="info-list">
                <div v-for="item in settingsInfo" :key="item.label" class="info-item">
                  <dt>
                    <Icon :icon="item.icon" class="info-icon" />
                    <span>{{ item.label }}</span>
                  </dt>
                  <dd>{{ item.value }}</dd>
                </div>
              </dl>
            </section>

            <!-- Техническая информация -->
            <section v-if="technicalInfo.length" class="info-section">
              <h4>Техническая информация</h4>
              <dl class="info-list">
                <div v-for="item in technicalInfo" :key="item.label" class="info-item">
                  <dt>
                    <Icon :icon="item.icon" class="info-icon" />
                    <span>{{ item.label }}</span>
                  </dt>
                  <dd>{{ item.value }}</dd>
                </div>
              </dl>
            </section>

            <!-- Расширенные данные -->
            <section v-if="extendedInfo.length" class="info-section">
              <h4 class="extended-header">
                <span>Расширенные данные (EXIF)</span>
                <button @click="showExtended = !showExtended">
                  <Icon :icon="showExtended ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
                  {{ showExtended ? 'Скрыть' : 'Показать' }}
                </button>
              </h4>
              <Transition name="fade-height">
                <div v-if="showExtended">
                  <dl class="info-list extended-list">
                    <div v-for="item in extendedInfo" :key="item.key" class="info-item">
                      <dt>{{ item.key }}</dt>
                      <dd>{{ item.value }}</dd>
                    </div>
                  </dl>
                </div>
              </Transition>
            </section>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.metadata-overlay {
  position: fixed;
  inset: 0;
  z-index: 21;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
}

.metadata-panel {
  width: 100%;
  max-width: 420px;
  height: 100%;
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-primary-color);
  box-shadow: var(--s-l);
  pointer-events: auto;

  @include media-down(sm) {
    max-width: 100%;
    width: 100%;
  }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-primary-color);
  flex-shrink: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.25rem;
  color: var(--fg-secondary-color);

  h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
}

.close-btn-panel {
  color: var(--fg-tertiary-color);
  font-size: 24px;
  transition: color 0.2s;
  &:hover {
    color: var(--fg-primary-color);
  }
}

.panel-content {
  padding: 16px;
  overflow-y: auto;
  flex-grow: 1;
  -webkit-overflow-scrolling: touch;
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-primary-color);
    border-radius: var(--r-2xs);
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.info-section {
  margin-bottom: 24px;
  &:last-child {
    margin-bottom: 0;
  }

  h4 {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--fg-tertiary-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding-bottom: 8px;
    margin: 0 0 4px 0;
    border-bottom: 1px solid var(--border-secondary-color);
  }
}

.extended-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px !important;
  border-bottom: 1px solid var(--border-secondary-color) !important;

  span {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--fg-tertiary-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  button {
    color: var(--fg-accent-color);
    cursor: pointer;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: color 0.2s;
    &:hover {
      color: var(--bg-action-hover-color);
    }
  }
}

.info-list {
  margin: 0;
  font-size: 0.95rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-secondary-color);
  &:last-child {
    border-bottom: none;
  }
  dt {
    color: var(--fg-secondary-color);
    display: flex;
    align-items: center;
    gap: 10px;
    white-space: nowrap;
  }
  dd {
    margin: 0;
    color: var(--fg-primary-color);
    text-align: right;
    word-break: break-all;
    font-weight: 500;
  }
}

.map-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--fg-accent-color);
  text-decoration: none;
  transition: color 0.2s;
  font-weight: 500;
  font-size: inherit;
  &:hover {
    color: var(--bg-action-hover-color);
    text-decoration: underline;
  }
  .link-icon {
    font-size: 1.1em;
    opacity: 0.9;
  }
}

.info-icon {
  font-size: 18px;
  color: var(--fg-muted-color);
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.extended-list {
  font-size: 0.85rem;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-s);
  padding: 0 12px;

  .info-item {
    border-color: var(--border-primary-color);
  }
  dt {
    font-family: monospace;
    font-size: 0.8rem;
    color: var(--fg-tertiary-color);
  }
  dd {
    color: var(--fg-secondary-color);
    font-weight: 400;
  }
}

.map-display-area {
  margin-top: 12px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  overflow: hidden;
}

.kit-map-wrapper {
  border-bottom: 1px solid var(--border-secondary-color);
}

.external-map-links {
  display: flex;
  background-color: var(--bg-tertiary-color);
}

.external-map-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  color: var(--fg-secondary-color);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition:
    background-color 0.2s,
    color 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &:first-child {
    border-right: 1px solid var(--border-secondary-color);
  }

  .iconify {
    font-size: 1.2em;
  }
}

.slide-from-right-enter-active,
.slide-from-right-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-from-right-enter-from,
.slide-from-right-leave-to {
  transform: translateX(100%);
}

.fade-height-enter-active,
.fade-height-leave-active {
  transition: all 0.3s ease-in-out;
  overflow: hidden;
}
.fade-height-enter-from,
.fade-height-leave-to {
  opacity: 0;
  max-height: 0;
}
.fade-height-enter-to,
.fade-height-leave-from {
  opacity: 1;
  max-height: 500px; /* Adjust if map container can be taller */
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
