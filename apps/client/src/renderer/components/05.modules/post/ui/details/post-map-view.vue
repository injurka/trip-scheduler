<script setup lang="ts">
import type { MapPoint } from '~/components/03.domain/trip-info/geolocation-section'
import type { PostDetail } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import GeolocationMap from '~/components/03.domain/trip-info/geolocation-section/ui/geolocation-map.vue'

interface Props {
  visible: boolean
  post: PostDetail
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()

const isDragging = ref(false)
const position = ref({ x: 0, y: 0 })
const dragStart = ref({ x: 0, y: 0 })
const initialPos = ref({ x: 0, y: 0 })

const mapPoints = computed<MapPoint[]>(() => {
  const points: MapPoint[] = []
  props.post.elements.forEach((element, sIndex) => {
    element.content.forEach((block) => {
      if (block.type === 'location' && block.location && block.location.lat) {
        points.push({
          id: block.id,
          type: 'poi',
          coordinates: [block.location.lng, block.location.lat],
          address: block.location.address,
          comment: block.location.label,
          style: {
            color: getColorForIndex(sIndex),
          },
        })
      }
    })
  })
  return points
})

const mapCenter = computed((): [number, number] => {
  if (mapPoints.value.length > 0) {
    return mapPoints.value[0].coordinates
  }
  return [props.post.longitude, props.post.latitude]
})

function getColorForIndex(index: number) {
  const colors = ['#7367F0', '#28C76F', '#EA5455', '#FF9F43', '#00CFE8']
  return colors[index % colors.length]
}

function startDrag(e: MouseEvent) {
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

onMounted(() => {
  position.value = {
    x: window.innerWidth > 600 ? window.innerWidth - 450 : 10,
    y: 80,
  }
})

watch(() => props.visible, (val) => {
  if (val) {
    const maxLeft = window.innerWidth - 300
    const maxTop = window.innerHeight - 300
    position.value = {
      x: Math.min(position.value.x, maxLeft),
      y: Math.min(position.value.y, maxTop),
    }
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="floating-map-window" :style="{ left: `${position.x}px`, top: `${position.y}px` }">
        <div class="map-drag-handle" @mousedown="startDrag">
          <button class="close-btn" title="Закрыть" @click="emit('update:visible', false)">
            <Icon icon="mdi:close" />
          </button>
        </div>
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
            :is-fullscreen="false"
            :with-panel="false"
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

  @include media-down(sm) {
    width: calc(100vw - 20px);
    height: 60vh;
    resize: none;
    left: 10px !important;
    top: 10vh !important;
  }
}

.map-drag-handle {
  height: 32px;
  background: var(--bg-tertiary-color);
  cursor: grab;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 8px;
  border-bottom: 1px solid var(--border-secondary-color);

  &:active {
    cursor: grabbing;
  }
}

.close-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-hover-color);
    color: var(--fg-primary-color);
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
