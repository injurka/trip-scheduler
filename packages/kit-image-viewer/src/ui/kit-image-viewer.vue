<script setup lang="ts">
import type { Component } from 'vue'
import type { IImageViewerImageMeta, ImageQuality, ImageViewerImage } from '../models/types'
import { Icon } from '@iconify/vue'
import { toRef, useEventListener, useIdle } from '@vueuse/core'
import { computed, nextTick, onUnmounted, reactive, ref, toRaw, watch } from 'vue'
import {
  useImageViewerSwipe,
  useImageViewerThumbnails,
  useImageViewerTransform,
  useImageViewerUi,
} from '../composables'
import { getThumbHashDataUrl } from '../lib/thumbhash'
import ImageMetadataPanel from './kit-image-metadata-panel.vue'
import KitVideoPlayer from './kit-video-player.vue'
import KitViewerControls from './kit-viewer-controls.vue'

interface Props {
  visible: boolean
  images: ImageViewerImage[]
  currentIndex: number
  quality?: ImageQuality
  showCounter?: boolean
  enableThumbnails?: boolean
  closeOnOverlayClick?: boolean
  enableKeyboard?: boolean
  maxZoom?: number
  minZoom?: number
  zoomStep?: number
  enableTouch?: boolean
  animationDuration?: number
  showQualitySelector?: boolean
  showInfoButton?: boolean
  hasNextPage?: boolean
  hasPrevPage?: boolean
  isFetching?: boolean
  resolveUrl?: (url: string) => string
  fetchMetadata?: (image: ImageViewerImage) => Promise<IImageViewerImageMeta | null | void>
  mapComponent?: Component
  qualityLabels?: Record<string, string>
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'update:currentIndex', value: number): void
  (e: 'update:quality', value: ImageQuality): void
  (e: 'close'): void
  (e: 'imageLoad', image: ImageViewerImage): void
  (e: 'imageError', error: Event): void
  (e: 'nextPage'): void
  (e: 'prevPage'): void
  (e: 'fetchMetadata', image: ImageViewerImage): void
}

const props = withDefaults(defineProps<Props>(), {
  showCounter: true,
  enableThumbnails: false,
  closeOnOverlayClick: true,
  enableKeyboard: true,
  maxZoom: 4,
  minZoom: 1,
  zoomStep: 0.5,
  enableTouch: true,
  animationDuration: 300,
  showQualitySelector: true,
  showInfoButton: true,
})

const emit = defineEmits<Emits>()

const imageRef = ref<HTMLImageElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const thumbnailsRef = ref<HTMLElement | null>(null)
const naturalSize = reactive({ width: 0, height: 0 })
const isUiVisible = ref(true)
const isMetadataLoading = ref(false)

const currentImage = computed(() => props.images[props.currentIndex] ?? null)
function getPlaceholderUrl(image: ImageViewerImage): string | undefined {
  return getThumbHashDataUrl(image.variants?.thumbhash || image.meta?.thumbhash) ?? undefined
}
const hasMultipleImages = computed(() => props.images.length > 1)

const paginationPromptDirection = ref<'next' | 'prev' | null>(null)

function closePaginationPrompt() {
  paginationPromptDirection.value = null
}

function confirmPagination() {
  if (paginationPromptDirection.value === 'next') {
    emit('nextPage')
  }
  else if (paginationPromptDirection.value === 'prev') {
    emit('prevPage')
  }
  closePaginationPrompt()
}

const {
  thumbnailSize,
  totalWidth: totalThumbnailsWidth,
  visibleThumbnails,
  failedThumbnails,
  loadedThumbnails,
  onThumbnailsScroll,
  scrollThumbnailIntoView,
  resolveThumbnailUrl,
  isVideoImage,
} = useImageViewerThumbnails({
  images: toRef(props, 'images'),
  currentIndex: toRef(props, 'currentIndex'),
  thumbnailsRef,
  resolveUrl: props.resolveUrl,
})

const isCurrentVideo = computed(() => isVideoImage(currentImage.value))

const {
  selectedQuality,
  qualityItems,
  onImageLoad,
  onImageError,
  isMetadataPanelOpen,
  hasMetadata,
  closeMetadataPanel,
  isDownloading,
  downloadCurrentImage,
} = useImageViewerUi({
  currentImage,
  containerRef,
  thumbnailsRef,
  qualityModel: toRef(props, 'quality'),
  qualityLabels: props.qualityLabels,
  resolveUrl: props.resolveUrl,
  onQualityChange: val => emit('update:quality', val),
})

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

const { idle: isIdle } = useIdle(3000, {
  events: ['mousemove', 'mousedown', 'resize', 'touchstart', 'wheel'],
})

const areControlsVisible = computed(() => {
  if (isMetadataPanelOpen.value || isCurrentVideo.value)
    return true
  if (isDragging.value || isZoomed.value)
    return true
  return !isIdle.value
})

const {
  containerStyle,
  currentImageStyle,
  adjacentImageStyle,
  handleTouchStart: handleSwipeTouchStart,
  handleTouchMove: handleSwipeTouchMove,
  handleTouchEnd: handleSwipeTouchEnd,
} = useImageViewerSwipe({
  onNext: next,
  onPrev: prev,
  images: toRef(props, 'images'),
  currentIndex: toRef(props, 'currentIndex'),
  isZoomed,
  threshold: 80,
  velocity: 0.3,
  baseTransform: computed(() => imageStyle.value.transform),
  hasNextPage: toRef(props, 'hasNextPage'),
  hasPrevPage: toRef(props, 'hasPrevPage'),
  preferredQuality: selectedQuality,
})

function handleTouchStartCombined(event: TouchEvent) {
  if (!props.enableTouch || isCurrentVideo.value)
    return
  handleSwipeTouchStart(event)
  handleTouchStart(event)
}

function handleTouchMoveCombined(event: TouchEvent) {
  if (!props.enableTouch || isCurrentVideo.value)
    return
  handleSwipeTouchMove(event)
  handleTouchMove(event)
}

function handleTouchEndCombined(event: TouchEvent) {
  if (!props.enableTouch || isCurrentVideo.value)
    return
  handleSwipeTouchEnd(event)
  handleTouchEnd(event)
}

const visibleIndices = computed(() => {
  const indices = []
  const len = props.images.length
  for (let i = props.currentIndex - 2; i <= props.currentIndex + 2; i++) {
    if (i >= 0 && i < len)
      indices.push(i)
  }
  return indices
})

interface ImageLoadState {
  identity: string
  url: string
  loaded: boolean
  error: boolean
  loader: boolean
  preview?: string
  previewLoaded?: boolean
  previous?: string
  attempt: number
}
const imageLoadStates = reactive<Record<number, ImageLoadState>>({})
const imageElements = new Map<number, HTMLImageElement>()
const loaderTimeouts = new Map<number, ReturnType<typeof setTimeout>>()

function clearImageLoaderTimeout(index: number) {
  const timer = loaderTimeouts.get(index)
  if (timer) {
    clearTimeout(timer)
    loaderTimeouts.delete(index)
  }
}

function getImageUrl(image: ImageViewerImage, quality: ImageQuality): string {
  if (!image)
    return ''
  const { variants, url } = image
  let rawUrl = ''

  if (variants && variants[quality]) {
    rawUrl = variants[quality]!
  }
  else if (quality === 'original' && url) {
    rawUrl = url
  }
  else if (variants) {
    const firstVariantUrl = Object.entries(variants).find(([k, v]) => k !== 'thumbhash' && !!v)?.[1]
    rawUrl = variants.large || variants.medium || variants.small || firstVariantUrl || url || ''
  }
  else {
    rawUrl = url || ''
  }

  return props.resolveUrl ? props.resolveUrl(rawUrl) : rawUrl
}

function handleImageLoad(index: number, event: Event) {
  const state = imageLoadStates[index]
  const target = event.target as HTMLImageElement
  if (!state || imageElements.get(index) !== target || target.getAttribute('src') !== state.url)
    return
  state.loaded = true
  state.error = false
  state.loader = false
  clearImageLoaderTimeout(index)

  if (index === props.currentIndex) {
    onImageLoad()
    naturalSize.width = target.naturalWidth
    naturalSize.height = target.naturalHeight
    if (currentImage.value)
      emit('imageLoad', currentImage.value)
  }
}

function hasPreview(index: number) {
  const state = imageLoadStates[index]
  return !!(state?.previous || state?.previewLoaded || getPlaceholderUrl(props.images[index]))
}

function handlePreviewLoad(index: number, event: Event) {
  const state = imageLoadStates[index]
  if (state && (event.target as HTMLImageElement).getAttribute('src') === (state.previous || state.preview))
    state.previewLoaded = true
}

function retryImage(index: number) {
  const state = imageLoadStates[index]
  if (!state)
    return
  state.error = false
  state.loaded = false
  state.attempt++
}

function handleVideoLoadedMetadata(index: number, event: Event) {
  const state = imageLoadStates[index]
  if (!state)
    return
  state.loaded = true
  state.error = false
  state.loader = false
  clearImageLoaderTimeout(index)

  if (index === props.currentIndex) {
    onImageLoad()
    const target = event.target as HTMLVideoElement
    naturalSize.width = target.videoWidth
    naturalSize.height = target.videoHeight
    if (currentImage.value)
      emit('imageLoad', currentImage.value)
  }
}

function setVideoRef(el: unknown) {
  videoRef.value = el instanceof HTMLVideoElement ? el : null
}

function pauseVideo() {
  videoRef.value?.pause()
}

function retryVideo() {
  const state = imageLoadStates[props.currentIndex]
  if (state) {
    state.error = false
    state.loaded = false
    state.loader = true
  }
  videoRef.value?.load()
}

function handleImageError(index: number, event: Event) {
  const state = imageLoadStates[index]
  if (!state || (!isVideoImage(props.images[index]) && (imageElements.get(index) !== event.target || (event.target as HTMLImageElement).getAttribute('src') !== state.url)))
    return
  state.error = true
  state.loaded = false
  state.loader = false
  clearImageLoaderTimeout(index)

  if (index === props.currentIndex) {
    onImageError()
    emit('imageError', event)
  }
}

function setRef(el: unknown, index: number) {
  if (el instanceof HTMLImageElement)
    imageElements.set(index, el)
  else
    imageElements.delete(index)
  if (index === props.currentIndex) {
    imageRef.value = el as HTMLImageElement
    if (!imageLoadStates[index]?.loaded && imageRef.value?.complete && imageRef.value.naturalWidth > 0)
      handleImageLoad(index, { target: imageRef.value } as unknown as Event)
  }
}

// Track the actual request, including quality, list replacement and resolved offline URLs.
watch(() => visibleIndices.value.map((index) => {
  const image = props.images[index]
  return {
    index,
    identity: JSON.stringify([image.url, image.variants]),
    url: getImageUrl(image, index === props.currentIndex ? selectedQuality.value : 'large'),
    preview: image.variants?.small ? getImageUrl(image, 'small') : undefined,
  }
}), (requests) => {
  const visible = new Set(requests.map(request => request.index))
  for (const key of Object.keys(imageLoadStates)) {
    const index = Number(key)
    if (!visible.has(index)) {
      clearImageLoaderTimeout(index)
      delete imageLoadStates[index]
      imageElements.delete(index)
    }
  }
  for (const request of requests) {
    const old = imageLoadStates[request.index]
    if (old?.identity === request.identity && old.url === request.url)
      continue
    clearImageLoaderTimeout(request.index)
    const sameImage = old?.identity === request.identity
    const state: ImageLoadState = {
      ...request,
      loaded: false,
      error: false,
      loader: false,
      previous: sameImage ? (old.loaded ? old.url : old.previous) : undefined,
      previewLoaded: sameImage && old.preview === request.preview ? old.previewLoaded : false,
      attempt: 0,
    }
    imageLoadStates[request.index] = state
    loaderTimeouts.set(request.index, setTimeout(() => {
      if (toRaw(imageLoadStates[request.index]) === state && !state.loaded && !state.error)
        imageLoadStates[request.index].loader = true
      loaderTimeouts.delete(request.index)
    }, 500))
  }
  // Cached images can complete before Vue attaches a load listener.
  nextTick(() => {
    const image = imageRef.value
    if (image?.complete && image.naturalWidth > 0)
      handleImageLoad(props.currentIndex, { target: image } as unknown as Event)
  })
}, { immediate: true })

const currentImageMeta = computed((): IImageViewerImageMeta | null => {
  return toRaw(props.images[props.currentIndex]?.meta) ?? null
})

async function handleShowMetadata() {
  const image = currentImage.value
  if (!image)
    return

  const hasFullMetadata = image.meta && (image.meta.camera || image.meta.settings)
  if (hasFullMetadata) {
    isMetadataPanelOpen.value = true
    return
  }

  if (props.fetchMetadata) {
    isMetadataLoading.value = true
    try {
      const fullMeta = await props.fetchMetadata(image)
      if (fullMeta) {
        if (!image.meta)
          image.meta = {}
        Object.assign(image.meta, fullMeta)
      }
      isMetadataPanelOpen.value = true
    }
    catch (e) {
      console.error('[ImageViewer] Failed to load metadata:', e)
      if (image.meta)
        isMetadataPanelOpen.value = true
    }
    finally {
      isMetadataLoading.value = false
    }
  }
  else {
    emit('fetchMetadata', image)
    if (image.meta) {
      isMetadataPanelOpen.value = true
    }
  }
}

function close() {
  pauseVideo()
  emit('update:visible', false)
  emit('close')
}

function next() {
  if (props.currentIndex === props.images.length - 1 && props.hasNextPage) {
    paginationPromptDirection.value = 'next'
    return
  }
  if (!hasMultipleImages.value)
    return
  emit('update:currentIndex', (props.currentIndex + 1) % props.images.length)
}

function prev() {
  if (props.currentIndex === 0 && props.hasPrevPage) {
    paginationPromptDirection.value = 'prev'
    return
  }
  if (!hasMultipleImages.value)
    return
  emit('update:currentIndex', (props.currentIndex - 1 + props.images.length) % props.images.length)
}

function goToIndex(index: number) {
  if (index >= 0 && index < props.images.length)
    emit('update:currentIndex', index)
}

watch(() => [props.currentIndex, props.visible, currentImage.value?.url], pauseVideo, { flush: 'sync' })

watch(() => props.currentIndex, (index) => {
  resetTransform(false)
  closeMetadataPanel()
  closePaginationPrompt()
  scrollThumbnailIntoView(index, 'smooth')
})

watch(selectedQuality, () => {
  resetTransform(false)
})

watch(areControlsVisible, (visible) => {
  if (visible)
    scrollThumbnailIntoView(props.currentIndex, 'auto')
})

watch(() => props.visible, (isVisible) => {
  if (typeof document === 'undefined')
    return
  if (isVisible) {
    document.body.style.overflow = 'hidden'
    isUiVisible.value = true
    scrollThumbnailIntoView(props.currentIndex, 'auto')
  }
  else {
    document.body.style.overflow = ''
    resetTransform(false)
    closeMetadataPanel()
  }
})

function handleOverlayClick(event: MouseEvent) {
  if (
    !props.closeOnOverlayClick
    || !props.visible
    || isDragging.value
    || transform.scale > props.minZoom
    || isMetadataPanelOpen.value
  ) {
    return
  }

  const target = event.target as HTMLElement | null
  if (!target)
    return

  if (
    target.closest('.viewer-image')
    || target.closest('.viewer-header')
    || target.closest('.viewer-footer')
    || target.closest('.thumbnails-container')
    || target.closest('.nav-zone')
    || target.closest('.pagination-prompt-card')
    || target.closest('.image-metadata-panel')
    || target.closest('.placeholder-wrapper')
    || target.closest('button')
    || target.closest('a')
    || target.closest('input')
    || target.closest('textarea')
    || target.closest('select')
  ) {
    return
  }

  close()
}

useEventListener(typeof document !== 'undefined' ? document : null, 'keydown', (e: KeyboardEvent) => {
  if (!props.visible || !props.enableKeyboard)
    return

  const target = e.target as HTMLElement
  const isEditing = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)

  if (isEditing)
    return

  if (e.key !== 'Escape' && (target.closest('video') || target.closest('button') || target.closest('a')))
    return

  if (isCurrentVideo.value && [' ', 'k', 'ArrowLeft', 'ArrowRight', 'm'].includes(e.key)) {
    const video = videoRef.value
    if (!video || e.repeat)
      return
    e.preventDefault()
    if (e.key === ' ' || e.key === 'k') {
      if (video.paused)
        void video.play().catch(() => {})
      else
        video.pause()
    }
    else if (e.key === 'm') {
      video.muted = !video.muted
    }
    else if (Number.isFinite(video.duration)) {
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + (e.key === 'ArrowRight' ? 5 : -5)))
    }
    return
  }

  switch (e.key) {
    case 'Escape':
      e.preventDefault()
      e.stopPropagation()
      if (isMetadataPanelOpen.value)
        closeMetadataPanel()
      else
        close()
      break
    case 'ArrowRight':
    case ' ':
      e.preventDefault()
      next()
      break
    case 'ArrowLeft':
      e.preventDefault()
      prev()
      break
    case 'Home':
      e.preventDefault()
      goToIndex(0)
      break
    case 'End':
      e.preventDefault()
      goToIndex(props.images.length - 1)
      break
  }
})

onUnmounted(() => {
  pauseVideo()
  if (typeof document !== 'undefined')
    document.body.style.overflow = ''
  loaderTimeouts.forEach(timer => clearTimeout(timer))
  loaderTimeouts.clear()
  imageElements.clear()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="viewer-fade">
      <div
        v-if="visible"
        class="image-viewer-overlay"
        :class="{ 'is-video-viewer': isCurrentVideo, 'has-thumbnails': enableThumbnails && hasMultipleImages }"
        @click="handleOverlayClick"
        @wheel="e => !isCurrentVideo && handleWheel(e)"
        @touchstart="handleTouchStartCombined"
        @touchmove="handleTouchMoveCombined"
        @touchend="handleTouchEndCombined"
        @touchcancel="handleTouchEndCombined"
      >
        <div class="viewer-wrapper">
          <Transition name="controls-fade">
            <div v-show="areControlsVisible" class="viewer-header">
              <div class="header-content-wrapper">
                <div class="header-left">
                  <div v-if="showCounter && hasMultipleImages && isUiVisible" class="viewer-counter">
                    {{ currentIndex + 1 }} / {{ images.length }}
                  </div>
                </div>
                <div class="header-center">
                  <div v-if="transform.scale > minZoom && isUiVisible" class="scale-indicator">
                    {{ Math.round(transform.scale * 100) }}%
                  </div>
                </div>
              </div>
              <div class="header-right">
                <KitViewerControls
                  v-model:is-ui-visible="isUiVisible"
                  v-model:quality="selectedQuality"
                  :quality-items="qualityItems"
                  :can-zoom-in="canZoomIn"
                  :can-zoom-out="canZoomOut"
                  :is-zoomed="isZoomed"
                  :has-metadata="hasMetadata"
                  :is-metadata-loading="isMetadataLoading"
                  :show-quality-selector="showQualitySelector && !isCurrentVideo"
                  :is-video="isCurrentVideo"
                  :show-info-button="showInfoButton"
                  :is-downloading="isDownloading"
                  @reset-transform="() => resetTransform(true)"
                  @show-metadata="handleShowMetadata"
                  @close="close"
                  @download="downloadCurrentImage"
                />
              </div>
            </div>
          </Transition>

          <Transition name="fade-scale">
            <div v-if="paginationPromptDirection" class="pagination-prompt-overlay" @click.self="closePaginationPrompt">
              <div class="pagination-prompt-card">
                <Icon
                  :icon="paginationPromptDirection === 'next' ? 'mdi:arrow-right-circle' : 'mdi:arrow-left-circle'"
                  class="prompt-icon"
                />
                <h3>
                  {{ paginationPromptDirection === 'next' ? 'Следующая страница' : 'Предыдущая страница' }}
                </h3>
                <p>
                  Вы досмотрели текущую страницу до конца.
                  <br>
                  Загрузить {{ paginationPromptDirection === 'next' ? 'следующие' : 'предыдущие' }} медиафайлы?
                </p>
                <div class="prompt-actions">
                  <button class="prompt-btn btn-cancel" @click="closePaginationPrompt">
                    Остаться здесь
                  </button>
                  <button class="prompt-btn btn-confirm" @click="confirmPagination">
                    Загрузить
                  </button>
                </div>
              </div>
            </div>
          </Transition>

          <Transition name="viewer-fade">
            <div v-if="isFetching" class="viewer-fetching-overlay">
              <Icon icon="mdi:loading" class="spinning viewer-fetching-icon" />
            </div>
          </Transition>

          <div class="viewer-content">
            <div ref="containerRef" class="image-container">
              <div class="swipe-container" :style="containerStyle">
                <div
                  v-for="i in visibleIndices"
                  :key="i"
                  class="slide-wrapper"
                  :class="{ 'is-ui-hidden': !isUiVisible }"
                  :style="{ transform: `translateX(${i * 100}%)` }"
                >
                  <div class="current-image-wrapper">
                    <div
                      class="image-slot"
                      :class="{ 'has-error': imageLoadStates[i]?.error && !hasPreview(i), 'video-slot': isVideoImage(images[i]), 'photo-slot': !isVideoImage(images[i]) }"
                    >
                      <div
                        v-if="!isVideoImage(images[i]) && !imageLoadStates[i]?.loaded && !imageLoadStates[i]?.error && !hasPreview(i)"
                        class="viewer-empty-placeholder"
                        role="status"
                        aria-label="Загрузка изображения"
                      >
                        <Icon icon="mdi:image-outline" width="32" height="32" />
                      </div>
                      <img
                        v-if="!isVideoImage(images[i]) && getPlaceholderUrl(images[i])"
                        :src="getPlaceholderUrl(images[i]) || undefined"
                        class="viewer-thumbhash-placeholder"
                        alt=""
                        aria-hidden="true"
                      >
                      <img
                        v-if="!isVideoImage(images[i]) && (imageLoadStates[i]?.previous || imageLoadStates[i]?.preview)"
                        :key="imageLoadStates[i]?.previous || imageLoadStates[i]?.preview"
                        :src="imageLoadStates[i]?.previous || imageLoadStates[i]?.preview"
                        class="viewer-preview"
                        :class="{ loaded: imageLoadStates[i]?.previous || imageLoadStates[i]?.previewLoaded }"
                        :style="i === currentIndex ? [imageStyle, currentImageStyle] : adjacentImageStyle"
                        alt=""
                        aria-hidden="true"
                        :loading="i === currentIndex ? 'eager' : 'lazy'"
                        @load="e => handlePreviewLoad(i, e)"
                      >
                      <button
                        v-if="!isVideoImage(images[i]) && imageLoadStates[i]?.error && hasPreview(i)"
                        class="preview-retry"
                        @click.stop="retryImage(i)"
                      >
                        Не удалось загрузить полное качество. Повторить
                      </button>
                      <KitVideoPlayer
                        v-if="isVideoImage(images[i]) && i === currentIndex"
                        v-show="!imageLoadStates[i]?.error"
                        :key="images[i].url"
                        :src="getImageUrl(images[i], 'original')"
                        :label="images[i]?.alt || `Видео ${i + 1}`"
                        @ready="setVideoRef"
                        @loadedmetadata="e => handleVideoLoadedMetadata(i, e)"
                        @error="e => handleImageError(i, e)"
                      />
                      <img
                        v-else-if="!isVideoImage(images[i])"
                        :key="`${imageLoadStates[i]?.url}:${imageLoadStates[i]?.attempt}`"
                        :ref="el => setRef(el, i)"
                        :src="getImageUrl(images[i], i === currentIndex ? selectedQuality : 'large')"
                        :alt="images[i]?.alt || `Image ${i + 1}`"
                        :loading="i === currentIndex ? 'eager' : 'lazy'"
                        decoding="async"
                        :fetchpriority="i === currentIndex ? 'high' : 'low'"
                        class="viewer-image"
                        :class="{
                          'loaded': imageLoadStates[i]?.loaded,
                          'has-error': imageLoadStates[i]?.error,
                          'is-ui-hidden': !isUiVisible,
                          'fill-slot': !!(images[i]?.meta?.width && images[i]?.meta?.height),
                        }"
                        :style="i === currentIndex ? [imageStyle, currentImageStyle] : adjacentImageStyle"
                        @load="e => handleImageLoad(i, e)"
                        @error="e => handleImageError(i, e)"
                        @mousedown="e => i === currentIndex && handleMouseDown(e)"
                        @dblclick="e => i === currentIndex && handleDoubleClick(e)"
                        @dragstart.prevent
                      >

                      <Transition name="loader-fade">
                        <div
                          v-if="isVideoImage(images[i]) ? ((!imageLoadStates[i]?.loaded && imageLoadStates[i]?.loader) || imageLoadStates[i]?.error) : (imageLoadStates[i]?.error && !hasPreview(i))"
                          class="placeholder-wrapper"
                          :class="{ 'is-error': imageLoadStates[i]?.error }"
                        >
                          <div class="placeholder-content">
                            <div v-if="imageLoadStates[i]?.error" class="image-error">
                              <div class="error-icon-circle">
                                <Icon icon="mdi:image-broken-variant" class="error-icon" />
                              </div>
                              <span class="error-title">Не удалось загрузить {{ isVideoImage(images[i]) ? 'видео' : 'изображение' }}</span>
                              <span class="error-subtitle">{{ isVideoImage(images[i]) ? 'Проверьте сеть. Формат или кодек видео может не поддерживаться браузером.' : 'Проверьте подключение к сети или корректность ссылки' }}</span>
                              <button class="retry-video" @click.stop="isVideoImage(images[i]) ? retryVideo() : retryImage(i)">
                                Повторить
                              </button>
                            </div>
                            <div v-else class="shimmer-container">
                              <div class="shimmer-wave" />
                              <Icon width="48" height="48" icon="mdi:loading" class="spinning shimmer-icon" />
                            </div>
                          </div>
                        </div>
                      </Transition>
                    </div>
                  </div>
                </div>
              </div>

              <button
                v-if="(hasMultipleImages || hasPrevPage) && transform.scale <= minZoom"
                class="nav-zone prev-zone"
                aria-label="Предыдущий файл"
                @click="prev"
              >
                <Icon v-if="isCurrentVideo" icon="mdi:chevron-left" />
              </button>
              <button
                v-if="(hasMultipleImages || hasNextPage) && transform.scale <= minZoom"
                class="nav-zone next-zone"
                aria-label="Следующий файл"
                @click="next"
              >
                <Icon v-if="isCurrentVideo" icon="mdi:chevron-right" />
              </button>
            </div>
          </div>

          <template v-if="$slots.footer">
            <Transition name="controls-fade">
              <div v-show="areControlsVisible && isUiVisible" class="viewer-footer">
                <slot
                  name="footer"
                  :image="currentImage"
                  :index="currentIndex"
                  :transform="transform"
                />
              </div>
            </Transition>
          </template>

          <template v-if="enableThumbnails && hasMultipleImages">
            <Transition name="controls-fade">
              <div v-show="areControlsVisible && isUiVisible" class="thumbnails-container">
                <div
                  ref="thumbnailsRef"
                  class="thumbnails-wrapper"
                  @scroll.passive="onThumbnailsScroll"
                >
                  <TransitionGroup
                    tag="div"
                    name="thumbnail-fade"
                    class="thumbnails-track"
                    :style="{
                      width: `${totalThumbnailsWidth}px`,
                      height: `${thumbnailSize}px`,
                    }"
                  >
                    <div
                      v-for="item in visibleThumbnails"
                      :key="`thumb-${item.index}`"
                      :style="{
                        position: 'absolute',
                        left: `${item.offset}px`,
                        top: 0,
                        width: `${thumbnailSize}px`,
                        height: `${thumbnailSize}px`,
                        zIndex: item.index === currentIndex ? 2 : 1,
                      }"
                    >
                      <button
                        class="thumbnail"
                        :aria-label="`К ${isVideoImage(item.image) ? 'видео' : 'изображению'} ${item.index + 1}`"
                        :class="{
                          'active': item.index === currentIndex,
                          'is-broken': failedThumbnails.has(item.index),
                          'is-loaded': loadedThumbnails.has(item.index),
                          'is-video-thumb': isVideoImage(item.image),
                        }"
                        @click.stop="goToIndex(item.index)"
                      >
                        <template v-if="!failedThumbnails.has(item.index)">
                          <video
                            v-if="isVideoImage(item.image) && resolveThumbnailUrl(item.image) === getImageUrl(item.image, 'original')"
                            :src="getImageUrl(item.image, 'original')"
                            muted
                            playsinline
                            preload="metadata"
                            :class="{ loaded: loadedThumbnails.has(item.index) }"
                            @loadedmetadata="loadedThumbnails.add(item.index)"
                            @error="failedThumbnails.add(item.index)"
                          />
                          <img
                            v-else
                            :src="resolveThumbnailUrl(item.image)"
                            :alt="item.image.alt || `Thumbnail ${item.index + 1}`"
                            loading="lazy"
                            :class="{ loaded: loadedThumbnails.has(item.index) }"
                            @load="loadedThumbnails.add(item.index)"
                            @error="failedThumbnails.add(item.index)"
                          >
                          <div v-if="isVideoImage(item.image)" class="thumb-video-badge">
                            <Icon icon="mdi:play" />
                          </div>
                          <img
                            v-if="!loadedThumbnails.has(item.index) && getPlaceholderUrl(item.image)"
                            :src="getPlaceholderUrl(item.image) || undefined"
                            class="thumbnail-thumbhash-placeholder loaded"
                            alt=""
                            aria-hidden="true"
                          >
                          <div v-else-if="!loadedThumbnails.has(item.index)" class="thumb-skeleton">
                            <div class="thumb-skeleton-wave" />
                          </div>
                        </template>
                        <div v-else class="thumb-broken-placeholder">
                          <Icon icon="mdi:image-off-outline" />
                        </div>
                      </button>
                    </div>
                  </TransitionGroup>
                </div>
              </div>
            </Transition>
          </template>
        </div>

        <ImageMetadataPanel
          v-if="currentImageMeta"
          :meta="currentImageMeta"
          :visible="isMetadataPanelOpen"
          :map-component="mapComponent"
          @close="closeMetadataPanel"
        >
          <template #map="mapScope">
            <slot name="map" v-bind="mapScope" />
          </template>
        </ImageMetadataPanel>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.image-viewer-overlay {
  position: fixed;
  inset: 0;
  background: var(--viewer-overlay-bg, rgba(0, 0, 0, 0.95));
  z-index: var(--z-image-viewer, 1002);
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
  padding: calc(20px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px))) 20px 20px;
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
  left: calc(20px + var(--safe-area-inset-left, env(safe-area-inset-left, 0px)));
  top: calc(20px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)));
}
.header-center {
  position: absolute;
  left: 50%;
  top: calc(20px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)));
  transform: translateX(-50%);
}
.header-right {
  position: absolute;
  right: calc(20px + var(--safe-area-inset-right, env(safe-area-inset-right, 0px)));
  top: calc(20px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)));
}

.viewer-counter,
.scale-indicator {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  color: #fff;
  padding: 8px 16px;
  border-radius: var(--r-full, 9999px);
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

.viewer-thumbhash-placeholder,
.thumbnail-thumbhash-placeholder {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.viewer-thumbhash-placeholder {
  object-fit: contain;
}

.viewer-empty-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.3);
  pointer-events: none;
}

.viewer-preview {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0;
  pointer-events: none;

  &.loaded {
    opacity: 1;
  }
}

.preview-retry {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 11;
  max-width: 90%;
  padding: 8px 12px;
  border: 1px solid #777;
  border-radius: 8px;
  background: #222;
  color: #fff;
  line-height: 1.4;
  cursor: pointer;
}

.thumbnail-thumbhash-placeholder {
  object-fit: cover;
}

.photo-slot {
  width: 100%;
  height: 100%;
}

.image-slot {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  line-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  &.has-error {
    width: 440px;
    height: 280px;
    max-width: 90vw;
    max-height: 60vh;
  }
}

.placeholder-wrapper {
  position: absolute;
  inset: 0;
  border-radius: var(--r-2xs, 4px);
  overflow: hidden;
  backdrop-filter: blur(12px);
  background: rgba(0, 0, 0, 0.3);
  z-index: 10;
  pointer-events: none;

  &.is-error {
    background: rgba(22, 22, 24, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
    border-radius: 16px;
    pointer-events: auto;
    position: relative;
    width: 100%;
    height: 100%;
  }
}

.placeholder-content {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  color: #fff;
  width: 100%;
  user-select: none;
  padding: 16px;

  .error-icon-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 6px;
  }

  .error-icon {
    font-size: 32px;
    color: #ef4444;
  }

  .error-title {
    font-size: 1rem;
    font-weight: 600;
    color: #f1f5f9;
    line-height: 1.3;
  }

  .error-subtitle {
    font-size: 0.8rem;
    color: #94a3b8;
    line-height: 1.4;
    max-width: 320px;
  }
}

.shimmer-container {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-2xs, 4px);
  overflow: hidden;
}

.shimmer-wave {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.08) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.shimmer-icon {
  color: rgba(255, 255, 255, 0.7);
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.8));
  animation: spin 1s linear infinite;
}

.viewer-image {
  display: block;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  cursor: grab;
  transform-origin: center;
  transition:
    opacity 0.4s ease,
    border-radius 0.3s ease;
  opacity: 0;
  border-radius: var(--r-2xs, 4px);

  &.fill-slot {
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
  }

  &.is-ui-hidden {
    border-radius: 0;
  }

  &.loaded {
    opacity: 1;
  }

  &.has-error {
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }

  &:active {
    cursor: grabbing;
  }

  &.viewer-video {
    cursor: default;
    outline: none;
    max-width: 90vw;
    max-height: 80vh;
    z-index: 5;
    pointer-events: auto;

    &:active {
      cursor: default;
    }
  }
}

.nav-zone {
  background: transparent;
  border: 0;
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

.pagination-prompt-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
}

.pagination-prompt-card {
  background: rgba(20, 20, 20, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 32px;
  border-radius: var(--r-xl, 16px);
  text-align: center;
  max-width: 400px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;

  .prompt-icon {
    font-size: 48px;
    color: var(--fg-accent-color, #3b82f6);
    margin-bottom: 8px;
  }

  h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  p {
    margin: 0;
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.5;
  }

  .prompt-actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
    width: 100%;

    .prompt-btn {
      flex: 1;
      padding: 12px 16px;
      border-radius: var(--r-full, 9999px);
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
      outline: none;

      &.btn-cancel {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;

        &:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      }

      &.btn-confirm {
        background: #fff;
        color: #000;

        &:hover {
          box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
        }
      }
    }
  }
}

.viewer-fetching-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  z-index: 60;
  pointer-events: none;

  .viewer-fetching-icon {
    font-size: 48px;
    color: white;
  }
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
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

  @media (max-width: 599px) {
    padding: 8px;
  }
}

.thumbnails-container {
  bottom: 20px;
  display: flex;
  justify-content: center;
  width: 100%;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.thumbnails-wrapper {
  --thumb-size: 56px;
  --thumb-gap: 10px;
  display: flex;
  padding: 10px calc(50% - (var(--thumb-size) / 2));
  scroll-padding: 0 calc(50% - (var(--thumb-size) / 2));
  background: transparent;
  border: none;

  overflow-x: auto;
  overflow-y: hidden;
  max-width: 100%;
  mask-image: linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%);

  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.thumbnails-track {
  position: relative;
  flex-shrink: 0;
}

.thumbnail-fade-enter-active,
.thumbnail-fade-leave-active {
  transition: opacity 0.2s ease;
}

.thumbnail-fade-enter-from,
.thumbnail-fade-leave-to {
  opacity: 0;
}

.thumbnail-fade-leave-active {
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .thumbnail-fade-enter-active,
  .thumbnail-fade-leave-active {
    transition: none;
  }
}

.thumbnail {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: var(--r-s, 6px);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  border: 2px solid transparent;
  opacity: 0.65;
  background: #18181b;
  padding: 0;

  &:hover {
    opacity: 0.95;
  }

  &.active {
    opacity: 1;
    border-color: var(--fg-accent-color, #3b82f6);
    transform: scale(1.12);
    z-index: 2;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
  }

  img,
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    opacity: 0;
    transition: opacity 0.3s ease;

    &.loaded {
      opacity: 1;
    }
  }

  .thumb-video-badge {
    position: absolute;
    bottom: 2px;
    right: 2px;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    pointer-events: none;
    z-index: 2;
  }

  .thumb-skeleton {
    position: absolute;
    inset: 0;
    background: #27272a;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;

    .thumb-skeleton-wave {
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.12) 50%, transparent 100%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite linear;
    }
  }

  .thumb-broken-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(239, 68, 68, 0.12);
    color: #ef4444;
    font-size: 20px;
  }
}

.swipe-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  will-change: transform;
}

.slide-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 70px 0;
  box-sizing: border-box;
  transition: padding 0.3s ease;

  &.is-ui-hidden {
    padding: 0;
  }
}

.current-image-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
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
.viewer-header.controls-fade-leave-to {
  transform: translateY(-10px);
}
.thumbnails-container.controls-fade-leave-to {
  transform: translateY(10px);
}
.viewer-footer.controls-fade-leave-to {
  transform: translateY(10px);
}

.loader-fade-enter-active {
  transition: opacity 0.2s ease-in;
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

@media (max-width: 959px) {
  .viewer-header {
    display: flex;
    justify-content: flex-end;
    top: 0;
    left: 0;
    right: 0;
    padding: calc(16px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px))) 0 16px;
  }
  .header-right {
    display: flex;
    justify-content: flex-end;
    top: calc(16px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)));
    right: calc(8px + var(--safe-area-inset-right, env(safe-area-inset-right, 0px)));
  }
  .header-left {
    justify-content: flex-start;
    top: calc(16px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)));
    left: calc(8px + var(--safe-area-inset-left, env(safe-area-inset-left, 0px)));
  }
  .header-center {
    top: calc(60px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)));
    left: 50%;
    transform: translateX(-50%);
    opacity: 0.5;
  }
  .viewer-content {
    padding: 0;
  }
  .current-image-wrapper {
    padding: 4px;
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
    bottom: calc(16px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
  }
  .thumbnails-wrapper {
    --thumb-size: 44px;
  }
}

@media (max-width: 599px) {
  .viewer-header {
    display: block;
    background: transparent;
  }
  .header-left {
    justify-content: flex-start;
  }
}
</style>

<style scoped lang="scss">
.is-video-viewer {
  .slide-wrapper {
    padding: 0;
  }
  .viewer-content {
    min-height: 0;
  }
  .current-image-wrapper {
    box-sizing: border-box;
    padding: 80px 64px 32px;
  }
  &.has-thumbnails .current-image-wrapper {
    padding-bottom: calc(112px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
  }
  .video-slot {
    width: 100%;
    height: 100%;
  }
  .viewer-video {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    background: transparent;
    opacity: 1;
    touch-action: auto;
  }
  .nav-zone {
    top: 50%;
    bottom: auto;
    width: 44px;
    height: 44px;
    transform: translateY(-50%);
    border-radius: 50%;
    background: rgba(40, 40, 40, 0.85);
    color: white;
    font-size: 28px;
    display: grid;
    place-items: center;
  }
  .prev-zone {
    left: 8px;
  }
  .next-zone {
    right: 8px;
  }
}
.retry-video {
  margin-top: 12px;
  padding: 10px 16px;
  border: 1px solid #777;
  border-radius: 8px;
  background: #333;
  color: white;
  cursor: pointer;
}
@media (max-width: 599px) {
  .is-video-viewer .current-image-wrapper {
    padding: 76px 8px 72px;
  }
  .is-video-viewer .nav-zone {
    top: auto;
    bottom: calc(12px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
    transform: none;
  }
  .is-video-viewer.has-thumbnails .nav-zone {
    bottom: calc(76px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
  }
  .is-video-viewer.has-thumbnails .current-image-wrapper {
    padding-bottom: calc(132px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
  }
}
</style>
