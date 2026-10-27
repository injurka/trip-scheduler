<script setup lang="ts">
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { MapPoint, MapRoute } from '~/components/03.domain/trip-info/geolocation-section'
import type { useGeolocationMap } from '~/components/03.domain/trip-info/geolocation-section/composables/use-geolocation-map'
import type { PostDetail, PostMedia } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { useDebounceFn, useMediaQuery, useResizeObserver } from '@vueuse/core'
import { Marker, Popup } from 'maplibre-gl'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { KitImageViewer, useImageViewer } from '~/components/01.kit/kit-image-viewer'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import GeolocationMap from '~/components/03.domain/trip-info/geolocation-section/ui/geolocation-map.vue'
import { getPostMediaVariants } from '~/components/05.modules/post/lib/media-variants'
import { resolveApiUrl } from '~/shared/lib/url'

import { isValidCoordinate } from '~/shared/services/geo'

interface Props {
  visible: boolean
  pinned?: boolean
  post: PostDetail
  focusBlockId?: string | null
  focusRequest?: number
}

const props = withDefaults(defineProps<Props>(), {
  pinned: false,
  focusBlockId: null,
  focusRequest: 0,
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
const isMobileScreen = useMediaQuery('(max-width: 959px)')

const hasActiveFocus = computed(() => {
  return props.focusBlockId && props.focusBlockId !== 'null' && props.focusBlockId !== 'undefined'
})

function getColorForIndex(index: number) {
  const colors = ['#7367F0', '#28C76F', '#EA5455', '#FF9F43', '#00CFE8']
  return colors[index % colors.length]
}

function getPointStyleConfig(index: number, blockId: string) {
  const baseColor = getColorForIndex(index)
  if (hasActiveFocus.value) {
    const isFocused = props.focusBlockId === blockId
    return {
      color: baseColor,
      opacity: isFocused ? 1.0 : 0.35, // Делаем сильно прозрачными (35% видимости)
      scale: isFocused ? 1.6 : 1.1, // Фокусированная точка крупнее
    }
  }
  return {
    color: baseColor,
    opacity: 1.0,
    scale: 1.3,
  }
}

function getRouteColor(index: number, blockId: string) {
  const baseColor = getColorForIndex(index)
  if (hasActiveFocus.value) {
    // 59 в HEX — это примерно 35% непрозрачности (более прозрачно)
    return props.focusBlockId === blockId ? baseColor : `${baseColor}59`
  }
  return baseColor
}

const mapPoints = computed<MapPoint[]>(() => {
  const points: MapPoint[] = []
  props.post.elements?.forEach((element, sIndex) => {
    element.content.forEach((block: any) => {
      if (block.type === 'location' && block.location && (block.location.lat != null || block.location.lng != null)) {
        let lat = Number(block.location.lat)
        let lng = Number(block.location.lng)
        // Защита от перепутанных lat/lng
        if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
          const temp = lat
          lat = lng
          lng = temp
        }
        const coords: [number, number] = [lng, lat]
        if (!isValidCoordinate(coords))
          return

        const styleConfig = getPointStyleConfig(sIndex, block.id)
        points.push({
          id: block.id,
          type: 'poi',
          coordinates: coords,
          address: block.location.address,
          comment: block.location.label,
          isDraggable: false,
          draggable: false,
          style: {
            color: styleConfig.color,
            scale: styleConfig.scale,
            opacity: styleConfig.opacity,
            zIndex: props.focusBlockId === block.id ? 150 : 20,
          },
        } as unknown as MapPoint)
      }
    })
  })
  return points
})

const mapRoutes = computed<MapRoute[]>(() => {
  const routes: MapRoute[] = []
  props.post.elements?.forEach((element, sIndex) => {
    element.content.forEach((block: any) => {
      if (block.type === 'route' && block.route && block.route.geometry && block.route.geometry.length > 0) {
        const styleConfig = getPointStyleConfig(sIndex, block.id)
        const routeColor = getRouteColor(sIndex, block.id)

        const rawPoints = block.route.points || []
        const validBlockPoints: any[] = []

        rawPoints.forEach((p: any, idx: number) => {
          let lat = Number(p.lat)
          let lng = Number(p.lng)
          if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
            const temp = lat
            lat = lng
            lng = temp
          }
          const coords: [number, number] = [lng, lat]
          if (!isValidCoordinate(coords))
            return

          validBlockPoints.push({
            id: `${block.id}-pt-${idx}`,
            coordinates: coords,
            type: idx === 0 ? 'start' : idx === rawPoints.length - 1 ? 'end' : 'via',
            address: p.label,
            comment: p.label,
            style: {
              color: styleConfig.color,
              scale: styleConfig.scale,
              opacity: styleConfig.opacity,
              zIndex: props.focusBlockId === block.id ? 150 : 20,
            },
          })
        })

        const validGeometry: [number, number][] = (block.route.geometry as [number, number][]).filter(
          coord => isValidCoordinate(coord),
        )

        if (validGeometry.length >= 2) {
          routes.push({
            id: block.id,
            title: block.route.title || `${block.route.from || 'Начало'} - ${block.route.to || 'Конец'}`,
            points: validBlockPoints,
            geometry: validGeometry,
            color: routeColor,
            isVisible: true,
            isDirect: false,
          } as MapRoute)
        }
      }
    })
  })
  return routes
})

const controller = shallowRef<ReturnType<typeof useGeolocationMap> | null>(null)
const showPhotoPoints = ref(true)
const { isOpen, open, currentIndex } = useImageViewer()
const mapBodyRef = ref<HTMLElement | null>(null)
const photoMarkers: Marker[] = []
let photoPopup: Popup | null = null

const photos = computed(() => {
  const media = new Map<string, PostMedia>()
  for (const photo of props.post.media || [])
    media.set(photo.id, photo)
  for (const stage of props.post.stages || []) {
    for (const block of stage.blocks) {
      if (block.type === 'gallery') {
        for (const photo of block.images)
          media.set(photo.id, photo)
      }
    }
  }
  return [...media.values()].flatMap((photo) => {
    if (photo.type !== 'image' || photo.hasAccess === false)
      return []
    const lat = photo.latitude ?? photo.metadata?.latitude
    const lng = photo.longitude ?? photo.metadata?.longitude
    if (lat == null || lng == null)
      return []
    const coordinates: [number, number] = [Number(lng), Number(lat)]
    return isValidCoordinate(coordinates) ? [{ photo, coordinates }] : []
  })
})
const mapCenter = computed((): [number, number] => {
  if (mapPoints.value.length > 0) {
    return mapPoints.value[0].coordinates
  }
  if (mapRoutes.value.length > 0 && mapRoutes.value[0].geometry && mapRoutes.value[0].geometry.length > 0) {
    return mapRoutes.value[0].geometry[0]
  }
  if (photos.value.length > 0)
    return photos.value[0].coordinates
  if (isValidCoordinate([props.post.longitude, props.post.latitude])) {
    return [props.post.longitude, props.post.latitude]
  }
  // Фолбэк на дефолтные валидные координаты (Ульяновск / Москва)
  return [48.4031, 54.3142]
})

const viewerImages = computed<ImageViewerImage[]>(() => photos.value.map(({ photo }) => ({
  url: photo.url,
  alt: photo.originalName || 'Фото',
  meta: photo.metadata,
  variants: getPostMediaVariants(photo),
})))

function clearPhotoMarkers() {
  photoPopup?.remove()
  photoPopup = null
  photoMarkers.splice(0).forEach(marker => marker.remove())
}

function syncPhotoMarkers() {
  clearPhotoMarkers()
  const map = controller.value?.mapInstance.value
  if (!map || !controller.value?.isMapLoaded.value || !showPhotoPoints.value)
    return
  photos.value.forEach(({ photo, coordinates }, index) => {
    const variants = getPostMediaVariants(photo)
    const imageUrl = resolveApiUrl(variants?.small || variants?.medium || photo.url)
    const markerButton = document.createElement('button')
    markerButton.type = 'button'
    markerButton.className = 'post-photo-marker'
    markerButton.setAttribute('aria-label', photo.originalName || 'Показать фото')
    const thumbnail = document.createElement('img')
    thumbnail.src = imageUrl
    thumbnail.alt = ''
    markerButton.append(thumbnail)
    markerButton.addEventListener('click', (event) => {
      event.stopPropagation()
      photoPopup?.remove()
      const content = document.createElement('button')
      content.type = 'button'
      content.className = 'post-photo-preview'
      content.setAttribute('aria-label', 'Открыть фото')
      const image = document.createElement('img')
      image.src = resolveApiUrl(variants?.medium || photo.url)
      image.alt = photo.originalName || 'Фото'
      const caption = document.createElement('span')
      caption.textContent = 'Открыть фото'
      content.append(image, caption)
      content.addEventListener('click', () => open(viewerImages.value, index))
      photoPopup = new Popup({ offset: 24, maxWidth: '260px' })
        .setLngLat(coordinates)
        .setDOMContent(content)
        .addTo(map)
    })
    photoMarkers.push(new Marker({ element: markerButton, draggable: false })
      .setLngLat(coordinates).addTo(map))
  })
}

async function focusSelection() {
  await nextTick()
  const mapController = controller.value
  if (!mapController?.isMapLoaded.value || !(props.visible || props.pinned))
    return
  mapController.mapInstance.value?.resize()
  const route = mapRoutes.value.find(route => route.id === props.focusBlockId)
  const point = mapPoints.value.find(point => point.id === props.focusBlockId)
  mapController.setActivePointId(point?.id ?? null)
  if (route)
    mapController.fitToContent([], [route], { padding: 60, maxZoom: 15, duration: 500 })
  else if (point)
    mapController.fitToContent([point], [], { padding: 60, maxZoom: 15, duration: 500 })
  else
    mapController.fitToContent([...mapPoints.value, ...photos.value.map(({ photo, coordinates }) => ({ id: `photo-${photo.id}`, type: 'poi' as const, coordinates }))], mapRoutes.value, { padding: 60, maxZoom: 15, duration: 0 })
}

useResizeObserver(mapBodyRef, useDebounceFn(focusSelection, 100))

watch([() => props.focusRequest, () => props.focusBlockId, () => props.visible, () => props.pinned, isMapFullscreen, () => controller.value?.isMapLoaded.value], focusSelection, { flush: 'post' })
watch([photos, showPhotoPoints, () => controller.value?.isMapLoaded.value], syncPhotoMarkers, { flush: 'post' })

function onMapReady(mapController: ReturnType<typeof useGeolocationMap>) {
  controller.value = mapController
  syncPhotoMarkers()
  focusSelection()
}

function startDrag(e: MouseEvent) {
  if (props.pinned || isMapFullscreen.value || isMobileScreen.value)
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
  if (e.key !== 'Escape')
    return

  if (isMapFullscreen.value)
    isMapFullscreen.value = false
  else if (props.visible && !props.pinned && isMobileScreen.value)
    closeMap()
}

function closeMap() {
  isMapFullscreen.value = false
  emit('update:visible', false)
}

function unpinMap() {
  emit('update:visible', true)
  emit('update:pinned', false)
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
  clearPhotoMarkers()
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body" :disabled="pinned">
    <Transition name="map-backdrop">
      <div
        v-if="visible && !pinned && isMobileScreen"
        class="map-drawer-backdrop"
        aria-hidden="true"
        @click="closeMap"
      />
    </Transition>
    <Transition name="fade">
      <div
        v-show="visible || pinned"
        class="floating-map-window"
        :class="{
          'is-pinned': pinned,
          'is-fullscreen': isMapFullscreen,
          'is-mobile-drawer': isMobileScreen && !pinned,
        }"
        :style="(pinned || isMapFullscreen) ? {} : { left: `${position.x}px`, top: `${position.y}px` }"
      >
        <div v-if="!pinned && !isMapFullscreen" class="map-drag-handle" :class="{ 'is-mobile-drawer': isMobileScreen }" @mousedown="startDrag">
          <div v-if="isMobileScreen" class="drawer-grabber" aria-hidden="true" />
          <div v-else class="drag-indicator">
            <Icon icon="mdi:drag-horizontal" />
          </div>
          <div class="header-actions">
            <button class="action-btn photo-toggle" :class="{ 'is-active': showPhotoPoints }" :aria-pressed="showPhotoPoints" aria-label="Показать точки фото" title="Точки фото" @click="showPhotoPoints = !showPhotoPoints">
              <Icon icon="mdi:camera" />
            </button>
            <KitTooltip v-if="!isMobileScreen" text="Закрепить">
              <button class="action-btn" @click="emit('update:pinned', true)">
                <Icon icon="mdi:pin" />
              </button>
            </KitTooltip>
            <KitTooltip text="Закрыть">
              <button class="action-btn" aria-label="Закрыть карту" @click="closeMap">
                <Icon icon="mdi:close" />
              </button>
            </KitTooltip>
          </div>
        </div>

        <div v-if="pinned || isMapFullscreen" class="map-overlay-actions">
          <KitTooltip v-if="pinned && !isMapFullscreen" text="Открепить карту">
            <button class="unpin-floating-btn" aria-label="Открепить карту" @click="unpinMap">
              <Icon icon="mdi:pin-off" />
            </button>
          </KitTooltip>
          <KitTooltip text="Точки фото">
            <button class="unpin-floating-btn photo-toggle" :class="{ 'is-active': showPhotoPoints }" :aria-pressed="showPhotoPoints" aria-label="Показать точки фото" @click="showPhotoPoints = !showPhotoPoints">
              <Icon icon="mdi:camera" />
            </button>
          </KitTooltip>
        </div>

        <div ref="mapBodyRef" class="map-body">
          <div v-if="mapPoints.length === 0 && mapRoutes.length === 0 && photos.length === 0" class="empty-map">
            <p>В этом посте нет отмеченных локаций.</p>
          </div>
          <GeolocationMap
            v-else
            :points="mapPoints"
            :routes="mapRoutes"
            mode="pan"
            :center="mapCenter"
            height="100%"
            :is-loading="false"
            :readonly="true"
            :is-fullscreen="isMapFullscreen"
            :with-panel="false"
            @toggle-fullscreen="toggleFullscreen"
            @map-ready="onMapReady"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
  <KitImageViewer v-model:current-index="currentIndex" :visible="isOpen" :images="viewerImages" @update:visible="isOpen = $event" @close="isOpen = false" />
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

  &.is-mobile-drawer {
    top: auto !important;
    right: 0 !important;
    bottom: 0 !important;
    left: 0 !important;
    width: 100vw;
    height: min(82dvh, 860px);
    min-width: 0;
    min-height: 0;
    max-height: calc(100dvh - var(--safe-area-inset-top, env(safe-area-inset-top, 0px)));
    padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
    border-radius: var(--r-l) var(--r-l) 0 0;
    border-bottom: none;
    resize: none;
    z-index: 1001;
  }
}

.map-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
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

  &.is-mobile-drawer {
    height: 48px;
    flex-shrink: 0;
    cursor: default;
    padding: 0 12px;
  }
}

.drawer-grabber {
  position: absolute;
  top: 8px;
  left: 50%;
  width: 36px;
  height: 4px;
  border-radius: var(--r-full);
  background: var(--fg-tertiary-color);
  opacity: 0.7;
  transform: translateX(-50%);
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

.map-overlay-actions {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  gap: 8px;
}

.unpin-floating-btn {
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

  @include hover {
    & {
      background: var(--bg-primary-color);
      color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
    }
  }
}

.map-body {
  flex: 1;
  position: relative;
  background: var(--bg-secondary-color);
  min-height: 0;
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

.map-backdrop-enter-active,
.map-backdrop-leave-active {
  transition: opacity 0.2s ease;
}

.map-backdrop-enter-from,
.map-backdrop-leave-to {
  opacity: 0;
}
.photo-toggle {
  border: 1px solid var(--border-secondary-color);

  &.is-active {
    border-color: var(--fg-accent-color);
  }
}

:deep(.post-photo-marker) {
  width: 32px;
  height: 32px;
  padding: 0;
  overflow: hidden;
  border: 2px solid var(--fg-accent-color);
  border-radius: 50%;
  cursor: pointer;
  background: var(--bg-primary-color);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

:deep(.post-photo-preview) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 220px;
  padding: 0;
  border: none;
  cursor: pointer;
  background: var(--bg-primary-color);
  color: var(--fg-primary-color);

  img {
    width: 100%;
    max-height: 180px;
    object-fit: cover;
  }
}
</style>
