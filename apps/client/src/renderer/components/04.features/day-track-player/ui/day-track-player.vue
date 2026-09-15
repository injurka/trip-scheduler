<script setup lang="ts">
import type { DayPoint, TrackPhoto, ViewMode } from '../models/types'
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { Memory } from '~/shared/types/models/memory'
import { Icon } from '@iconify/vue'
import { computed, getCurrentInstance, ref, toRef } from 'vue'
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitImageViewer, useImageViewer } from '~/components/01.kit/kit-image-viewer'
import { AppRouteNames } from '~/shared/constants/routes'
import { useDayTrackData } from '../composables/use-day-track-data'
import { useDayTrackMap } from '../composables/use-day-track-map'
import { useDayTrackPhotos } from '../composables/use-day-track-photos'
import { useDayTrackPlayback } from '../composables/use-day-track-playback'
import { useDayTrackTimezone } from '../composables/use-day-track-timezone'
import DayTrackBeacon from './day-track-beacon.vue'
import DayTrackEmpty from './day-track-empty.vue'
import DayTrackOverlayState from './day-track-overlay-state.vue'
import DayTrackPhotoPopup from './day-track-photo-popup.vue'
import DayTrackPlaybackPanel from './day-track-playback-panel.vue'
import DayTrackPointPopup from './day-track-point-popup.vue'
import DayTrackTopNav from './day-track-top-nav.vue'

const props = withDefaults(defineProps<{
  dayUtc?: string
  showBackButton?: boolean
  showTodayButton?: boolean
  memories?: Memory[]
  galleryImages?: ImageViewerImage[]
}>(), {
  showBackButton: true,
  showTodayButton: true,
  memories: () => [],
  galleryImages: () => [],
})

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'close'): void
}>()

const router = useRouter()
const instance = getCurrentInstance()

const mapHost = ref<HTMLElement | null>(null)
const popupHost = ref<HTMLElement | null>(null)
const photoPopupHost = ref<HTMLElement | null>(null)
const playbackMarkerHost = ref<HTMLElement | null>(null)
const viewMode = ref<ViewMode>('route')

// ─── 1. Данные дня ─────────────────────────────────────────────────────────────
const {
  todayUtc,
  selectedDay,
  isLoading,
  dayData,
  loadError,
  isDeletingPoint,
  renderSegments,
  totalPointsCount,
  displayPoints,
  displayPointsCount,
  dayStart,
  dayEnd,
  loadDay,
  changeDay,
  selectDay,
  goToToday,
  formatHeaderDay,
  handleDeletePoint,
} = useDayTrackData({
  dayUtcProp: toRef(props, 'dayUtc'),
})

// ─── 2. Фотографии дня и соотнесение координат ─────────────────────────────────
const {
  isPhotosVisible,
  locatedPhotos,
  unlocatedPhotos,
  totalPhotosCount,
  timelinePhotoMarkers,
  selectedPhoto,
  selectedClusterPhotos,
  selectPhoto,
  selectCluster,
  closePhotoPopup,
} = useDayTrackPhotos({
  memories: toRef(props, 'memories'),
  galleryImages: toRef(props, 'galleryImages'),
  dayData,
  dayStart,
  dayEnd,
})

// ─── 3. Воспроизведение трека ──────────────────────────────────────────────────
const playback = useDayTrackPlayback({
  selectedDay,
  dayStart,
  dayEnd,
  dayData,
  renderSegments,
})

// ─── 4. Часовые пояса и форматирование времени ─────────────────────────────────
const timezone = useDayTrackTimezone({
  currentPoint: playback.currentPoint,
  dayData,
  t: playback.t,
})

// ─── 5. Карта и интерактивные слои ─────────────────────────────────────────────
const map = useDayTrackMap({
  mapHost,
  popupHost,
  playbackMarkerHost,
  dayData,
  displayPoints,
  renderSegments,
  currentPoint: playback.currentPoint,
  currentActivityColor: playback.currentActivityColor,
  t: playback.t,
  isPlaying: playback.isPlaying,
  isFollowCamera: playback.isFollowCamera,
  viewMode,
  photoPopupHost,
  locatedPhotos,
  isPhotosVisible,
  onSelectPhoto: (p: TrackPhoto | null) => {
    selectPhoto(p)
  },
  onSelectCluster: (photos: TrackPhoto[]) => {
    selectCluster(photos)
  },
})

// ─── 6. Полноэкранный просмотр фотографий ─────────────────────────────────────
const imageViewer = useImageViewer()

const viewerImages = computed<ImageViewerImage[]>(() => {
  if (props.galleryImages && props.galleryImages.length > 0)
    return props.galleryImages

  return locatedPhotos.value.map(p => ({
    url: p.imageUrl,
    variants: { small: p.thumbnailUrl, large: p.imageUrl },
    alt: p.title || p.comment || 'Фото дня',
    caption: p.comment || null,
    meta: {
      memoryId: p.memoryId,
      takenAt: new Date(p.tsUtc).toISOString(),
      latitude: p.lat,
      longitude: p.lng,
    },
  }))
})

function handleOpenViewer(photo: TrackPhoto) {
  const list = viewerImages.value
  if (list.length === 0)
    return
  const idx = list.findIndex(img => (img.meta as any)?.memoryId === photo.memoryId || img.url === photo.imageUrl)
  imageViewer.open(list, idx !== -1 ? idx : 0)
}

function handleBack() {
  emit('back')
  emit('close')
  if (!instance?.vnode.props?.onBack && !instance?.vnode.props?.onClose) {
    if (window.history.length > 1) {
      router.back()
    }
    else {
      router.push({ name: AppRouteNames.ActivityTracking })
    }
  }
}

async function onDeletePoint(pt: DayPoint) {
  await handleDeletePoint(pt, () => {
    map.closePointPopup()
    map.rebuildFeatures()
  })
}
</script>

<template>
  <div class="memories-player">
    <!-- Верхняя плавающая панель навигации по дням -->
    <DayTrackTopNav
      :selected-day="selectedDay"
      :today-utc="todayUtc"
      :header-day-title="formatHeaderDay(selectedDay)"
      :view-mode="viewMode"
      :total-points-count="totalPointsCount"
      :display-points-count="displayPointsCount"
      :total-photos-count="totalPhotosCount"
      :located-photos-count="locatedPhotos.length"
      :unlocated-photos-count="unlocatedPhotos.length"
      :is-photos-visible="isPhotosVisible"
      :is-fit-disabled="renderSegments.length === 0 && totalPointsCount === 0 && locatedPhotos.length === 0"
      :show-today-button="showTodayButton"
      @change-day="changeDay"
      @select-day="selectDay"
      @go-to-today="goToToday"
      @update:view-mode="viewMode = $event"
      @update:is-photos-visible="isPhotosVisible = $event"
      @fit-bounds="map.fitTrackBounds"
    >
      <template #top-actions>
        <slot name="top-actions" />
      </template>
    </DayTrackTopNav>

    <!-- Круглая плавающая кнопка закрытия над картой -->
    <KitBtn
      v-if="showBackButton"
      variant="tonal"
      size="sm"
      class="nav-btn close-btn floating-close-btn"
      title="Закрыть"
      aria-label="Закрыть"
      @click="handleBack"
    >
      <Icon icon="mdi:close" />
    </KitBtn>

    <!-- Контейнер карты OpenLayers -->
    <div ref="mapHost" class="memories-map" />

    <!-- Анимированный маркер воспроизведения на карте -->
    <div ref="playbackMarkerHost">
      <DayTrackBeacon
        :is-active="playback.currentPoint.value != null"
        :activity-color="playback.currentActivityColor.value"
        :activity-icon="playback.currentActivityIcon.value"
        :speed-kmh="playback.speedKmhFromPoints.value"
      />
    </div>

    <!-- Интерактивный попап инспекции точки -->
    <div ref="popupHost">
      <DayTrackPointPopup
        :selected-point="map.selectedPoint.value"
        :timezone-mode="timezone.timezoneMode.value"
        :formatted-time="map.selectedPoint.value ? timezone.formatPointTime(map.selectedPoint.value.point.tsUtc, map.selectedPoint.value.point) : ''"
        :formatted-end-time="map.selectedPoint.value?.point.stop ? timezone.formatPointTime(map.selectedPoint.value.point.stop.endedAt, map.selectedPoint.value.point) : ''"
        :is-copied="map.isCopied.value"
        :is-deleting="isDeletingPoint"
        :status-badge="map.selectedPoint.value ? map.getPointStatusBadge(map.selectedPoint.value.point) : null"
        @copy="map.copyCoords"
        @delete="onDeletePoint"
        @close="map.closePointPopup"
      />
    </div>

    <!-- Интерактивный попап инспекции фото -->
    <div ref="photoPopupHost">
      <DayTrackPhotoPopup
        :photo="selectedPhoto"
        :cluster-photos="selectedClusterPhotos"
        :timezone-mode="timezone.timezoneMode.value"
        :track-timezone="timezone.trackTimezone.value"
        @open-viewer="handleOpenViewer"
        @close="() => { closePhotoPopup(); map.closePhotoPopup(); }"
      />
    </div>

    <!-- Оверлей загрузки / ошибки -->
    <DayTrackOverlayState
      :is-loading="isLoading"
      :load-error="loadError"
      :selected-day="selectedDay"
      @retry="loadDay"
    />

    <!-- Пустое состояние для дня без треков и без фото -->
    <DayTrackEmpty
      v-if="!isLoading && !loadError && renderSegments.length === 0 && totalPointsCount === 0 && locatedPhotos.length === 0"
      :selected-day="selectedDay"
      :today-utc="todayUtc"
      :show-today-button="showTodayButton"
      @go-to-today="goToToday"
      @go-to-list="router.push({ name: AppRouteNames.ActivityTracking })"
    />

    <!-- Нижняя панель плеера -->
    <DayTrackPlaybackPanel
      v-if="renderSegments.length > 0 || totalPointsCount > 0 || locatedPhotos.length > 0"
      v-model:t="playback.t.value"
      v-model:is-playing="playback.isPlaying.value"
      v-model:speed-multiplier="playback.speedMultiplier.value"
      v-model:is-follow-camera="playback.isFollowCamera.value"
      :time-label="timezone.timeLabel.value"
      :timezone-mode="timezone.timezoneMode.value"
      :device-timezone="timezone.deviceTimezone"
      :track-timezone="timezone.trackTimezone.value"
      :current-segment="playback.currentSegment.value"
      :current-activity="playback.currentActivity.value"
      :current-activity-color="playback.currentActivityColor.value"
      :current-activity-icon="playback.currentActivityIcon.value"
      :current-activity-label="playback.currentActivityLabel.value"
      :speed-kmh="playback.speedKmhFromPoints.value"
      :display-points-count="displayPointsCount"
      :total-points-count="totalPointsCount"
      :day-start="dayStart"
      :day-end="dayEnd"
      :day-start-formatted="timezone.fmtRange(dayStart)"
      :day-end-formatted="timezone.fmtRange(dayEnd)"
      :render-segments="renderSegments"
      :photo-markers="timelinePhotoMarkers"
      :time-range-formatted="`${timezone.fmtRange(dayStart)} – ${timezone.fmtRange(dayEnd)}`"
      @toggle-timezone="timezone.toggleTimezone"
      @step-seconds="playback.stepSeconds"
      @skip-to-prev-movement="playback.skipToPrevMovement"
      @skip-to-next-movement="playback.skipToNextMovement"
      @seek-start="playback.t.value = dayStart"
      @seek-end="playback.t.value = dayEnd"
      @seek-photo="(ts) => { playback.t.value = ts }"
    />

    <!-- Полноэкранный просмотрщик фотографий -->
    <KitImageViewer
      v-if="imageViewer.isOpen.value"
      v-model:visible="imageViewer.isOpen.value"
      v-model:current-index="imageViewer.currentIndex.value"
      :images="imageViewer.images.value"
      :close-on-overlay-click="true"
    />
  </div>
</template>

<style scoped lang="scss">
.memories-player {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .memories-map {
    flex: 1;
    min-height: 0;
    width: 100%;
    border-radius: var(--r-l, 16px) var(--r-l, 16px) 0 0;
  }

  .floating-close-btn {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 21;
    border-radius: var(--r-full);
  }

  :deep(.day-track-photo-marker) {
    position: relative;
    cursor: pointer;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 2.5px solid #ffffff;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35);
    background: var(--bg-primary-color, #ffffff);
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      transform: scale(1.18);
      z-index: 50;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
    }

    &.is-playback-active {
      transform: scale(1.22);
      border-color: #f59e0b;
      box-shadow:
        0 0 0 4px rgba(245, 158, 11, 0.45),
        0 6px 16px rgba(0, 0, 0, 0.4);
      z-index: 60;
    }

    .photo-marker-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
      display: block;
      pointer-events: none;
    }

    .photo-marker-badge {
      position: absolute;
      top: -4px;
      right: -6px;
      background: var(--fg-accent-color, #2563eb);
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      border-radius: 999px;
      padding: 0 5px;
      border: 1.5px solid #ffffff;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
      line-height: 16px;
      pointer-events: none;
    }

    .photo-marker-source-icon {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 15px;
      height: 15px;
      border-radius: 50%;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
      pointer-events: none;
    }
  }

  :deep(.maplibregl-popup.day-track-photo-popup) {
    .maplibregl-popup-content {
      padding: 0;
      background: transparent;
      box-shadow: none;
      border: none;
    }
    .maplibregl-popup-tip {
      border-top-color: var(--bg-primary-color);
    }
  }

  @media (max-width: 640px) {
    .floating-close-btn {
      top: 8px;
      right: 8px;
    }
  }
}
</style>
