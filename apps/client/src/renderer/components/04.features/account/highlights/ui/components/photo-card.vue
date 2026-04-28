<script setup lang="ts">
import type { HighlightImageQuality } from '../../composables/use-highlights'
import type { TripImageWithTrip } from '~/components/05.modules/account/storage/composables/use-storage'
import { Icon } from '@iconify/vue'
import { onLongPress } from '@vueuse/core'
import { computed, ref } from 'vue'
import { KitImage } from '~/components/01.kit/kit-image'
import { useDisplay } from '~/shared/composables/use-display'
import { useToast } from '~/shared/composables/use-toast'
import { getImageUrl } from '~/shared/lib/url'

const props = defineProps<{
  photo: TripImageWithTrip
  quality: HighlightImageQuality
}>()

const emit = defineEmits<{
  (e: 'click'): void
}>()

const cardRef = ref<HTMLElement | null>(null)
const isTipOpen = ref(false)
const { mobile } = useDisplay()
const toast = useToast()

const aspectRatio = computed(() => {
  if (props.photo.width && props.photo.height)
    return props.photo.width / props.photo.height
  return 1
})

const photoUrl = computed(() => {
  const options: any = {}
  if (props.quality === 'medium') {
    options.w = 400
    options.q = 60
  }
  else if (props.quality === 'large') {
    options.w = 800
    options.q = 80
  }
  else {
    options.q = 100
  }
  return getImageUrl(props.photo.url, options) || ''
})

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
    class="photo-card"
    @mouseenter="!mobile ? isTipOpen = true : null"
    @mouseleave="!mobile ? isTipOpen = false : null"
    @click="emit('click')"
  >
    <KitImage
      :src="photoUrl"
      :aspect-ratio="aspectRatio"
      class="photo-img"
      loading="lazy"
    />

    <div class="photo-overlay" :class="{ 'is-active': isTipOpen && !mobile }">
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
.photo-card {
  position: relative;
  border-radius: var(--r-m);
  overflow: hidden;
  background: var(--bg-tertiary-color);
  cursor: pointer;
  margin-bottom: 16px;
  break-inside: avoid;
  box-shadow: var(--s-sm);
  transition:
    box-shadow 0.3s ease,
    transform 0.3s ease;

  &:hover {
    box-shadow: var(--s-md);
    transform: translateY(-2px);
  }
}

.photo-img {
  width: 100%;
  display: block;
  transition: transform 0.4s ease;
}

.photo-card:hover .photo-img {
  transform: scale(1.02);
}

.photo-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px 12px 12px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 100%);
  color: white;
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.3s ease;
  pointer-events: none;

  &.is-active {
    opacity: 1;
    transform: translateY(0);
  }
}

.tip-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.9);
}

.tip-text {
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgba(255, 255, 255, 0.9);
}
</style>
