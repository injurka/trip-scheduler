<script setup lang="ts">
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { PostMedia } from '~/shared/types/models/post'
import { computed, ref } from 'vue'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitImageViewer, useImageViewer } from '~/components/01.kit/kit-image-viewer'

const props = withDefaults(defineProps<{
  images: PostMedia[]
  comment?: string
  displayType?: 'grid' | 'panorama' | 'masonry' | 'slider'
}>(), {
  displayType: 'grid',
})

const { isOpen, open, currentIndex } = useImageViewer()

const viewerImages = computed<ImageViewerImage[]>(() => {
  return props.images.map(img => ({
    url: img.url,
    alt: img.originalName || 'Image',
    meta: img.metadata || undefined,
    variants: img.metadata?.variants,
  }))
})

function getOptimizedUrl(img: PostMedia) {
  const variants = img.metadata.variants

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

function handleImageClick(index: number, e: Event) {
  if (isDragging.value) {
    e.preventDefault()
    e.stopPropagation()
    return
  }
  open(viewerImages.value, index)
}
</script>

<template>
  <div class="gallery-block">
    <!-- СЕТКА -->
    <div v-if="displayType === 'grid'" class="gallery-layout grid-layout" :class="`count-${Math.min(images.length, 4)}`">
      <div v-for="(img, idx) in images.slice(0, 4)" :key="idx" class="img-wrapper" @click="handleImageClick(idx, $event)">
        <KitImage :src="getOptimizedUrl(img)" object-fit="cover" />
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
        <div v-for="(img, idx) in images" :key="idx" class="img-wrapper" @click="handleImageClick(idx, $event)">
          <KitImage
            :src="getOptimizedUrl(img)"
            object-fit="cover"
            draggable="false"
          />
        </div>
      </div>
    </div>

    <!-- ПАНОРАМА И КОЛЛАЖ -->
    <div v-else class="gallery-layout scroll-layout" :class="`layout-${displayType}`">
      <div v-for="(img, idx) in images" :key="idx" class="img-wrapper" @click="handleImageClick(idx, $event)">
        <KitImage :src="getOptimizedUrl(img)" object-fit="cover" />
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
  </div>
</template>

<style scoped lang="scss">
.gallery-block {
  margin: 12px 0;
}

.gallery-layout {
  border-radius: var(--r-m);
  overflow: hidden;
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
</style>
