<script setup lang="ts">
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { PostDetail } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { useTimeAgo } from '@vueuse/core'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitImage } from '~/components/01.kit/kit-image'

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

const timeAgo = useTimeAgo(new Date(props.post.createdAt))
const activeMediaIndex = ref(0)
const activeMarkId = ref<string | null>(null)
const cardAccentColor = ref('#A8AAAE')

const menuItems: KitDropdownItem[] = [
  { label: 'Редактировать', value: 'edit', icon: 'mdi:pencil' },
  { label: 'Удалить', value: 'delete', icon: 'mdi:trash-can-outline', isDestructive: true },
]

function handleMenuAction(action: string) {
  if (action === 'edit')
    emit('edit', props.post.id)
  else if (action === 'delete')
    emit('delete', props.post.id)
}

const currentMedia = computed(() => props.post.media[activeMediaIndex.value])
const hasMultipleMedia = computed(() => props.post.media.length > 1)

function nextImage() {
  if (activeMediaIndex.value < props.post.media.length - 1) {
    activeMediaIndex.value++
    activeMarkId.value = null
  }
}

function prevImage() {
  if (activeMediaIndex.value > 0) {
    activeMediaIndex.value--
    activeMarkId.value = null
  }
}

function toggleMark(markId: string) {
  activeMarkId.value = activeMarkId.value === markId ? null : markId
}

async function extractAverageColor(url: string) {
  if (!url)
    return

  const img = new Image()
  img.crossOrigin = 'Anonymous'

  img.onerror = () => {
    console.error(`Не удалось загрузить изображение для анализа цвета: ${url}`)
    cardAccentColor.value = '#A8AAAE'
  }

  img.onload = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx)
      return

    canvas.width = 1
    canvas.height = 1

    try {
      ctx.drawImage(img, 0, 0, 1, 1)

      const pixelData = ctx.getImageData(0, 0, 1, 1).data
      const [r, g, b, a] = pixelData

      if (a === 0) {
        console.warn(`Анализ цвета не удался (прозрачный пиксель), используется цвет по умолчанию. URL: ${url}`)
        cardAccentColor.value = '#A8AAAE'
        return
      }

      cardAccentColor.value = `rgb(${r},${g},${b})`
    }
    catch (e) {
      console.error(`Ошибка при анализе цвета изображения (вероятно, CORS): ${url}`, e)
      cardAccentColor.value = '#A8AAAE'
    }
  }

  img.src = url
}

function onClickLocation() {
  const { city, country, latitude, longitude } = props.post

  emit('clickLocation', { city, country, lat: latitude, lng: longitude })
}

watch(() => props.post.media[0]?.url, (newUrl) => {
  if (newUrl) {
    extractAverageColor(newUrl)
  }
}, { immediate: true })

const cardStyle = computed(() => ({
  '--post-card-accent': cardAccentColor.value,
}))
</script>

<template>
  <article class="post-card" :style="cardStyle" @click="$emit('clickCard', post.id)">
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
          :items="menuItems"
          align="end"
          @update:model-value="handleMenuAction"
        >
          <template #trigger>
            <KitBtn variant="text" size="xs" icon="mdi:dots-horizontal" class="more-btn" />
          </template>
        </KitDropdown>
      </div>
    </header>

    <div class="media-zone">
      <div v-if="hasMultipleMedia" class="media-dots-top">
        <span
          v-for="(_, idx) in post.media"
          :key="idx"
          class="dot"
          :class="{ active: idx === activeMediaIndex }"
        />
      </div>

      <div v-if="hasMultipleMedia" class="nav-overlay">
        <div class="nav-zone left" @click.stop="prevImage" />
        <div class="nav-zone right" @click.stop="nextImage" />
      </div>

      <div class="image-container">
        <Transition name="fade" mode="out-in">
          <div :key="currentMedia?.id || 'empty'" class="image-wrapper">
            <template v-if="currentMedia">
              <div class="blur-backdrop">
                <KitImage
                  :src="currentMedia.url"
                  object-fit="cover"
                  class="backdrop-img"
                />
                <div class="backdrop-overlay" />
              </div>

              <div class="main-img-wrapper">
                <KitImage
                  :src="currentMedia.url"
                  class="main-img"
                  object-fit="contain"
                />
              </div>

              <template v-if="currentMedia.marks">
                <div
                  v-for="mark in currentMedia.marks"
                  :key="mark.id"
                  class="smart-mark"
                  :class="{ 'is-active': activeMarkId === mark.id }"
                  :style="{ left: `${mark.x}%`, top: `${mark.y}%` }"
                  @click.stop="toggleMark(mark.id)"
                >
                  <div class="mark-dot" />
                  <div class="mark-bubble">
                    <span>{{ mark.label }}</span>
                    <div class="bubble-tail" />
                  </div>
                </div>
              </template>
            </template>
            <div v-else class="no-media">
              <Icon icon="mdi:image-off-outline" />
            </div>
          </div>
        </Transition>
      </div>

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

    <div class="insight-block">
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

      <!-- Статистика для превью -->
      <div v-if="post.statsDetail" class="stats-preview">
        <span v-if="post.statsDetail.duration">{{ post.statsDetail.duration }}</span>
        <span v-if="post.statsDetail.budget" class="divider">•</span>
        <span v-if="post.statsDetail.budget">{{ post.statsDetail.budget }}</span>
      </div>
    </footer>
  </article>
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
  /* Левая граница динамического цвета */
  border-left: 4px solid var(--post-card-accent);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--s-l);
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
  aspect-ratio: 4/3;
  overflow: hidden;
  background-color: #1a1a1a;
}

.image-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.image-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.blur-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  :deep(.kit-image-container) {
    background: transparent;
  }
}

.backdrop-img {
  width: 100%;
  height: 100%;
  filter: blur(20px) brightness(0.9) saturate(1.2);
  transform: scale(1.5);
  opacity: 1;
}

.backdrop-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.2);
  z-index: 1;
}

.main-img-wrapper {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.5));

  :deep(.kit-image-container) {
    background: transparent;
  }
}

.main-img {
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 100%;
  display: block;
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

.nav-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
}

.nav-zone {
  height: 100%;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &.left {
    width: 30%;
  }
  &.right {
    width: 70%;
  }
}

.media-dots-top {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  z-index: 20;
  pointer-events: none;
}

.dot {
  width: 6px;
  height: 6px;
  background-color: rgba(255, 255, 255, 0.4);
  border-radius: 50%;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.5, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);

  &.active {
    background-color: white;
    transform: scale(1.3);
  }
}

.smart-mark {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 30;
  cursor: pointer;
}

.mark-dot {
  width: 12px;
  height: 12px;
  background-color: rgba(255, 255, 255, 0.9);
  border: 2px solid var(--post-card-accent);
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s;
  animation: pulse 2s infinite;
}

.smart-mark:hover .mark-dot,
.smart-mark.is-active .mark-dot {
  transform: scale(1.2);
}

.mark-bubble {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%) scale(0.8);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: all 0.2s;
}

.smart-mark:hover .mark-bubble,
.smart-mark.is-active .mark-bubble {
  opacity: 1;
  transform: translateX(-50%) scale(1);
  pointer-events: auto;
}

.bubble-tail {
  position: absolute;
  bottom: -4px;
  left: 50%;
  margin-left: -4px;
  border-width: 4px 4px 0;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
}

.info-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 40px 16px 12px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 100%);
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
