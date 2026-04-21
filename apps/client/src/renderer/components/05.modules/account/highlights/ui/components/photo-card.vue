<script setup lang="ts">
import type { TripImageWithTrip } from '~/components/05.modules/account/storage/composables/use-storage'
import { Icon } from '@iconify/vue'
import { onLongPress, useIntersectionObserver } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useDisplay } from '~/shared/composables/use-display'
import { useToast } from '~/shared/composables/use-toast'
import { getImageUrl } from '~/shared/lib/url'

const props = defineProps<{
  photo: TripImageWithTrip
  quality: 'fast' | 'detailed' | 'original'
  index: number
}>()

const cardRef = ref<HTMLElement | null>(null)
const isCenter = ref(false)
const isTipOpen = ref(false)
const { mobile } = useDisplay()
const toast = useToast()

// Хаотичность рендерится 1 раз при маунте: разная высота (40-80vh), выравнивание и легкий наклон
const heightVh = ref(Math.floor(Math.random() * (80 - 40 + 1) + 40))
const alignSelf = ref(['flex-start', 'center', 'flex-end'][Math.floor(Math.random() * 3)])
const translateY = ref(Math.floor(Math.random() * 20 - 10))
const rotate = ref(Math.floor(Math.random() * 6 - 3))

const cardStyle = computed(() => ({
  'height': `${heightVh.value}vh`,
  'alignSelf': alignSelf.value,
  '--ty': `${translateY.value}px`,
  '--rot': `${rotate.value}deg`,
  'marginLeft': props.index === 0 ? '5vw' : '-5vw', // Эффект перекрытия ("куча" фоток)
}))

// Динамический аспект ратио
const aspectRatio = computed(() => {
  if (props.photo.width && props.photo.height)
    return props.photo.width / props.photo.height
  return 1
})

const photoUrl = computed(() => {
  const options: any = {}
  if (props.quality === 'fast') { options.w = 400; options.q = 60 }
  else if (props.quality === 'detailed') { options.w = 1200; options.q = 80 }
  else { options.q = 100 }
  return getImageUrl(props.photo.url, options) || ''
})

// На мобилках используем observer, чтобы масштабировать ту фотку, которая сейчас по центру экрана
useIntersectionObserver(cardRef, ([entry]) => {
  if (mobile.value) {
    isCenter.value = entry.isIntersecting && entry.intersectionRatio > 0.5
  }
  else {
    isCenter.value = true // На десктопе фото всегда 'активно' и реагирует на hover
  }
}, { threshold: [0.5] })

// Мобильное контекстное меню
onLongPress(cardRef, () => {
  if (mobile.value) {
    toast.info('Опции файла будут доступны в контекстном меню')
  }
})

const tipText = computed(() => {
  const location = (props.photo.latitude && props.photo.longitude) ? '📍 ' : ''
  const tripTitle = props.photo.trip?.title || 'Без путешествия'
  const date = props.photo.takenAt ? new Date(props.photo.takenAt).toLocaleDateString('ru') : ''
  return `${location}${tripTitle}${date ? `, ${date}` : ''}`
})
</script>

<template>
  <div
    ref="cardRef"
    class="photo-card-wrapper"
    :style="cardStyle"
    :class="{ 'is-center': isCenter }"
  >
    <img :src="photoUrl" :style="{ aspectRatio }" class="photo-img" loading="lazy">

    <div
      class="photo-tip"
      :class="{ 'is-open': isTipOpen }"
      @click.stop="mobile ? isTipOpen = !isTipOpen : null"
    >
      <div class="tip-icon">
        <Icon icon="mdi:map-marker" />
      </div>
      <div class="tip-text">
        {{ tipText }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.photo-card-wrapper {
  position: relative;
  flex-shrink: 0;
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-tertiary-color);
  cursor: pointer;

  z-index: 1;
  /* Исходная легкая небрежность трансформации */
  transform: translateY(var(--ty)) rotate(var(--rot)) scale(0.95);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  transition:
    transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    z-index 0s,
    box-shadow 0.4s ease,
    opacity 0.4s ease;

  /* Эффект Hover Desktop: всплытие из кучи */
  &:hover {
    z-index: 10 !important;
    transform: translateY(0) rotate(0deg) scale(1.05) !important;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);

    .photo-tip {
      max-width: 350px;
      background: rgba(0, 0, 0, 0.7);

      .tip-text {
        opacity: 1;
        width: auto;
      }
    }
  }

  @media (max-width: 768px) {
    scroll-snap-align: center;
    opacity: 0.5; /* Боковые затемнены */

    &.is-center {
      opacity: 1; /* Центральное яркое */
      z-index: 5;
      transform: translateY(var(--ty)) rotate(var(--rot)) scale(1) !important;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
  }
}

.photo-img {
  height: 100%;
  object-fit: cover;
  display: block;
}

.photo-tip {
  position: absolute;
  bottom: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: white;
  border-radius: var(--r-full);
  display: flex;
  align-items: center;
  padding: 6px;
  max-width: 32px; // Сжато до иконки
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
  white-space: nowrap;

  &.is-open {
    max-width: 350px;
    background: rgba(0, 0, 0, 0.8);
    .tip-text {
      opacity: 1;
      width: auto;
    }
  }
}

.tip-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.tip-text {
  opacity: 0;
  width: 0;
  font-size: 0.85rem;
  margin-left: 6px;
  padding-right: 6px;
  transition: opacity 0.3s ease;
}
</style>
