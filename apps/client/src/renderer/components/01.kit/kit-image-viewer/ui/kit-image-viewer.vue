--- File: ui/kit-image-viewer.vue ---

<script setup lang="ts">
import type { IImageViewerImageMeta, ImageQuality, ImageViewerImage } from '../models/types'
import { Icon } from '@iconify/vue'
import { onClickOutside, toRef, useIdle } from '@vueuse/core'
import { useRequest } from '~/plugins/request'
import { resolveApiUrl } from '~/shared/lib/url'
import { useImageViewerTransform, useSwipeNavigation } from '../composables'
import ImageMetadataPanel from './kit-image-metadata-panel.vue'
import KitViewerControls from './kit-viewer-controls.vue'

enum EImageViewerKeys {
  FETCH_IMAGE_VIEWER_METADATA = 'image-viewer:fetch-metadata',
}

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

const { idle: isIdle } = useIdle(3000, {
  events: ['mousemove', 'mousedown', 'resize', 'touchstart', 'wheel'],
})

const viewerContentRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const naturalSize = reactive({ width: 0, height: 0 })
const isUiVisible = ref(true)
const isMetadataPanelVisible = ref(false)
const isMetadataLoading = ref(false)

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

const areControlsVisible = computed(() => {
  if (!isUiVisible.value)
    return false

  if (isMetadataPanelVisible.value)
    return true

  if (isDragging.value || isZoomed.value)
    return true

  return !isIdle.value
})

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
  baseTransform: computed(() => imageStyle.value.transform),
})

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

watch(currentImageSrc, (src) => {
  if (src) {
    isCurrentImageLoading.value = true
    isCurrentImageInError.value = false
  }
}, { immediate: true })

watch(() => props.currentIndex, () => {
  resetTransform()
  isMetadataPanelVisible.value = false
  scrollToActiveThumbnail()
})

watch(areControlsVisible, (visible) => {
  if (visible) {
    nextTick(() => scrollToActiveThumbnail())
  }
})

watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    document.body.style.overflow = 'hidden'
    isUiVisible.value = true
    nextTick(() => scrollToActiveThumbnail())
  }
  else {
    document.body.style.overflow = ''
    resetTransform()
    isMetadataPanelVisible.value = false
  }
})

function handleImageLoad(event: Event) {
  const target = event.target as HTMLImageElement | null
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

async function handleShowMetadata() {
  const image = currentImage.value
  if (!image)
    return

  const hasFullMetadata = image.meta && (image.meta.camera || image.meta.settings)

  if (hasFullMetadata) {
    isMetadataPanelVisible.value = true
    return
  }

  const imageId = (image.meta as any)?.imageId

  if (imageId) {
    isMetadataLoading.value = true
    try {
      await useRequest({
        key: EImageViewerKeys.FETCH_IMAGE_VIEWER_METADATA,
        fn: db => db.files.getMetadata(imageId),
        onSuccess: (fullMetadata) => {
          if (fullMetadata) {
            if (!image.meta)
              image.meta = {}
            Object.assign(image.meta, fullMetadata)
          }
          isMetadataPanelVisible.value = true
        },
        onError: ({ error }) => {
          console.error('Failed to load metadata', error.customMessage)

          if (image.meta)
            isMetadataPanelVisible.value = true
        },
      })
    }
    finally {
      isMetadataLoading.value = false
    }
  }
  else if (image.meta) {
    isMetadataPanelVisible.value = true
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

const thumbnailsWrapperRef = ref<HTMLElement | null>(null)
function scrollToActiveThumbnail() {
  if (!thumbnailsWrapperRef.value)
    return
  const activeBtn = thumbnailsWrapperRef.value.children[props.currentIndex] as HTMLElement
  if (activeBtn) {
    activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }
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
          <!-- Header -->
          <Transition name="controls-fade">
            <div v-if="areControlsVisible" class="viewer-header">
              <div class="header-content-wrapper">
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
                  :has-metadata="true"
                  :is-metadata-loading="isMetadataLoading"
                  :show-quality-selector="showQualitySelector"
                  :show-info-button="showInfoButton"
                  @reset-transform="resetTransform"
                  @show-metadata="handleShowMetadata"
                  @close="close"
                />
              </div>
            </div>
          </Transition>

          <div class="viewer-content">
            <div ref="containerRef" class="image-container">
              <div class="swipe-container" :style="containerStyle">
                <div class="preview-image prev-preview">
                  <img v-if="prevImageSrc" v-resolve-src="prevImageSrc" class="preview-img" :style="adjacentImageStyle">
                </div>

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

                <div class="preview-image next-preview">
                  <img v-if="nextImageSrc" v-resolve-src="nextImageSrc" class="preview-img" :style="adjacentImageStyle">
                </div>
              </div>
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
          <div v-if="$slots.footer && areControlsVisible" class="viewer-footer">
            <slot
              name="footer"
              :image="currentImage"
              :index="currentIndex"
              :transform="transform"
            />
          </div>
          <!-- Thumbnails -->
          <Transition name="controls-fade">
            <div v-if="enableThumbnails && hasMultipleImages && areControlsVisible" class="thumbnails-container">
              <div ref="thumbnailsWrapperRef" class="thumbnails-wrapper">
                <button
                  v-for="(image, index) in images"
                  :key="`thumb-${index}`"
                  class="thumbnail"
                  :class="{ active: index === currentIndex }"
                  :title="`Go to image ${index + 1}`"
                  @click.stop="goToIndex(index)"
                >
                  <img v-resolve-src="image.variants?.small || image.url" :alt="image.alt || `Thumbnail ${index + 1}`">
                </button>
              </div>
            </div>
          </Transition>
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
  top: env(safe-area-inset-top) !important;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
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
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0) 100%);

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
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  color: #fff;
  padding: 8px 16px;
  border-radius: var(--r-full);
  font-size: 14px;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.1);
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
  width: 15%;
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
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 10;

  & > * {
    pointer-events: auto;
  }
}

.viewer-footer {
  bottom: 0;
  padding: 8px 0;
  display: flex;
  justify-content: center;

  @include media-down(sm) {
    padding: 8px;
  }
}

.thumbnails-container {
  bottom: 20px;
  display: flex;
  justify-content: center;
  width: 100%;
}

.thumbnails-wrapper {
  display: flex;
  gap: 10px;
  padding: 10px 20px;
  /* Убрали фон и бордер, как просил пользователь */
  background: transparent;
  border: none;

  /* Исправляем скролл */
  overflow-x: auto;
  max-width: 100%;
  /* Маска для красивого затухания по краям */
  mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
  -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);

  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;

  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.3);
    border-radius: 4px;
  }
}

.thumbnail {
  position: relative;
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: var(--r-s);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  border: 2px solid transparent;
  opacity: 0.6;
  background: #000;
  padding: 0;

  &:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }

  &.active {
    opacity: 1;
    border-color: var(--fg-accent-color);
    transform: scale(1.1);
    z-index: 1;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

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
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--r-2xs);
}

/* Transitions */

.viewer-fade-enter-active,
.viewer-fade-leave-active {
  transition: opacity 0.25s ease;
}
.viewer-fade-enter-from,
.viewer-fade-leave-to {
  opacity: 0;
}

.controls-fade-enter-active,
.controls-fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.controls-fade-enter-from,
.controls-fade-leave-to {
  opacity: 0;
}
/* Header slides up slightly when hiding */
.viewer-header.controls-fade-leave-to {
  transform: translateY(-10px);
}
/* Thumbnails slide down slightly when hiding */
.thumbnails-container.controls-fade-leave-to {
  transform: translateY(10px);
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
  }
  .thumbnail {
    width: 44px;
    height: 44px;
  }
}
@include media-down(sm) {
  .viewer-header {
    display: block;
    background: transparent;
  }
  .header-left {
    justify-content: flex-start;
  }
}
</style>
