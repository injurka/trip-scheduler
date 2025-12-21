<script setup lang="ts">
import type { Post } from '../../models/types'
import { Icon } from '@iconify/vue'
import { useTimeAgo } from '@vueuse/core'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitImage } from '~/components/01.kit/kit-image'

interface Props {
  post: Post
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'clickLocation', location: any): void
  (e: 'clickCard', id: string): void
  (e: 'toggleLike', id: string): void
  (e: 'toggleSave', id: string): void
}>()

const timeAgo = useTimeAgo(new Date(props.post.createdAt))

const activeMediaIndex = ref(0)
const mediaScrollRef = ref<HTMLElement | null>(null)

function onScroll() {
  if (!mediaScrollRef.value)
    return
  const scrollLeft = mediaScrollRef.value.scrollLeft
  const width = mediaScrollRef.value.offsetWidth
  activeMediaIndex.value = Math.round(scrollLeft / width)
}

const activeMarkId = ref<string | null>(null)

function toggleMark(markId: string) {
  if (activeMarkId.value === markId) {
    activeMarkId.value = null
  }
  else {
    activeMarkId.value = markId
  }
}

const categoryColors: Record<string, string> = {
  food: '#FF9F43', // Оранжевый
  nature: '#28C76F', // Зеленый
  culture: '#7367F0', // Синий
  sport: '#EA5455', // Красный
  other: '#A8AAAE', // Серый
}

const cardBorderColor = computed(() => {
  return categoryColors[props.post.category] || categoryColors.other
})

const cardStyle = computed(() => ({
  '--post-card-accent': cardBorderColor.value,
}))
</script>

<template>
  <article class="post-card" :style="cardStyle" @click="$emit('clickCard', post.id)">
    <header class="card-header">
      <div class="author-info">
        <KitAvatar :src="post.author.avatarUrl" :name="post.author.name" size="32" />
        <div class="meta">
          <span class="author-name">{{ post.author.name }}</span>
          <span class="time">{{ timeAgo }}</span>
        </div>
      </div>

      <div class="header-actions">
        <button class="location-badge" @click.stop="emit('clickLocation', post.location)">
          <Icon icon="mdi:map-marker-outline" />
          <span>{{ post.location.country }}</span>
        </button>
        <div class="spacer" />
        <KitBtn variant="text" size="xs" icon="mdi:dots-horizontal" class="more-btn" />
      </div>
    </header>

    <div class="media-zone">
      <div
        ref="mediaScrollRef"
        class="media-scroller"
        @scroll.passive="onScroll"
      >
        <div
          v-for="media in post.media"
          :key="media.id"
          class="media-item"
        >
          <KitImage
            :src="media.url"
            class="media-image"
            object-fit="cover"
          />

          <template v-if="media.marks">
            <div
              v-for="mark in media.marks"
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
        </div>
      </div>

      <div v-if="post.media.length > 1" class="media-dots">
        <span
          v-for="(_, idx) in post.media"
          :key="idx"
          class="dot"
          :class="{ active: idx === activeMediaIndex }"
        />
      </div>

      <div class="info-overlay">
        <div class="title-row">
          <h3 class="post-title">
            {{ post.title }}
          </h3>
          <span class="rating-emoji">{{ post.ratingEmoji }}</span>
        </div>
      </div>
    </div>

    <div class="tags-actions-row">
      <div class="tags-scroll">
        <span class="tag city-tag">📍 {{ post.location.city }}</span>

        <span
          v-for="tag in post.tags.category"
          :key="tag"
          class="tag category-tag"
        >
          #{{ tag }}
        </span>

        <span
          v-for="tag in post.tags.context"
          :key="tag"
          class="tag context-tag"
        >
          {{ tag }}
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
          :class="{ active: post.stats.isLiked }"
          @click.stop="emit('toggleLike', post.id)"
        >
          <Icon :icon="post.stats.isLiked ? 'mdi:heart' : 'mdi:heart-outline'" />
          <span>{{ post.stats.likes }}</span>
        </button>

        <button
          class="action-btn save-btn"
          :class="{ active: post.stats.isSaved }"
          @click.stop="emit('toggleSave', post.id)"
        >
          <Icon :icon="post.stats.isSaved ? 'mdi:bookmark' : 'mdi:bookmark-outline'" />
          <span>{{ post.stats.isSaved ? 'Сохранено' : 'Хочу' }}</span>
        </button>
      </div>

      <button class="mini-map-btn" @click.stop="emit('clickLocation', post.location)">
        <span class="address-text">{{ post.location.address }}</span>
        <div class="map-icon-box">
          <Icon icon="mdi:map" />
        </div>
      </button>
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

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background-color: var(--post-card-accent);
    opacity: 0.6;
    z-index: 10;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--s-l);
  }
}

.card-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--bg-primary-color);
}

.author-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.meta {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
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
}

.media-scroller {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  width: 100%;
  height: 100%;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.media-item {
  flex: 0 0 100%;
  scroll-snap-align: start;
  position: relative;
  width: 100%;
  height: 100%;
}

.media-image {
  width: 100%;
  height: 100%;
}

.smart-mark {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 5;
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
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
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

.media-dots {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  z-index: 3;
}

.dot {
  width: 6px;
  height: 6px;
  background-color: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  transition: all 0.2s;

  &.active {
    background-color: white;
    transform: scale(1.2);
  }
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

.rating-emoji {
  font-size: 1.5rem;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
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
  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  border: 1px solid var(--border-primary-color);
  font-weight: 700;
}

.category-tag {
  background-color: rgba(var(--fg-accent-color-rgb), 0.1);
  color: var(--fg-accent-color);
}

.context-tag {
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
}

.insight-block {
  margin: 12px 16px;
  padding: 12px;
  background-color: rgba(var(--bg-accent-color-rgb), 0.3);
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

.mini-map-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-full);
  padding: 4px 4px 4px 12px;
  cursor: pointer;
  transition: all 0.2s;
  max-width: 140px;

  &:hover {
    border-color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }
}

.address-text {
  font-size: 0.75rem;
  color: var(--fg-secondary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.map-icon-box {
  width: 28px;
  height: 28px;
  background-color: var(--bg-tertiary-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-accent-color);
  font-size: 0.9rem;
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
