<script setup lang="ts">
import { AspectRatio } from 'reka-ui'
import { computed, nextTick, onBeforeUnmount, readonly, ref, watch } from 'vue'
import smthWrongImage from '~/assets/images/smth-wrong.png'
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
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
  } | null
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
   */
  loadTimeout?: number
}

const props = withDefaults(defineProps<Props>(), {
  variants: undefined,
  src: '',
  alt: '',
  aspectRatio: undefined,
  objectFit: 'cover',
  loading: 'lazy',
  loadTimeout: 10_000,
})

const isLoading = ref(true)
const hasError = ref(false)
const imageRef = ref<HTMLImageElement | null>(null)
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

const imageStyle = computed(() => {
  const isLoaded = !isLoading.value && !hasError.value
  return {
    objectFit: props.objectFit,
    opacity: isLoaded ? 1 : 0,
    filter: isLoaded ? 'blur(0)' : 'blur(10px)',
    transform: isLoaded ? 'scale(1)' : 'scale(1.1)',
  }
})

function handleLoad() {
  clearLoadTimeout()
  isLoading.value = false
  hasError.value = false
}

function handleError() {
  clearLoadTimeout()
  isLoading.value = false
  hasError.value = true
}

function clearLoadTimeout() {
  if (loadTimeoutId.value) {
    clearTimeout(loadTimeoutId.value)
    loadTimeoutId.value = undefined
  }
}

// Таймер теперь запускается только тогда, когда загрузка действительно должна начаться
function setLoadTimeout() {
  clearLoadTimeout()
  if (props.loadTimeout > 0) {
    loadTimeoutId.value = setTimeout(() => {
      // Если изображение все еще в состоянии загрузки после таймаута, считаем это ошибкой
      if (isLoading.value)
        handleError()
    }, props.loadTimeout)
  }
}

function setupIntersectionObserver() {
  if (typeof window === 'undefined' || !imageRef.value)
    return

  cleanupObserver()

  imageObserver.value = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // Когда изображение попадает в область видимости
        if (entry.isIntersecting) {
          // Запускаем таймер ожидания загрузки
          setLoadTimeout()
          // И отключаем наблюдатель, так как он больше не нужен
          cleanupObserver()
        }
      })
    },
    { threshold: 0.1 },
  )

  imageObserver.value.observe(imageRef.value)
}

function cleanupObserver() {
  if (imageObserver.value) {
    imageObserver.value.disconnect()
    imageObserver.value = undefined
  }
}

watch(
  () => props.src,
  (newSrc) => {
    isLoading.value = true
    hasError.value = false
    cleanupObserver()
    clearLoadTimeout() // Также сбрасываем таймер при смене src

    if (!newSrc) {
      isLoading.value = false
      return
    }

    nextTick(() => {
      if (imageRef.value) {
        // Если изображение уже загружено (из кеша), обрабатываем сразу
        if (imageRef.value.complete && imageRef.value.naturalWidth > 0) {
          handleLoad()
          return
        }

        // Для eager-загрузки таймер запускается немедленно
        if (props.loading === 'eager') {
          setLoadTimeout()
        }
        // Для lazy-загрузки мы ждем, пока IntersectionObserver не запустит таймер
        else {
          setupIntersectionObserver()
        }
      }
    })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  clearLoadTimeout()
  cleanupObserver()
})

defineExpose({
  isLoading: readonly(isLoading),
  hasError: readonly(hasError),
  retry: () => {
    if (props.src && hasError.value) {
      // При повторной попытке сбрасываем состояние и логику как при первой загрузке
      const newSrc = props.src
      // "Перезагружаем" watcher
      watch(() => newSrc, () => {}, { immediate: true })
    }
  },
})
</script>

<template>
  <component :is="aspectRatio ? AspectRatio : 'div'" :ratio="aspectRatio" class="kit-image-wrapper">
    <div class="kit-image-container">
      <!-- Слот для лоудера с Skeleton по умолчанию -->
      <transition name="faded">
        <div v-if="isLoading" class="placeholder-wrapper">
          <slot name="loader">
            <KitSkeleton class="skeleton-placeholder" />
          </slot>
        </div>
      </transition>

      <!-- Слот для ошибки с заглушкой по умолчанию -->
      <transition name="faded">
        <div v-if="hasError" class="placeholder-wrapper">
          <slot name="error">
            <div class="error-placeholder">
              <img :src="smthWrongImage" alt="Ошибка загрузки" class="error-image">
            </div>
          </slot>
        </div>
      </transition>

      <!-- Адаптивное изображение с помощью <picture> -->
      <picture v-if="src">
        <!-- Источники для разных размеров экрана. Браузер выберет первый подходящий. -->
        <source
          v-if="resolvedVariants.large"
          :srcset="resolvedVariants.large"
          media="(min-width: 1200px)"
          type="image/webp"
        >
        <source
          v-if="resolvedVariants.medium"
          :srcset="resolvedVariants.medium"
          media="(min-width: 600px)"
          type="image/webp"
        >

        <!-- Фоллбэк: оригинальное изображение для старых браузеров или если вариантов нет -->
        <img
          ref="imageRef"
          :src="resolvedSrc"
          class="image"
          :alt="alt"
          :loading="loading"
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
    /* Добавляем picture сюда */
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;

    .skeleton-placeholder {
      width: 100% !important;
      height: 100% !important;
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
