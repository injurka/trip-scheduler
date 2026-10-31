<script setup lang="ts">
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { PostDetail, PostMedia } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { useTimeAgo } from '@vueuse/core'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitImageViewer, useImageViewer } from '~/components/01.kit/kit-image-viewer'
import { getPostMediaVariants } from '~/components/05.modules/post/lib/media-variants'
import { useRequest } from '~/plugins/request'
import { useToast } from '~/shared/composables/use-toast'

interface Props {
  post: PostDetail
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'clickLocation', location: any): void
  (e: 'clickCard', id: string): void
  (e: 'toggleLike', id: string): void
  (e: 'toggleSave', id: string): void
  (e: 'edit', id: string): void
  (e: 'delete', id: string): void
}>()

const authStore = useAppStore('auth')
const timeAgo = useTimeAgo(new Date(props.post.createdAt))
const { isOpen, open, currentIndex } = useImageViewer()

const { user } = storeToRefs(authStore)
const galleryMedia = ref<PostMedia[]>([])
const isGalleryLoading = ref(false)
const menuItems: KitDropdownItem[] = [
  { label: 'Редактировать', value: 'edit', icon: 'mdi:pencil' },
  { label: 'Удалить', value: 'delete', icon: 'mdi:trash-can-outline', isDestructive: true },
]

const accessibleMedia = computed(() => props.post.media.filter(media => media.hasAccess !== false))
const previewMedia = computed(() => {
  const photos = accessibleMedia.value.filter(media => media.type === 'image')
  const ids = props.post.statsDetail?.coverMediaIds
  const selected = ids?.flatMap(id => photos.filter(media => media.id === id)) || []

  return (selected.length ? selected : photos).slice(0, 5)
})
const viewerImages = computed(() => galleryMedia.value.map((media) => {
  const variants = getPostMediaVariants(media)

  return {
    url: media.type === 'video' ? variants.web || media.url : media.url,
    mediaType: media.type,
    alt: media.originalName || 'Медиа поста',
    variants: media.type === 'video'
      ? { ...variants, small: variants.poster || variants.small, medium: variants.poster || variants.medium, large: variants.web || media.url }
      : variants,
    meta: { ...media.metadata, imageId: media.id },
  }
}))
const isOwner = computed(() => !!user.value && user.value.id === props.post.user.id)
const formattedStartDate = computed(() => {
  if (!props.post.startDate)
    return ''

  const d = new Date(props.post.startDate)

  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
})
const formattedDuration = computed(() => {
  const hours = props.post.statsDetail?.duration || 0

  if (!hours)
    return ''

  if (hours >= 24 && hours % 24 === 0)
    return `${hours / 24} дн.`

  return `${hours} ч.`
})

async function openGallery() {
  if (isGalleryLoading.value)
    return

  isGalleryLoading.value = true
  const postId = props.post.id

  try {
    const detail = await useRequest<PostDetail>({
      key: `post:gallery:${postId}`,
      fn: db => db.posts.getById({ id: postId }),
      onError: () => {
        useToast().error('Не удалось загрузить галерею. Попробуйте ещё раз.')
      },
    })

    if (!detail || props.post.id !== postId)
      return

    galleryMedia.value = detail.media.filter(item => item.hasAccess !== false)

    if (!galleryMedia.value.length) {
      useToast().info('В этом посте нет доступных фото и видео.')

      return
    }

    open(viewerImages.value, 0)
  }
  finally {
    isGalleryLoading.value = false
  }
}
function handleMenuAction(action: string) {
  if (action === 'edit')
    emit('edit', props.post.id)
  else if (action === 'delete')
    emit('delete', props.post.id)
}
function getMainImgUrl(media: PostMedia) {
  if (media.hasAccess === false)
    return ''

  const variants = getPostMediaVariants(media)

  if (media.type === 'video') {
    return ''
  }

  return variants?.medium || media.url
}
function onClickLocation() {
  const { city, country, latitude, longitude } = props.post

  emit('clickLocation', { city, country, lat: latitude, lng: longitude })
}
</script>

<template>
  <article class="post-card" @click="$emit('clickCard', post.id)">
    <header class="card-header">
      <div class="author-info">
        <KitAvatar :src="post.user.avatarUrl" :name="post.user.name" size="32" />
        <div class="meta">
          <span class="author-name">{{ post.user.name }}</span>
          <span class="time">{{ timeAgo }}</span>
        </div>
      </div>

      <div class="header-actions" @click.stop>
        <button class="location-badge" @click.stop="onClickLocation">
          <Icon icon="mdi:map-marker-outline" />
          <span>{{ post.country }}</span>
        </button>
        <div class="spacer" />

        <KitDropdown
          v-if="isOwner"
          :items="menuItems"
          align="end"
          @update:model-value="handleMenuAction"
        >
          <template #trigger>
            <KitBtn
              variant="text"
              size="xs"
              icon="mdi:dots-horizontal"
              class="more-btn"
            />
          </template>
        </KitDropdown>
      </div>
    </header>

    <div class="media-zone">
      <div v-if="previewMedia.length" class="photo-collage" :class="`photos-${previewMedia.length}`">
        <button
          v-for="media in previewMedia"
          :key="media.id"
          class="collage-tile"
          type="button"
          :aria-label="`Открыть пост: ${post.title}`"
          @click.stop="emit('clickCard', post.id)"
        >
          <KitImage :src="getMainImgUrl(media)" :alt="media.originalName || post.title" object-fit="cover" />
          <Icon v-if="media.isPrivate" icon="mdi:lock" class="private-icon" />
        </button>
      </div>
      <div v-else class="no-media">
        <Icon :icon="accessibleMedia.length ? 'mdi:video-outline' : post.media.length ? 'mdi:lock-outline' : 'mdi:image-off-outline'" />
      </div>
      <KitBtn
        v-if="accessibleMedia.length"
        class="gallery-button"
        variant="text"
        size="xs"
        :icon="isGalleryLoading ? 'mdi:loading' : 'mdi:image-multiple-outline'"
        :disabled="isGalleryLoading"
        :aria-busy="isGalleryLoading"
        aria-label="Открыть все фото и видео поста"
        @click.stop="openGallery()"
      >
        {{ isGalleryLoading ? 'Загрузка…' : 'Галерея' }}
      </KitBtn>

      <div class="info-overlay">
        <div class="title-row">
          <h3 class="post-title">
            {{ post.title }}
          </h3>
        </div>
      </div>
    </div>

    <div v-if="post.city || post.tags.length" class="tags-actions-row">
      <div class="tags-scroll">
        <div v-if="post.city" class="tag city-tag">
          <Icon icon="mdi:map-marker" />
          <span>{{ post.city }}</span>
        </div>

        <span
          v-for="tag in post.tags"
          :key="tag"
          class="tag simple-tag"
        >
          #{{ tag }}
        </span>
      </div>
    </div>

    <div v-if="post.insight?.trim()" class="insight-block">
      <div class="insight-icon">
        <Icon icon="mdi:lightbulb-on-outline" />
      </div>
      <p class="insight-text">
        {{ post.insight }}
      </p>
    </div>

    <footer class="card-footer">
      <div class="interaction-group">
        <button
          class="action-btn like-btn"
          :class="{ active: post.stats?.isLiked }"
          @click.stop="emit('toggleLike', post.id)"
        >
          <Icon :icon="post.stats?.isLiked ? 'mdi:heart' : 'mdi:heart-outline'" />
          <span>{{ post.stats?.likes ?? 0 }}</span>
        </button>

        <button
          class="action-btn save-btn"
          :class="{ active: post.stats?.isSaved }"
          @click.stop="emit('toggleSave', post.id)"
        >
          <Icon :icon="post.stats?.isSaved ? 'mdi:bookmark' : 'mdi:bookmark-outline'" />
          <span>{{ post.stats?.isSaved ? 'Сохранено' : 'Хочу' }}</span>
        </button>
      </div>

      <div v-if="formattedDuration || formattedStartDate" class="stats-preview">
        <span v-if="formattedDuration">{{ formattedDuration }}</span>
        <span v-if="formattedDuration && formattedStartDate" class="divider">•</span>
        <span v-if="formattedStartDate">{{ formattedStartDate }}</span>
      </div>
    </footer>
  </article>
  <KitImageViewer
    v-if="isOpen"
    v-model:visible="isOpen"
    v-model:current-index="currentIndex"
    :images="viewerImages"
    enable-thumbnails
  />
</template>

<style scoped lang="scss">
.post-card {
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-l);
  overflow: hidden;
  box-shadow: var(--s-m);
  display: flex;
  flex-direction: column;
  position: relative;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  border: 1px solid var(--border-secondary-color);
  content-visibility: auto;
  contain-intrinsic-size: auto 650px;

  @include hover {
    & {
      box-shadow: var(--s-l);
    }
  }
}

.card-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--bg-secondary-color);
}

.author-info {
  display: flex;
  align-items: center;
  gap: 10px;

  :deep(.kit-avatar) {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
  }

  .meta {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
}

.author-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--fg-primary-color);
}

.time {
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);
}

.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.location-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: var(--r-full);
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }
}

.media-zone {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  background-color: #1a1a1a;
}

.photo-collage {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 3px;
  height: 100%;
  &.photos-1 {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }
  &.photos-2 {
    grid-template-rows: 1fr;
  }
  &.photos-3 .collage-tile:first-child {
    grid-row: span 2;
  }
  &.photos-5 {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    .collage-tile {
      grid-column: span 2;
    }
    .collage-tile:nth-child(-n + 2) {
      grid-column: span 3;
    }
  }
}
.collage-tile {
  position: relative;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  overflow: hidden;
  cursor: pointer;
  background: var(--bg-tertiary-color);
  :deep(.kit-image-wrapper),
  :deep(.kit-image-container) {
    width: 100%;
    height: 100%;
  }
  &:focus-visible {
    outline: 3px solid var(--fg-accent-color);
    outline-offset: -3px;
  }
}
.private-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  color: white;
}
.gallery-button.kit-btn {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 16;
  height: 32px;
  min-width: 48px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: rgba(20, 20, 24, 0.5);
  color: #fff;
  box-shadow: none;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  transition: background-color 150ms ease;

  :deep(.kit-btn-content) {
    gap: 6px;
  }
  :deep(.kit-btn-icon) {
    font-size: 16px;
  }

  &:hover {
    background: rgba(20, 20, 24, 0.95);
    color: #fff;
    box-shadow: none;
  }

  &:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 3px;
  }
}
.no-media {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.2);
  font-size: 48px;
  width: 100%;
  height: 100%;
}

.info-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 40px 90px 12px;
  padding-left: 16px;
  pointer-events: none;
  background: linear-gradient(to top, var(--bg-tertiary-color) 0%, transparent 80%);
  color: white;
  pointer-events: none;
  z-index: 15;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.post-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.3;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.tags-actions-row {
  padding: 12px 16px 8px;
  border-bottom: 1px solid var(--border-secondary-color);
}

.tags-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.tag {
  font-size: 0.8rem;
  padding: 4px 10px;
  border-radius: var(--r-s);
  white-space: nowrap;
  font-weight: 500;
}

.city-tag {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 2px;
  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  border: 1px solid var(--border-primary-color);
  font-weight: 700;
}

.simple-tag {
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
}

.insight-block {
  margin: 12px 16px;
  padding: 12px;
  background-color: rgba(var(--bg-accent-color-rgb), 0.1);
  border-radius: var(--r-m);
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.insight-icon {
  color: var(--post-card-accent);
  font-size: 1.2rem;
  margin-top: 2px;
  flex-shrink: 0;
}

.insight-text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--fg-primary-color);
  font-style: italic;
}

.card-footer {
  padding: 8px 16px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.interaction-group {
  display: flex;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--fg-secondary-color);
  font-size: 0.9rem;
  font-weight: 600;
  padding: 6px 8px;
  border-radius: var(--r-s);
  transition: all 0.2s;

  .iconify {
    font-size: 1.4rem;
  }

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &.like-btn.active {
    color: #ea5455;
  }
  &.save-btn.active {
    color: var(--fg-accent-color);
  }
}

.stats-preview {
  display: flex;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  .divider {
    opacity: 0.5;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(255, 255, 255, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
  }
}
</style>
