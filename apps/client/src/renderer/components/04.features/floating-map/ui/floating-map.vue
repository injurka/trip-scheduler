<script setup lang="ts">
import type { Map as OlMap } from 'ol'
import { Icon } from '@iconify/vue'
import { useDraggable, useWindowSize } from '@vueuse/core'
import { fromLonLat } from 'ol/proj'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitMap } from '~/components/01.kit/kit-map'
import { useLayoutStore } from '~/shared/store/layout.store'

const layoutStore = useLayoutStore()
const mapInstance = shallowRef<OlMap | null>(null)
const windowRef = ref<HTMLElement | null>(null)
const headerRef = ref<HTMLElement | null>(null)

// --- Определение мобильного режима ---
const { width: windowWidth, height: windowHeight } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 768) // Порог для мобильного режима

// --- Данные карты ---
const mapCenter = ref<[number, number]>([37.6176, 55.7558])

// Поиск
const isSearchOpen = ref(false)
const searchQuery = ref('')
const isSearching = ref(false)
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

// --- Drag & Drop с сохранением ресайза (только для десктопа) ---
const initialX = computed(() => windowWidth.value - 450)
const initialY = 100

const { x, y } = useDraggable(headerRef, {
  initialValue: { x: initialX.value, y: initialY },
  preventDefault: true,
  onStart: () => {
    if (isMobile.value)
      return false
  },
})

// Применяем позицию только если не мобильное устройство
watch([x, y], ([newX, newY]) => {
  if (!windowRef.value || isMobile.value)
    return

  const el = windowRef.value
  const width = el.offsetWidth
  const height = el.offsetHeight

  const maxX = windowWidth.value - width
  const maxY = windowHeight.value - height

  const clampedX = Math.min(Math.max(0, newX), Math.max(0, maxX))
  const clampedY = Math.min(Math.max(0, newY), Math.max(0, maxY))

  el.style.left = `${clampedX}px`
  el.style.top = `${clampedY}px`
})

onMounted(() => {
  if (windowRef.value) {
    const ro = new ResizeObserver(() => {
      mapInstance.value?.updateSize()
    })
    ro.observe(windowRef.value)
  }
})

function onMapReady(map: OlMap) {
  mapInstance.value = map
}

async function handleSearch() {
  if (!searchQuery.value.trim() || !mapInstance.value)
    return

  isSearching.value = true
  const url = `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(searchQuery.value)}&format=json&limit=1&accept-language=ru`

  try {
    const response = await fetch(url)
    const data = await response.json()
    if (data && data.length > 0) {
      const result = data[0]
      const lon = Number.parseFloat(result.lon)
      const lat = Number.parseFloat(result.lat)

      mapInstance.value.getView().animate({
        center: fromLonLat([lon, lat]),
        zoom: 14,
        duration: 800,
      })
    }
  }
  catch (error) {
    console.error('Error searching location:', error)
  }
  finally {
    isSearching.value = false
  }
}

function closeWindow() {
  layoutStore.setFloatingMapOpen(false)
}

watch(() => layoutStore.isFloatingMapOpen, (isOpen) => {
  if (isOpen)
    nextTick(() => mapInstance.value?.updateSize())
})

// Начальные стили для окна, которые будут меняться
const windowStyle = computed(() => {
  if (isMobile.value) {
    return {}
  }
  return {
    left: `${initialX.value}px`,
    top: `${initialY}px`,
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="layoutStore.isFloatingMapOpen">
      <!-- Модальный режим для мобильных -->
      <div v-if="isMobile" class="floating-map-overlay" @click.self="closeWindow">
        <div ref="windowRef" class="floating-map-window is-modal">
          <!-- Содержимое окна -->
          <header ref="headerRef" class="window-header">
            <div class="header-title">
              <Icon icon="mdi:map-legend" />
              <span>Карта</span>
            </div>
            <div class="header-actions">
              <button class="action-btn" :class="{ active: isSearchOpen }" title="Поиск" @click="isSearchOpen = !isSearchOpen">
                <Icon :icon="isSearchOpen ? 'mdi:magnify-minus' : 'mdi:magnify'" />
              </button>
              <button class="action-btn" title="Закрыть" @click="closeWindow">
                <Icon icon="mdi:close" />
              </button>
            </div>
          </header>

          <div v-if="isSearchOpen" class="search-bar">
            <KitInput
              v-model="searchQuery"
              placeholder="Поиск места..."
              size="sm"
              @keydown.enter="handleSearch"
            />
            <KitBtn size="sm" icon="mdi:arrow-right" :loading="isSearching" @click="handleSearch" />
          </div>

          <div class="map-container">
            <KitMap
              :center="mapCenter"
              :zoom="10"
              height="100%"
              width="100%"
              class="minimal-map"
              :auto-pan="false"
              @map-ready="onMapReady"
            />
          </div>
          <!-- Ручка ресайза скрыта в модалке -->
        </div>
      </div>

      <!-- Обычный режим для десктопа -->
      <div
        v-else
        ref="windowRef"
        class="floating-map-window"
        :style="windowStyle"
      >
        <header ref="headerRef" class="window-header">
          <div class="header-title">
            <Icon icon="mdi:map-legend" />
            <span>Карта</span>
          </div>
          <div class="header-actions">
            <button class="action-btn" :class="{ active: isSearchOpen }" title="Поиск" @click="isSearchOpen = !isSearchOpen">
              <Icon :icon="isSearchOpen ? 'mdi:magnify-minus' : 'mdi:magnify'" />
            </button>
            <button class="action-btn" title="Закрыть" @click="closeWindow">
              <Icon icon="mdi:close" />
            </button>
          </div>
        </header>

        <div v-if="isSearchOpen" class="search-bar">
          <KitInput
            v-model="searchQuery"
            placeholder="Поиск места..."
            size="sm"
            @keydown.enter="handleSearch"
          />
          <KitBtn size="sm" icon="mdi:arrow-right" :loading="isSearching" @click="handleSearch" />
        </div>

        <div class="map-container">
          <KitMap
            :center="mapCenter"
            :zoom="10"
            height="100%"
            width="100%"
            class="minimal-map"
            :auto-pan="false"
            @map-ready="onMapReady"
          />
        </div>

        <div class="resize-handle">
          <Icon icon="mdi:resize-bottom-right" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.floating-map-overlay {
  position: fixed;
  top: env(safe-area-inset-top);
  left: 0;
  width: 100%;
  height: calc(100% - env(safe-area-inset-top));
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.floating-map-window {
  position: fixed;
  width: 400px;
  height: 320px;
  min-width: 300px;
  min-height: 250px;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-m);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  z-index: 10;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  resize: both;

  &.is-modal {
    position: relative;
    // Сбрасываем позиционирование, т.к. центрирование идет через flex в оверлее
    left: auto;
    top: auto;
    resize: none; // Отключаем ресайз в модальном режиме
    width: 90vw;
    height: 70vh;
    max-width: 500px; // Ограничиваем максимальную ширину на мобильных

    .resize-handle {
      display: none;
    }
    .window-header {
      cursor: default; // Убираем курсор перетаскивания
      &:active {
        cursor: default;
      }
    }
  }
}

.window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--bg-tertiary-color);
  border-bottom: 1px solid var(--border-secondary-color);
  cursor: grab;
  flex-shrink: 0;
  user-select: none;

  &:active {
    cursor: grabbing;
  }
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--fg-primary-color);
  font-size: 0.9rem;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &.active {
    color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }
}

.search-bar {
  padding: 8px;
  display: flex;
  gap: 4px;
  background-color: var(--bg-primary-color);
  border-bottom: 1px solid var(--border-secondary-color);

  :deep(.kit-input-group) {
    flex-grow: 1;
  }
}

.map-container {
  flex-grow: 1;
  position: relative;
  width: 100%;
  height: 100%;
}

.resize-handle {
  position: absolute;
  bottom: 2px;
  right: 2px;
  color: var(--fg-secondary-color);
  pointer-events: none;
  font-size: 14px;
}

:deep(.minimal-map) {
  canvas {
    filter: saturate(0.8) contrast(1.05);
  }

  .ol-attribution {
    bottom: 4px;
    right: 16px;
    background: rgba(255, 255, 255, 0.7) !important;
    border-radius: 4px;
    font-size: 9px;
    padding: 2px 4px;
  }
}
</style>
