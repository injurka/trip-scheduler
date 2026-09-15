<script setup lang="ts">
import type { TimezoneMode, TrackPhoto } from '../models/types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  photo?: TrackPhoto | null
  clusterPhotos?: TrackPhoto[]
  timezoneMode?: TimezoneMode
  trackTimezone?: string
}>(), {
  photo: null,
  clusterPhotos: () => [],
  timezoneMode: 'track',
  trackTimezone: undefined,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'openViewer', photo: TrackPhoto): void
}>()

const isCluster = computed(() => props.clusterPhotos && props.clusterPhotos.length > 1)
const activePhotos = computed(() => isCluster.value ? props.clusterPhotos : (props.photo ? [props.photo] : []))
const primaryPhoto = computed(() => activePhotos.value[0] || null)

function formatTime(tsUtc: number): string {
  if (!tsUtc)
    return ''
  const tz = props.timezoneMode === 'track' ? props.trackTimezone : undefined
  return new Date(tsUtc).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    ...(tz ? { timeZone: tz } : {}),
  })
}

function getSourceBadge(source: TrackPhoto['source']) {
  switch (source) {
    case 'gps':
      return {
        label: 'GPS из фото',
        icon: 'mdi:satellite-variant',
        class: 'source-gps',
      }
    case 'interpolated':
      return {
        label: 'По времени трека',
        icon: 'mdi:map-marker-path',
        class: 'source-interpolated',
      }
    case 'stop':
      return {
        label: 'На стоянке',
        icon: 'mdi:motion-pause-outline',
        class: 'source-stop',
      }
    default:
      return {
        label: 'Локация',
        icon: 'mdi:map-marker',
        class: 'source-default',
      }
  }
}
</script>

<template>
  <div v-if="primaryPhoto" class="photo-popup-card">
    <div class="popup-header">
      <div class="header-left">
        <span class="popup-time">
          <Icon icon="mdi:clock-outline" class="time-icon" />
          {{ formatTime(primaryPhoto.tsUtc) }}
        </span>
        <span
          class="source-chip"
          :class="getSourceBadge(primaryPhoto.source).class"
          :title="getSourceBadge(primaryPhoto.source).label"
        >
          <Icon :icon="getSourceBadge(primaryPhoto.source).icon" />
          <span class="chip-text">{{ getSourceBadge(primaryPhoto.source).label }}</span>
        </span>
      </div>

      <button
        class="popup-close-btn"
        type="button"
        title="Закрыть"
        aria-label="Закрыть"
        @click="emit('close')"
      >
        <Icon icon="mdi:close" />
      </button>
    </div>

    <!-- Режим одной фотографии -->
    <div v-if="!isCluster" class="single-photo-content" @click="emit('openViewer', primaryPhoto)">
      <div class="photo-preview-wrap">
        <img
          :src="primaryPhoto.thumbnailUrl"
          :alt="primaryPhoto.title || primaryPhoto.comment || 'Фото'"
          class="photo-img"
          loading="lazy"
        >
        <div class="photo-expand-hint">
          <Icon icon="mdi:fullscreen" />
        </div>
      </div>

      <div v-if="primaryPhoto.title || primaryPhoto.comment" class="photo-info">
        <h4 v-if="primaryPhoto.title" class="photo-title">
          {{ primaryPhoto.title }}
        </h4>
        <p v-if="primaryPhoto.comment" class="photo-comment">
          {{ primaryPhoto.comment }}
        </p>
      </div>
    </div>

    <!-- Режим кластера (несколько фото в одном месте) -->
    <div v-else class="cluster-photos-content">
      <div class="cluster-badge-row">
        <span class="cluster-count-text">
          <Icon icon="mdi:image-multiple-outline" />
          {{ activePhotos.length }} фото в этой точке
        </span>
      </div>

      <div class="cluster-thumbs-grid">
        <div
          v-for="p in activePhotos"
          :key="p.id"
          class="cluster-thumb-item"
          :title="`Открыть фото (${formatTime(p.tsUtc)})`"
          @click="emit('openViewer', p)"
        >
          <img :src="p.thumbnailUrl" alt="Превью" class="thumb-img" loading="lazy">
          <span class="thumb-time">{{ formatTime(p.tsUtc) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.photo-popup-card {
  position: relative;
  width: 250px;
  max-width: 85vw;
  background: var(--bg-primary-color);
  border-radius: var(--r-l, 14px);
  padding: 10px;
  box-shadow: var(--s-lg, 0 10px 25px -5px rgba(0, 0, 0, 0.35));
  border: 1px solid var(--border-secondary-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
  user-select: none;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .popup-time {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    display: flex;
    align-items: center;
    gap: 3px;

    .time-icon {
      font-size: 0.875rem;
      color: var(--fg-secondary-color);
    }
  }

  .source-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: var(--r-full, 9999px);

    &.source-gps {
      background: rgba(34, 197, 94, 0.15);
      color: #16a34a;
    }

    &.source-interpolated {
      background: rgba(59, 130, 246, 0.15);
      color: #2563eb;
    }

    &.source-stop {
      background: rgba(245, 158, 11, 0.15);
      color: #d97706;
    }

    .chip-text {
      white-space: nowrap;
    }
  }

  .popup-close-btn {
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--fg-secondary-color);
    padding: 3px;
    border-radius: var(--r-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    transition: all 0.15s ease;

    &:hover {
      background: var(--bg-hover-color);
      color: var(--fg-primary-color);
    }
  }
}

.single-photo-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;

  .photo-preview-wrap {
    position: relative;
    width: 100%;
    height: 140px;
    border-radius: var(--r-m, 10px);
    overflow: hidden;
    background: var(--bg-secondary-color);

    .photo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.25s ease;
    }

    .photo-expand-hint {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 26px;
      height: 26px;
      border-radius: var(--r-full);
      background: rgba(0, 0, 0, 0.55);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      backdrop-filter: blur(2px);
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    &:hover {
      .photo-img {
        transform: scale(1.03);
      }
      .photo-expand-hint {
        opacity: 1;
      }
    }
  }

  .photo-info {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .photo-title {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--fg-primary-color);
      margin: 0;
      line-height: 1.2;
    }

    .photo-comment {
      font-size: 0.75rem;
      color: var(--fg-secondary-color);
      margin: 0;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
}

.cluster-photos-content {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .cluster-badge-row {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--fg-secondary-color);

    .cluster-count-text {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  }

  .cluster-thumbs-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px;
    max-height: 150px;
    overflow-y: auto;
    padding-right: 2px;

    .cluster-thumb-item {
      position: relative;
      aspect-ratio: 1;
      border-radius: var(--r-s, 6px);
      overflow: hidden;
      cursor: pointer;
      background: var(--bg-secondary-color);

      .thumb-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.2s ease;
      }

      .thumb-time {
        position: absolute;
        bottom: 2px;
        left: 2px;
        right: 2px;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        font-size: 0.625rem;
        padding: 1px 2px;
        border-radius: 3px;
        text-align: center;
        backdrop-filter: blur(2px);
      }

      &:hover .thumb-img {
        transform: scale(1.08);
      }
    }
  }
}

.popup-footer {
  display: flex;
  justify-content: stretch;

  .view-fullscreen-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
