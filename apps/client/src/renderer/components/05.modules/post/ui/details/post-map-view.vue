<script setup lang="ts">
import type { MapPoint } from '~/components/03.domain/trip-info/geolocation-section'
import type { PostDetail } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import GeolocationMap from '~/components/03.domain/trip-info/geolocation-section/ui/geolocation-map.vue'

interface Props {
  visible: boolean
  pinned?: boolean
  post: PostDetail
  focusCoords?: [number, number] | null
}

const props = withDefaults(defineProps<Props>(), {
  pinned: false,
  focusCoords: null,
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:pinned', value: boolean): void
}>()

const isDragging = ref(false)
const position = ref({ x: 0, y: 0 })
const dragStart = ref({ x: 0, y: 0 })
const initialPos = ref({ x: 0, y: 0 })
const isMapFullscreen = ref(false)
const dynamicCenter = ref<[number, number] | null>(null)

const mapPoints = computed<MapPoint[]>(() => {
  const points: MapPoint[] = []
  props.post.elements.forEach((element, sIndex) => {
    element.content.forEach((block: any) => {
      if (block.type === 'location' && block.location && block.location.lat) {
        points.push({
          id: block.id,
          type: 'poi',
          coordinates: [block.location.lng, block.location.lat],
          address: block.location.address,
          comment: block.location.label,
          isDraggable: false,
          draggable: false,
          style: {
            color: getColorForIndex(sIndex),
          },
        } as unknown as MapPoint)
      }
    })
  })
  return points
})

const mapCenter = computed((): [number, number] => {
  if (dynamicCenter.value) {
    return dynamicCenter.value
  }
  if (mapPoints.value.length > 0) {
    return mapPoints.value[0].coordinates
  }
  return [props.post.longitude, props.post.latitude]
})

watch(() => props.focusCoords, (coords) => {
  if (coords) {
    dynamicCenter.value = coords
  }
})

function getColorForIndex(index: number) {
  const colors = ['#7367F0', '#28C76F', '#EA5455', '#FF9F43', '#00CFE8']
  return colors[index % colors.length]
}

function startDrag(e: MouseEvent) {
  if (props.pinned || isMapFullscreen.value)
    return
  if (e.target instanceof HTMLButtonElement || (e.target as HTMLElement).closest('button'))
    return

  isDragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY }
  initialPos.value = { ...position.value }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value)
    return
  position.value = {
    x: initialPos.value.x + (e.clientX - dragStart.value.x),
    y: initialPos.value.y + (e.clientY - dragStart.value.y),
  }
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function toggleFullscreen() {
  isMapFullscreen.value = !isMapFullscreen.value
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isMapFullscreen.value) {
    isMapFullscreen.value = false
  }
}

function closeMap() {
  isMapFullscreen.value = false
  emit('update:visible', false)
}

onMounted(() => {
  position.value = {
    x: window.innerWidth > 600 ? window.innerWidth - 450 : 10,
    y: 80,
  }
  document.addEventListener('keydown', handleKeydown)
})

watch(() => props.visible, (val) => {
  if (val && !props.pinned) {
    const maxLeft = window.innerWidth - 300
    const maxTop = window.innerHeight - 300
    position.value = {
      x: Math.min(position.value.x, maxLeft),
      y: Math.min(position.value.y, maxTop),
    }
  }
  if (!val) {
    isMapFullscreen.value = false
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body" :disabled="pinned">
    <Transition name="fade">
      <div
        v-if="visible || pinned"
        class="floating-map-window"
        :class="{ 'is-pinned': pinned, 'is-fullscreen': isMapFullscreen }"
        :style="(pinned || isMapFullscreen) ? {} : { left: `${position.x}px`, top: `${position.y}px` }"
      >
        <div v-if="!pinned && !isMapFullscreen" class="map-drag-handle" @mousedown="startDrag">
          <div class="drag-indicator">
            <Icon icon="mdi:drag-horizontal" />
          </div>
          <div class="header-actions">
            <button class="action-btn" title="Закрепить" @click="emit('update:pinned', true)">
              <Icon icon="mdi:pin" />
            </button>
            <button class="action-btn" title="Закрыть" @click="closeMap">
              <Icon icon="mdi:close" />
            </button>
          </div>
        </div>

        <button
          v-if="pinned && !isMapFullscreen"
          class="unpin-floating-btn"
          title="Открепить карту"
          @click="emit('update:pinned', false)"
        >
          <Icon icon="mdi:pin-off" />
        </button>

        <div class="map-body">
          <div v-if="mapPoints.length === 0" class="empty-map">
            <p>В этом посте нет отмеченных локаций.</p>
          </div>
          <GeolocationMap
            v-else
            :points="mapPoints"
            :routes="[]"
            :drawn-routes="[]"
            mode="pan"
            :center="mapCenter"
            height="100%"
            :is-loading="false"
            :readonly="true"
            :is-fullscreen="isMapFullscreen"
            :with-panel="false"
            @toggle-fullscreen="toggleFullscreen"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.floating-map-window {
  position: fixed;
  width: 400px;
  height: 500px;
  min-width: 250px;
  min-height: 250px;
  background: var(--bg-primary-color);
  border-radius: var(--r-m);
  box-shadow: var(--s-xl);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  resize: both;
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);

  &.is-pinned {
    position: relative;
    width: 100% !important;
    height: 100% !important;
    left: auto !important;
    top: auto !important;
    resize: none;
    box-shadow: var(--s-m);
    z-index: 1;
    border-radius: var(--r-l);
  }

  &.is-fullscreen {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 99999 !important;
    border-radius: 0 !important;
    resize: none !important;
    box-shadow: none !important;
    border: none !important;
  }

  @include media-down(sm) {
    &:not(.is-pinned):not(.is-fullscreen) {
      width: calc(100vw - 20px);
      height: 60vh;
      resize: none;
      left: 10px !important;
      top: 10vh !important;
    }
  }
}

.map-drag-handle {
  height: 38px;
  background: var(--bg-tertiary-color);
  cursor: grab;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  border-bottom: 1px solid var(--border-secondary-color);

  &:active {
    cursor: grabbing;
  }
}

.drag-indicator {
  color: var(--fg-tertiary-color);
  display: flex;
  align-items: center;
  margin-left: 4px;
}

.header-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.action-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }
}

.unpin-floating-btn {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(var(--bg-primary-color-rgb), 0.85);
  backdrop-filter: blur(4px);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--s-s);
  transition: all 0.2s;

  .iconify {
    font-size: 1.2rem;
  }

  &:hover {
    background: var(--bg-primary-color);
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    transform: translateY(-2px);
  }
}

.map-body {
  flex: 1;
  position: relative;
  background: var(--bg-secondary-color);
}

.empty-map {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-secondary-color);
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>
