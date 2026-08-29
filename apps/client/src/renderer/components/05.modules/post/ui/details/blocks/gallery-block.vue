<script setup lang="ts">
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { PostMedia } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitImageViewer, useImageViewer } from '~/components/01.kit/kit-image-viewer'
import { resolveApiUrl } from '~/shared/lib/url'

const props = withDefaults(defineProps<{
  images: PostMedia[]
  comment?: string
  displayType?: 'grid' | 'panorama' | 'masonry' | 'slider'
}>(), {
  displayType: 'grid',
})

const { isOpen, open, currentIndex } = useImageViewer()

const activeVideoUrl = ref<string | null>(null)
const isVideoModalOpen = ref(false)

const viewerImages = computed<ImageViewerImage[]>(() => {
  return props.images
    .filter(img => img.type !== 'video' && img.hasAccess !== false)
    .map(img => ({
      url: img.url,
      alt: img.originalName || 'Image',
      meta: img.metadata || undefined,
      variants: img.metadata?.variants,
    }))
})

function getOptimizedUrl(img: PostMedia) {
  if (img.type === 'video') {
    return img.metadata?.variants?.poster || img.metadata?.variants?.medium || img.metadata?.variants?.small || img.url
  }

  const variants = img.metadata?.variants

  if (!variants)
    return img.url

  if (props.displayType === 'grid' || props.displayType === 'masonry') {
    return variants.medium || variants.small || img.url
  }

  if (props.displayType === 'slider' || props.displayType === 'panorama') {
    return variants.large || variants.medium || img.url
  }

  return img.url
}

const sliderRef = ref<HTMLElement | null>(null)
let isDown = false
let startX = 0
let scrollLeft = 0
const isDragging = ref(false)

function startDrag(e: MouseEvent) {
  isDown = true
  isDragging.value = false
  startX = e.pageX - (sliderRef.value?.offsetLeft || 0)
  scrollLeft = sliderRef.value?.scrollLeft || 0
}

function stopDrag() {
  isDown = false
  setTimeout(() => {
    isDragging.value = false
  }, 50)
}

function onDrag(e: MouseEvent) {
  if (!isDown)
    return
  e.preventDefault()
  const x = e.pageX - (sliderRef.value?.offsetLeft || 0)
  const walk = (x - startX) * 2
  if (Math.abs(walk) > 5)
    isDragging.value = true

  if (sliderRef.value) {
    sliderRef.value.scrollLeft = scrollLeft - walk
  }
}

function handleItemClick(img: PostMedia, e: Event) {
  if (isDragging.value) {
    e.preventDefault()
    e.stopPropagation()
    return
  }

  if (img.hasAccess === false) {
    return
  }

  if (img.type === 'video') {
    activeVideoUrl.value = resolveApiUrl(img.metadata?.variants?.web || img.url)
    isVideoModalOpen.value = true
    return
  }

  const imageIndex = viewerImages.value.findIndex(v => v.url === img.url)
  if (imageIndex !== -1) {
    open(viewerImages.value, imageIndex)
  }
}
</script>

<template>
  <div class="gallery-block">
    <!-- СЕТКА -->
    <div v-if="displayType === 'grid'" class="gallery-layout grid-layout" :class="`count-${Math.min(images.length, 4)}`">
      <div
        v-for="(img, idx) in images.slice(0, 4)"
        :key="idx"
        class="img-wrapper"
        :class="{ 'is-locked': img.hasAccess === false }"
        @click="handleItemClick(img, $event)"
      >
        <div v-if="img.hasAccess === false" class="locked-card">
          <Icon icon="mdi:lock" class="lock-icon" />
          <span class="lock-title">Приватное медиа</span>
          <span class="lock-desc">Только в белом списке</span>
        </div>
        <template v-else>
          <KitImage :src="getOptimizedUrl(img)" object-fit="cover" />
          <div v-if="img.type === 'video'" class="video-play-badge">
            <Icon icon="mdi:play" />
          </div>
          <div v-if="img.isPrivate" class="private-badge" title="Приватное медиа">
            <Icon icon="mdi:lock" />
          </div>
        </template>
        <div v-if="images.length > 4 && idx === 3" class="more-overlay">
          +{{ images.length - 4 }}
        </div>
      </div>
    </div>

    <!-- СЛАЙДЕР (С затемнением и drag-to-scroll) -->
    <div v-else-if="displayType === 'slider'" class="slider-wrapper">
      <div
        ref="sliderRef"
        class="gallery-layout layout-slider"
        :class="{ 'is-dragging-active': isDragging }"
        @mousedown="startDrag"
        @mouseleave="stopDrag"
        @mouseup="stopDrag"
        @mousemove="onDrag"
      >
        <div
          v-for="(img, idx) in images"
          :key="idx"
          class="img-wrapper"
          :class="{ 'is-locked': img.hasAccess === false }"
          @click="handleItemClick(img, $event)"
        >
          <div v-if="img.hasAccess === false" class="locked-card">
            <Icon icon="mdi:lock" class="lock-icon" />
            <span class="lock-title">Приватное медиа</span>
            <span class="lock-desc">Только в белом списке</span>
          </div>
          <template v-else>
            <KitImage
              :src="getOptimizedUrl(img)"
              object-fit="cover"
              draggable="false"
            />
            <div v-if="img.type === 'video'" class="video-play-badge">
              <Icon icon="mdi:play" />
            </div>
            <div v-if="img.isPrivate" class="private-badge" title="Приватное медиа">
              <Icon icon="mdi:lock" />
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ПАНОРАМА И КОЛЛАЖ -->
    <div v-else class="gallery-layout scroll-layout" :class="`layout-${displayType}`">
      <div
        v-for="(img, idx) in images"
        :key="idx"
        class="img-wrapper"
        :class="{ 'is-locked': img.hasAccess === false }"
        @click="handleItemClick(img, $event)"
      >
        <div v-if="img.hasAccess === false" class="locked-card">
          <Icon icon="mdi:lock" class="lock-icon" />
          <span class="lock-title">Приватное медиа</span>
          <span class="lock-desc">Только в белом списке</span>
        </div>
        <template v-else>
          <KitImage :src="getOptimizedUrl(img)" object-fit="cover" />
          <div v-if="img.type === 'video'" class="video-play-badge">
            <Icon icon="mdi:play" />
          </div>
          <div v-if="img.isPrivate" class="private-badge" title="Приватное медиа">
            <Icon icon="mdi:lock" />
          </div>
        </template>
      </div>
    </div>

    <p v-if="comment" class="comment">
      {{ comment }}
    </p>

    <KitImageViewer
      v-model:current-index="currentIndex"
      :visible="isOpen"
      :images="viewerImages"
      @update:visible="isOpen = $event"
      @close="isOpen = false"
    />

    <KitDialogWithClose
      :visible="isVideoModalOpen"
      title="Просмотр видео"
      icon="mdi:video-outline"
      :max-width="900"
      @update:visible="isVideoModalOpen = $event"
    >
      <div v-if="activeVideoUrl" class="video-modal-content">
        <video
          :src="activeVideoUrl"
          controls
          autoplay
          playsinline
          class="modal-video-player"
        />
      </div>
    </KitDialogWithClose>
  </div>
</template>

<style scoped lang="scss">
.gallery-block {
  margin: 12px 0;
  width: 100%;
}

.gallery-layout {
  border-radius: var(--r-m);
  overflow: hidden;
  width: 100%;
}

.img-wrapper {
  position: relative;
  width: 100%;
  cursor: pointer;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-s);
  overflow: hidden;
  user-select: none;
  -webkit-user-drag: none;
}

/* === GRID LAYOUT === */
.grid-layout {
  display: grid;
  gap: 6px;
  width: 100%;

  &.count-1 {
    grid-template-columns: 1fr;
  }
  &.count-2 {
    grid-template-columns: 1fr 1fr;
  }
  &.count-3 {
    grid-template-columns: 2fr 1fr;
    grid-template-rows: 1fr 1fr;
    .img-wrapper:first-child {
      grid-row: span 2;
    }
  }
  &.count-4 {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }

  .img-wrapper {
    height: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 0;
  }
}

.more-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.2rem;
}

/* === SLIDER LAYOUT === */
.slider-wrapper {
  position: relative;
  border-radius: var(--r-m);
  overflow: hidden;
  width: 100%;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 12%;
    pointer-events: none;
    z-index: 2;
  }
  &::before {
    left: 0;
    background: linear-gradient(to left, rgba(var(--bg-primary-color-rgb), var(--content-bg-opacity)), transparent);
  }
  &::after {
    right: 0;
    background: linear-gradient(to right, rgba(var(--bg-primary-color-rgb), var(--content-bg-opacity)), transparent);
  }
}

.layout-slider {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  gap: 12px;
  scrollbar-width: none;
  border-radius: 0;
  cursor: grab;
  width: 100%;

  &::-webkit-scrollbar {
    display: none;
  }

  &.is-dragging-active {
    scroll-snap-type: none;
    cursor: grabbing;
  }

  .img-wrapper {
    flex: 0 0 85%;
    aspect-ratio: 4 / 3;
    scroll-snap-align: center;
  }
}

/* === PANORAMA LAYOUT === */
.layout-panorama {
  display: flex;
  overflow-x: auto;
  gap: 4px;
  padding-bottom: 4px;
  scrollbar-width: thin;
  border-radius: 0;
  width: 100%;

  .img-wrapper {
    flex: 0 0 auto;
    height: 250px;
    aspect-ratio: 16 / 9;
  }
}

/* === MASONRY LAYOUT === */
.layout-masonry {
  columns: 2;
  column-gap: 8px;
  background: transparent;
  border-radius: 0;
  width: 100%;

  .img-wrapper {
    break-inside: avoid;
    margin-bottom: 8px;
  }

  .img-wrapper:nth-child(even) {
    aspect-ratio: 3/4;
  }
  .img-wrapper:nth-child(odd) {
    aspect-ratio: 4/3;
  }
}

.comment {
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  font-style: italic;
  margin-top: 8px;
}

.img-wrapper.is-locked {
  cursor: default;
}

.locked-card {
  width: 100%;
  height: 100%;
  min-height: 140px;
  background: var(--bg-secondary-color);
  border: 1px dashed var(--border-secondary-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  text-align: center;
  gap: 6px;

  .lock-icon {
    font-size: 28px;
    color: var(--fg-warning-color, #f59e0b);
  }

  .lock-title {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--fg-primary-color);
  }

  .lock-desc {
    font-size: 0.75rem;
    color: var(--fg-secondary-color);
  }
}

.video-play-badge {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 44px;
  height: 44px;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition:
    transform 0.2s ease,
    background 0.2s ease;
  pointer-events: none;
}

.img-wrapper:hover .video-play-badge {
  transform: translate(-50%, -50%) scale(1.1);
  background: rgba(var(--bg-accent-color-rgb), 0.9);
}

.private-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.65);
  color: var(--fg-warning-color, #f59e0b);
  padding: 4px;
  border-radius: 6px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.video-modal-content {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #000;
  border-radius: var(--r-m);
  overflow: hidden;
}

.modal-video-player {
  max-width: 100%;
  max-height: 75vh;
  width: 100%;
  outline: none;
}
</style>
