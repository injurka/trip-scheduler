<script setup lang="ts">
import type { IImageViewerImageMeta, ImageQuality, ImageViewerImage } from '../models/types'
import { Icon } from '@iconify/vue'
import { onClickOutside, toRef } from '@vueuse/core'
import { resolveApiUrl } from '~/shared/lib/url'
import { useImageViewerTransform, useSwipeNavigation } from '../composables'
import ImageMetadataPanel from './kit-image-metadata-panel.vue'
import KitViewerControls from './kit-viewer-controls.vue'

interface Props {
  visible: boolean
  images: ImageViewerImage[]
  currentIndex: number
  showCounter?: boolean
  enableThumbnails?: boolean
  closeOnOverlayClick?: boolean
  maxZoom?: number
  minZoom?: number
  zoomStep?: number
  enableTouch?: boolean
  animationDuration?: number
  showQualitySelector?: boolean
  showInfoButton?: boolean
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'update:currentIndex', value: number): void
  (e: 'close'): void
  (e: 'imageLoad', image: ImageViewerImage): void
  (e: 'imageError', error: Event): void
}

const props = withDefaults(defineProps<Props>(), {
  showCounter: true,
  enableThumbnails: false,
  closeOnOverlayClick: true,
  maxZoom: 4,
  minZoom: 1,
  zoomStep: 0.5,
  enableTouch: true,
  animationDuration: 300,
  showQualitySelector: true,
  showInfoButton: true,
})

const emit = defineEmits<Emits>()

const preferredQuality = useStorage<ImageQuality>('viewer-quality-preference', 'large')

const viewerContentRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const naturalSize = reactive({ width: 0, height: 0 })
const isUiVisible = ref(true)
const isMetadataPanelVisible = ref(false)

// --- Новая, более надежная система отслеживания загрузки ---
const isCurrentImageLoading = ref(true)
const isCurrentImageInError = ref(false)

const currentImage = computed(() => props.images[props.currentIndex])
const currentImageSrc = computed(() => {
  const image = currentImage.value
  if (!image)
    return ''

  switch (preferredQuality.value) {
    case 'medium':
      return image.variants?.medium || image.variants?.large || image.url
    case 'large':
      return image.variants?.large || image.url
    case 'original':
      return image.url
    default:
      return image.variants?.large || image.url
  }
})

const hasMultipleImages = computed(() => props.images.length > 1)

const {
  transform,
  isDragging,
  imageStyle,
  canZoomIn,
  canZoomOut,
  handleDoubleClick,
  handleWheel,
  handleMouseDown,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  resetTransform,
} = useImageViewerTransform({
  imageRef,
  containerRef,
  naturalSize,
  minZoom: toRef(props, 'minZoom'),
  maxZoom: toRef(props, 'maxZoom'),
  zoomStep: toRef(props, 'zoomStep'),
  enableTouch: toRef(props, 'enableTouch'),
  animationDuration: toRef(props, 'animationDuration'),
})

const isZoomed = computed(() => transform.scale > props.minZoom)

const {
  prevImageSrc,
  nextImageSrc,
  containerStyle,
  currentImageStyle,
  adjacentImageStyle,
  handleTouchStart: handleSwipeTouchStart,
  handleTouchMove: handleSwipeTouchMove,
  handleTouchEnd: handleSwipeTouchEnd,
} = useSwipeNavigation({
  onNext: next,
  onPrev: prev,
  images: toRef(props, 'images'),
  currentIndex: toRef(props, 'currentIndex'),
  isZoomed,
  preferredQuality,
  threshold: 80,
  velocity: 0.3,
})

// --- Combined touch handlers ---
function handleTouchStartCombined(event: TouchEvent) {
  handleSwipeTouchStart(event)
  handleTouchStart(event)
}

function handleTouchMoveCombined(event: TouchEvent) {
  handleSwipeTouchMove(event)
  handleTouchMove(event)
}

function handleTouchEndCombined(event: TouchEvent) {
  handleSwipeTouchEnd()
  handleTouchEnd(event)
}

const currentImageMeta = computed((): IImageViewerImageMeta | null => {
  return toRaw(props.images[props.currentIndex]?.meta) || null
})

// Сбрасываем состояние загрузки при смене изображения
watch(currentImageSrc, (src) => {
  if (src) {
    isCurrentImageLoading.value = true
    isCurrentImageInError.value = false
  }
}, { immediate: true })

watch(() => props.currentIndex, () => {
  resetTransform()
  isMetadataPanelVisible.value = false
})

watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    document.body.style.overflow = 'hidden'
    isUiVisible.value = true
  }
  else {
    document.body.style.overflow = ''
    resetTransform()
    isMetadataPanelVisible.value = false
  }
})

function handleImageLoad(event: Event) {
  const target = event.target as HTMLImageElement | null
  // Убедимся, что событие пришло от текущего изображения, чтобы избежать race condition
  if (target && target.src === resolveApiUrl(currentImageSrc.value)) {
    isCurrentImageLoading.value = false
    isCurrentImageInError.value = false
    if (imageRef.value) {
      naturalSize.width = imageRef.value.naturalWidth
      naturalSize.height = imageRef.value.naturalHeight
      emit('imageLoad', currentImage.value)
    }
  }
}

function handleImageError(event: Event) {
  const target = event.target as HTMLImageElement | null
  if (target && target.src === resolveApiUrl(currentImageSrc.value)) {
    isCurrentImageLoading.value = false
    isCurrentImageInError.value = true
    emit('imageError', event)
  }
}

function close() {
  emit('update:visible', false)
  emit('close')
}

function next() {
  if (!hasMultipleImages.value)
    return
  const newIndex = (props.currentIndex + 1) % props.images.length
  emit('update:currentIndex', newIndex)
}

function prev() {
  if (!hasMultipleImages.value)
    return
  const newIndex = (props.currentIndex - 1 + props.images.length) % props.images.length
  emit('update:currentIndex', newIndex)
}

function goToIndex(index: number) {
  if (index >= 0 && index < props.images.length)
    emit('update:currentIndex', index)
}

onClickOutside(viewerContentRef, () => {
  if (props.closeOnOverlayClick && props.visible && !isDragging.value && transform.scale <= props.minZoom && !isMetadataPanelVisible.value)
    close()
})

onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="viewer-fade">
      <div
        v-if="visible"
        class="image-viewer-overlay"
        @wheel="handleWheel"
        @touchstart="handleTouchStartCombined"
        @touchmove="handleTouchMoveCombined"
        @touchend="handleTouchEndCombined"
        @touchcancel="handleTouchEndCombined"
      >
        <div ref="viewerContentRef" class="viewer-wrapper">
          <div class="viewer-header">
            <div v-if="isUiVisible" class="header-content-wrapper">
              <div class="header-left">
                <div v-if="showCounter && hasMultipleImages" class="viewer-counter">
                  {{ currentIndex + 1 }} / {{ images.length }}
                </div>
              </div>
              <div class="header-center">
                <div v-if="transform.scale > minZoom" class="scale-indicator">
                  {{ Math.round(transform.scale * 100) }}%
                </div>
              </div>
            </div>
            <div class="header-right">
              <KitViewerControls
                v-model:is-ui-visible="isUiVisible"
                v-model:quality="preferredQuality"
                :can-zoom-in="canZoomIn"
                :can-zoom-out="canZoomOut"
                :is-zoomed="isZoomed"
                :has-metadata="!!currentImageMeta"
                :show-quality-selector="showQualitySelector"
                :show-info-button="showInfoButton"
                @reset-transform="resetTransform"
                @show-metadata="isMetadataPanelVisible = true"
                @close="close"
              />
            </div>
          </div>
          <div class="viewer-content">
            <div ref="containerRef" class="image-container">
              <div class="swipe-container" :style="containerStyle">
                <!-- Preview Предыдущего -->
                <div class="preview-image prev-preview">
                  <img v-if="prevImageSrc" v-resolve-src="prevImageSrc" class="preview-img" :style="adjacentImageStyle">
                </div>

                <!-- Текущее изображение -->
                <div class="current-image-wrapper">
                  <Transition name="loader-fade">
                    <div v-if="isCurrentImageLoading || isCurrentImageInError" class="placeholder-wrapper">
                      <div v-if="isCurrentImageInError" class="image-error">
                        <Icon width="64" height="64" icon="mdi:image-broken-variant" />
                        <span>Не удалось загрузить изображение</span>
                      </div>
                      <div v-else-if="isCurrentImageLoading" class="image-placeholder">
                        <div class="loading-spinner">
                          <Icon width="64" height="64" icon="mdi:loading" class="spinning" />
                        </div>
                        <span>Загрузка изображения...</span>
                      </div>
                    </div>
                  </Transition>

                  <img
                    v-if="currentImage"
                    :key="currentImageSrc"
                    ref="imageRef"
                    v-resolve-src="currentImageSrc"
                    :alt="currentImage.alt || `Image ${currentIndex + 1}`"
                    class="viewer-image"
                    :class="{ loaded: !isCurrentImageLoading && !isCurrentImageInError }"
                    :style="[imageStyle, currentImageStyle]"
                    @load="handleImageLoad"
                    @error="handleImageError"
                    @mousedown="handleMouseDown"
                    @dblclick="handleDoubleClick"
                    @dragstart.prevent
                  >
                </div>

                <!-- Preview Следующего -->
                <div class="preview-image next-preview">
                  <img v-if="nextImageSrc" v-resolve-src="nextImageSrc" class="preview-img" :style="adjacentImageStyle">
                </div>
              </div>
              <!-- Невидимые навигационные зоны для десктопа -->
              <div
                v-if="hasMultipleImages && transform.scale <= minZoom"
                class="nav-zone prev-zone"
                @click="prev"
              />
              <div
                v-if="hasMultipleImages && transform.scale <= minZoom"
                class="nav-zone next-zone"
                @click="next"
              />
            </div>
          </div>
          <div v-if="$slots.footer && isUiVisible" class="viewer-footer">
            <slot
              name="footer"
              :image="currentImage"
              :index="currentIndex"
              :transform="transform"
            />
          </div>
          <div v-if="enableThumbnails && hasMultipleImages && isUiVisible" class="thumbnails-container">
            <div class="thumbnails-wrapper">
              <button
                v-for="(image, index) in images"
                :key="`thumb-${index}`"
                class="thumbnail"
                :class="{ active: index === currentIndex }"
                :title="`Go to image ${index + 1}`"
                @click="goToIndex(index)"
              >
                <img v-resolve-src="image.variants?.small || image.url" :alt="image.alt || `Thumbnail ${index + 1}`">
                <div v-if="index === currentIndex" class="thumbnail-indicator" />
              </button>
            </div>
          </div>
        </div>
        <ImageMetadataPanel
          v-if="currentImageMeta"
          :meta="currentImageMeta"
          :visible="isMetadataPanelVisible"
          @close="isMetadataPanelVisible = false"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.image-viewer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 21;
  display: flex;
  flex-direction: column;
  touch-action: none;
  user-select: none;
}

.viewer-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  pointer-events: none;

  & > * {
    pointer-events: auto;
  }
}

.viewer-header {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
  z-index: 10;
  pointer-events: none;

  & > * {
    pointer-events: auto;
  }
}

.header-content-wrapper {
  display: contents;
}

.header-left,
.header-center,
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left {
  position: absolute;
  left: 20px;
  top: calc(20px + env(safe-area-inset-top));
}
.header-center {
  position: absolute;
  left: 50%;
  top: calc(20px + env(safe-area-inset-top));
  transform: translateX(-50%);
}
.header-right {
  position: absolute;
  right: 20px;
  top: calc(20px + env(safe-area-inset-top));
}

.viewer-counter,
.scale-indicator {
  background: var(--bg-tertiary-color);
  color: var(--fg-primary-color);
  padding: 8px 16px;
  border-radius: var(--r-full);
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--border-primary-color);
  white-space: nowrap;
}

.scale-indicator {
  padding: 6px 12px;
  font-size: 12px;
  min-width: 50px;
  text-align: center;
}

.viewer-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.image-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.placeholder-wrapper {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.image-placeholder,
.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--fg-secondary-color);
  font-size: 16px;
  width: 100%;

  .icon {
    font-size: 48px;
  }

  .spinning {
    animation: spin 1s linear infinite;
  }
}

.viewer-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  cursor: grab;
  transform-origin: center;
  transition: opacity 0.3s ease;
  opacity: 0;
  border-radius: var(--r-2xs);

  &.loaded {
    opacity: 1;
  }

  &:active {
    cursor: grabbing;
  }
}

.nav-zone {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 25%;
  z-index: 2;
  cursor: pointer;
}
.prev-zone {
  left: 0;
}
.next-zone {
  right: 0;
}

.viewer-footer,
.thumbnails-container {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 40px);
  pointer-events: none;
  & > * {
    pointer-events: auto;
  }
}

.viewer-footer {
  bottom: 0;
  padding: 8px 0;
  width: 100%;
  max-width: none;
  display: flex;
  justify-content: center;

  @include media-down(sm) {
    padding: 8px;
  }
}

.thumbnails-container {
  bottom: 20px;
}

.thumbnails-wrapper {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: var(--bg-tertiary-color);
  border-radius: var(--r-l);
  border: 1px solid var(--border-primary-color);
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.thumbnail {
  position: relative;
  flex-shrink: 0;
  width: 60px;
  height: 60px;
  border-radius: var(--r-s);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;

  &:hover {
    transform: scale(1.05);
  }

  &.active {
    border-color: var(--border-focus-color);
    transform: scale(1.1);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.thumbnail-indicator {
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 6px;
  height: 6px;
  background: var(--fg-accent-color);
  border-radius: var(--r-full);
}

// --- Swipe Styles ---
.swipe-container {
  display: flex;
  position: absolute;
  height: 100%;
  width: 300%;
  left: -100%;
  will-change: transform;
}

.current-image-wrapper {
  flex: 1 0 33.3333%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  height: 100%;
  padding: 70px 0;
}

.preview-image {
  flex: 1 0 33.3333%;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 70px 40px;
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--r-2xs);
  filter: brightness(0.8);
  opacity: 0;
}

.viewer-fade-enter-active,
.viewer-fade-leave-active {
  transition: opacity 0.2s ease;
}
.viewer-fade-enter-from,
.viewer-fade-leave-to {
  opacity: 0;
}
.loader-fade-enter-active {
  transition: opacity 0.2s ease-in;
  transition-delay: 150ms;
}
.loader-fade-leave-active {
  transition: opacity 0s;
}
.loader-fade-enter-from,
.loader-fade-leave-to {
  opacity: 0;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@include media-down(md) {
  .viewer-header,
  .header-right {
    display: flex;
    justify-content: flex-end;
    top: env(safe-area-inset-top);
    left: 0px;
    right: 0px;
    padding: 16px 0;
    right: 8px;
  }
  .header-left {
    justify-content: flex-start;
  }
  .header-center {
    top: 60px;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0.5;
  }
  .viewer-content {
    padding: 0;
  }
  .current-image-wrapper,
  .preview-image {
    padding: 4px;
  }

  .nav-btn {
    width: 40px;
    height: 40px;
    font-size: 20px;
    &.prev-btn {
      left: 16px;
    }
    &.next-btn {
      right: 16px;
    }
  }
  .viewer-counter {
    padding: 6px 12px;
    font-size: 12px;
  }
  .scale-indicator {
    padding: 4px 8px;
    font-size: 11px;
  }
  .thumbnails-container {
    bottom: 16px;
    max-width: calc(100% - 32px);
  }
  .thumbnail {
    width: 48px;
    height: 48px;
  }
}
@include media-down(sm) {
  .viewer-header {
    display: block;
  }
  .header-left {
    justify-content: flex-start;
  }

  .preview-image {
    padding: 8px 16px;
  }
}
</style>
