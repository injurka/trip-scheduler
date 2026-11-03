<script setup lang="ts">
import { AspectRatio } from 'reka-ui'
import { computed, nextTick, onBeforeUnmount, readonly, ref, watch } from 'vue'
import smthWrongImage from '~/assets/images/smth-wrong.png'
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
import { getOfflineImageUrl } from '~/shared/lib/offline-cache'
import { getThumbHashAverageColor, getThumbHashDataUrl } from '~/shared/lib/thumbhash'
import { resolveApiUrl } from '~/shared/lib/url'

interface Props {
  /**
   * Объект с путями к различным версиям изображения.
   * @example { small: 'path/to/img-sm.webp', medium: 'path/to/img-md.webp' }
   */
  variants?: {
    small?: string
    medium?: string
    large?: string
    thumbhash?: string
  } | null
  /**
   * Компактный Base64 ThumbHash для мгновенного плавного плейсхолдера.
   */
  thumbhash?: string | null
  /**
   * URL оригинального изображения (используется как фоллбэк).
   */
  src?: string
  alt?: string
  aspectRatio?: number
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  loading?: 'lazy' | 'eager'
  /**
   * Таймаут в миллисекундах, после которого загрузка считается неудачной.
   * Установлено в 0 (отключено) по умолчанию, чтобы избежать ложных ошибок при медленном интернете.
   */
  loadTimeout?: number
}

const props = withDefaults(defineProps<Props>(), {
  variants: undefined,
  thumbhash: undefined,
  src: '',
  alt: '',
  aspectRatio: undefined,
  objectFit: 'cover',
  loading: 'lazy',
  loadTimeout: 0,
})

const isLoading = ref(true)
const hasError = ref(false)
const isAborted = ref(false)
const retryCount = ref(0)
const cachedSrc = ref<string | null>(null)
let cacheRequest = 0
const imageRef = ref<HTMLImageElement | null>(null)

defineExpose({
  isLoading: readonly(isLoading),
  hasError: readonly(hasError),
  retry: () => {
    if (props.src && hasError.value) {
      isLoading.value = true
      hasError.value = false
      isAborted.value = false
      retryCount.value++

      nextTick(() => {
        if (imageRef.value) {
          if (imageRef.value.complete && imageRef.value.naturalWidth > 0) {
            handleLoad()

            return
          }

          if (props.loading === 'eager') {
            setLoadTimeout()
          }
          else {
            setupIntersectionObserver()
          }
        }
      })
    }
  },
})

const loadTimeoutId = ref<ReturnType<typeof setTimeout> | undefined>()
const imageObserver = ref<IntersectionObserver | undefined>()

const resolvedVariants = computed(() => {
  if (!props.variants)
    return {}

  return {
    small: resolveApiUrl(props.variants.small),
    medium: resolveApiUrl(props.variants.medium),
    large: resolveApiUrl(props.variants.large),
  }
})
const resolvedSrc = computed(() => resolveApiUrl(props.src))
const imageSourceKey = computed(() => JSON.stringify([
  resolvedSrc.value,
  resolvedVariants.value.small,
  resolvedVariants.value.medium,
  resolvedVariants.value.large,
]))
const activeThumbhash = computed(() => props.thumbhash || props.variants?.thumbhash || null)
const thumbHashDataUrl = computed(() => getThumbHashDataUrl(activeThumbhash.value))
const thumbHashAvgColor = computed(() => getThumbHashAverageColor(activeThumbhash.value))
const imageStyle = computed(() => {
  const isLoaded = !isLoading.value && !hasError.value
  const hasThumbhash = Boolean(thumbHashDataUrl.value)

  return {
    objectFit: props.objectFit,
    opacity: isLoaded ? 1 : 0,
    filter: isLoaded || hasThumbhash ? 'blur(0)' : 'blur(10px)',
    transform: isLoaded || hasThumbhash ? 'scale(1)' : 'scale(1.1)',
  }
})

watch(imageSourceKey, () => {
  releaseCachedSrc()

  if (typeof navigator !== 'undefined' && !navigator.onLine)
    void restoreCachedImage()

  isLoading.value = true
  hasError.value = false
  isAborted.value = false
  retryCount.value = 0
  cleanupObserver()
  clearLoadTimeout()

  if (!props.src) {
    isLoading.value = false

    return
  }

  nextTick(() => {
    if (imageRef.value) {
      if (imageRef.value.complete && imageRef.value.naturalWidth > 0) {
        handleLoad()

        return
      }

      if (props.loading === 'eager') {
        setLoadTimeout()
      }
      else {
        setupIntersectionObserver()
      }
    }
  })
}, { immediate: true })

function releaseCachedSrc() {
  cacheRequest++

  if (cachedSrc.value)
    URL.revokeObjectURL(cachedSrc.value)

  cachedSrc.value = null
}
async function restoreCachedImage() {
  const request = ++cacheRequest

  for (const url of new Set([resolvedVariants.value.small, resolvedVariants.value.medium, resolvedVariants.value.large, resolvedSrc.value])) {
    if (!url)
      continue

    const blobUrl = await getOfflineImageUrl(url)

    if (request !== cacheRequest) {
      if (blobUrl)
        URL.revokeObjectURL(blobUrl)

      return false
    }

    if (blobUrl) {
      cachedSrc.value = blobUrl
      hasError.value = false
      isLoading.value = true

      return true
    }
  }

  return false
}
function handleLoad() {
  if (isAborted.value)
    return

  clearLoadTimeout()
  cleanupObserver()
  isLoading.value = false
  hasError.value = false
}
async function handleError() {
  if (isAborted.value)
    return

  if (!cachedSrc.value && await restoreCachedImage())
    return

  clearLoadTimeout()
  cleanupObserver()
  isLoading.value = false
  hasError.value = true
}
function handleTimeout() {
  clearLoadTimeout()
  isAborted.value = true
  isLoading.value = false
  hasError.value = true
}
function clearLoadTimeout() {
  if (loadTimeoutId.value) {
    clearTimeout(loadTimeoutId.value)
    loadTimeoutId.value = undefined
  }
}
function setLoadTimeout() {
  clearLoadTimeout()

  if (props.loadTimeout > 0) {
    loadTimeoutId.value = setTimeout(() => {
      if (isLoading.value) {
        handleTimeout()
      }
    }, props.loadTimeout)
  }
}
function setupIntersectionObserver() {
  if (typeof window === 'undefined' || !imageRef.value)
    return

  cleanupObserver()

  imageObserver.value = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        setLoadTimeout()
        cleanupObserver()
      }
    })
  }, { threshold: 0.1 })

  imageObserver.value.observe(imageRef.value)
}
function cleanupObserver() {
  if (imageObserver.value) {
    imageObserver.value.disconnect()
    imageObserver.value = undefined
  }
}

onBeforeUnmount(() => {
  releaseCachedSrc()
  clearLoadTimeout()
  cleanupObserver()
})
</script>

<template>
  <component
    :is="aspectRatio ? AspectRatio : 'div'"
    :ratio="aspectRatio"
    class="kit-image-wrapper"
  >
    <div class="kit-image-container">
      <transition name="faded">
        <div
          v-if="isLoading"
          class="placeholder-wrapper"
          :style="thumbHashAvgColor ? { backgroundColor: thumbHashAvgColor } : undefined"
        >
          <slot name="loader">
            <img
              v-if="thumbHashDataUrl"
              :src="thumbHashDataUrl"
              class="thumbhash-placeholder"
              :style="{ objectFit: props.objectFit }"
              alt=""
            >
            <KitSkeleton v-else class="skeleton-placeholder" />
          </slot>
        </div>
      </transition>

      <transition name="faded">
        <div v-if="hasError" class="placeholder-wrapper">
          <slot name="error">
            <div class="error-placeholder">
              <img :src="smthWrongImage" alt="Ошибка загрузки" class="error-image">
            </div>
          </slot>
        </div>
      </transition>

      <picture v-if="src && !isAborted" :key="`${imageSourceKey}:${retryCount}`">
        <source
          v-if="!cachedSrc && resolvedVariants.large"
          :srcset="resolvedVariants.large"
          media="(min-width: 1200px)"
        >
        <source
          v-if="!cachedSrc && resolvedVariants.medium"
          :srcset="resolvedVariants.medium"
          media="(min-width: 600px)"
        >
        <source
          v-if="!cachedSrc && resolvedVariants.small"
          :srcset="resolvedVariants.small"
        >

        <img
          ref="imageRef"
          :src="cachedSrc || resolvedVariants.small || resolvedSrc"
          class="image"
          :alt="alt"
          :loading="loading"
          decoding="async"
          :style="imageStyle"
          @load="handleLoad"
          @error="handleError"
        >
      </picture>
    </div>
  </component>
</template>

<style lang="scss">
.kit-image-wrapper {
  width: 100%;
  height: 100%;
  border-radius: inherit;
}

.kit-image-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
  background-color: var(--bg-tertiary-color);

  .placeholder-wrapper,
  .image,
  picture {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;

    .skeleton-placeholder {
      width: 100% !important;
      height: 100% !important;
    }

    .thumbhash-placeholder {
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
  }

  .image {
    transition:
      transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94),
      filter 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94),
      opacity 0.4s ease-out;
  }

  .error-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background-color: var(--bg-tertiary-color);
    border-radius: inherit;
  }

  .error-image {
    width: 50%;
    height: 50%;
    object-fit: contain;
    opacity: 0.5;
  }
}
</style>
