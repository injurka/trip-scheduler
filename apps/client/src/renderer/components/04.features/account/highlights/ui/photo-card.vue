<script setup lang="ts">
import type { HighlightImageQuality } from '../composables/use-highlights'
import type { Highlight } from '~/shared/types/models/user'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { KitImage } from '~/components/01.kit/kit-image'
import { getImageUrl } from '~/shared/lib/url'

const props = defineProps<{
  photo: Highlight
  quality: HighlightImageQuality
  isOwner: boolean
}>()

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'edit', photo: Highlight): void
  (e: 'delete', id: string): void
}>()

const isTooltipOpen = ref(false)

// Динамически вычисляем пропорции из оригинального фото, чтобы masonry-сетка была красивой
const dynamicAspectRatio = computed(() => {
  if (props.photo.width && props.photo.height) {
    return props.photo.width / props.photo.height
  }
  return 4 / 5 // Фоллбэк, если размеры неизвестны
})

const photoUrl = computed(() => {
  const variants = props.photo.variants as Record<string, string> | undefined
  let src = props.photo.imageUrl
  const options: { q?: number } = {}

  if (props.quality === 'medium' && variants?.medium)
    src = variants.medium
  else if (props.quality === 'large' && variants?.large)
    src = variants.large

  if (props.quality !== 'original')
    options.q = props.quality === 'large' ? 85 : 75

  return getImageUrl(src, options)
})

const locationName = computed(() =>
  [props.photo.city, props.photo.country?.name].filter(Boolean).join(', ') || 'Локация не указана',
)

const maxCommentLength = 80

const isCommentTruncated = computed(() => {
  return props.photo.comment && props.photo.comment.trim().length > maxCommentLength
})

const shortComment = computed(() => {
  const comment = props.photo.comment?.trim()
  if (!comment)
    return 'Без описания'

  if (isCommentTruncated.value) {
    return `${comment.slice(0, maxCommentLength)}...`
  }
  return comment
})

const date = computed(() =>
  props.photo.takenAt
    ? new Date(props.photo.takenAt).toLocaleDateString('ru-RU')
    : '',
)

function toggleTooltip(e: Event) {
  e.stopPropagation()
  isTooltipOpen.value = !isTooltipOpen.value
}
</script>

<template>
  <article
    class="photo-card"
    role="button"
    tabindex="0"
    @click="emit('click')"
    @mouseleave="isTooltipOpen = false"
    @keydown.enter.prevent="emit('click')"
    @keydown.space.prevent="emit('click')"
  >
    <div class="media-wrap">
      <KitImage
        :src="photoUrl"
        :alt="locationName"
        :aspect-ratio="dynamicAspectRatio"
        class="highlight-image"
      />

      <div v-if="isOwner" class="card-actions">
        <button
          type="button"
          class="icon-btn"
          title="Редактировать"
          @click.stop="emit('edit', photo)"
        >
          <Icon icon="mdi:pencil-outline" />
        </button>

        <button
          type="button"
          class="icon-btn icon-btn--danger"
          title="Удалить"
          @click.stop="emit('delete', photo.id)"
        >
          <Icon icon="mdi:trash-can-outline" />
        </button>
      </div>

      <div class="overlay-body">
        <div class="location-row">
          <img
            v-if="photo.country?.flagUrl"
            :src="photo.country.flagUrl"
            :alt="photo.country?.name || ''"
            class="flag"
          >
          <h4 class="location">
            {{ locationName }}
          </h4>
        </div>

        <div v-if="photo.comment" class="comment-row">
          <p class="comment">
            {{ shortComment }}
            <span
              v-if="isCommentTruncated"
              class="tooltip-trigger"
              role="button"
              tabindex="0"
              @click.stop="toggleTooltip"
              @mouseenter="isTooltipOpen = true"
              @mouseleave="isTooltipOpen = false"
            >
              <Icon icon="mdi:message-text-outline" />
              <transition name="fade-up">
                <span v-if="isTooltipOpen" class="tooltip-content">
                  {{ photo.comment }}
                </span>
              </transition>
            </span>
          </p>
        </div>

        <div class="meta-row">
          <span v-if="date" class="meta-item">
            <Icon icon="mdi:calendar-blank-outline" />
            {{ date }}
          </span>

          <span v-if="photo.address" class="meta-item meta-item--truncate">
            <Icon icon="mdi:map-marker-outline" />
            {{ photo.address }}
          </span>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.photo-card {
  position: relative;
  display: inline-block;
  width: 100%;
  margin-bottom: 0px;
  break-inside: avoid;
  border-radius: var(--r-l);
  overflow: hidden;
  background: var(--bg-tertiary-color);
  box-shadow: var(--s-s);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  outline: none;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    transform: translateY(-3px);
    box-shadow: var(--s-md);
  }

  &:hover .card-actions,
  &:focus-visible .card-actions {
    opacity: 1;
    transform: translateY(0);
  }

  &:hover .overlay-body,
  &:focus-visible .overlay-body {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
}

.media-wrap {
  position: relative;
  width: 100%;
  display: block;
}

.highlight-image {
  display: block;
  width: 100%;
}

.card-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 8px;
  opacity: 0;
  transform: translateY(-6px);
  z-index: 10;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.icon-btn {
  width: 34px;
  height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.58);
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition:
    transform 0.2s ease,
    background-color 0.2s ease;

  &:hover {
    transform: scale(1.06);
    background: rgba(0, 0, 0, 0.74);
  }
}

.icon-btn--danger:hover {
  background: rgba(var(--bg-error-color-rgb), 0.9);
}

.overlay-body {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 40px 14px 14px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 60%, transparent 100%);
  opacity: 0;
  transform: translateY(10px);
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
  pointer-events: none;
  z-index: 5;
}

.location-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.location {
  margin: 0;
  min-width: 0;
  font-size: 0.98rem;
  font-weight: 700;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.flag {
  width: 20px;
  height: 14px;
  object-fit: cover;
  border-radius: 2px;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.comment-row {
  position: relative;
}

.comment {
  margin: 0;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.45;
  font-size: 0.85rem;
}

.tooltip-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: sub;
  margin-left: 6px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: var(--fg-accent-color);
  cursor: help;
  position: relative;
  transition:
    background 0.2s,
    color 0.2s;

  &:hover,
  &:focus {
    background: rgba(255, 255, 255, 0.3);
    color: white;
  }
}

.tooltip-content {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  width: max-content;
  max-width: 240px;
  background: rgba(15, 15, 15, 0.95);
  backdrop-filter: blur(8px);
  color: white;
  padding: 10px 14px;
  border-radius: var(--r-m);
  font-size: 0.82rem;
  line-height: 1.5;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  white-space: normal;
  text-align: left;
  z-index: 20;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.fade-up-enter-active,
.fade-up-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  margin-top: 4px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);

  .iconify {
    font-size: 1rem;
  }
}

.meta-item--truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
