<script setup lang="ts">
import type { DayPoint, ViewMode } from '../models/types'
import { Icon } from '@iconify/vue'
import { getCurrentInstance, ref, toRef } from 'vue'
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { AppRouteNames } from '~/shared/constants/routes'
import { useDayTrackData } from '../composables/use-day-track-data'
import { useDayTrackMap } from '../composables/use-day-track-map'
import { useDayTrackPlayback } from '../composables/use-day-track-playback'
import { useDayTrackTimezone } from '../composables/use-day-track-timezone'
import DayTrackBeacon from './day-track-beacon.vue'
import DayTrackEmpty from './day-track-empty.vue'
import DayTrackOverlayState from './day-track-overlay-state.vue'
import DayTrackPlaybackPanel from './day-track-playback-panel.vue'
import DayTrackPointPopup from './day-track-point-popup.vue'
import DayTrackTopNav from './day-track-top-nav.vue'

const props = withDefaults(defineProps<{
  dayUtc?: string
  showBackButton?: boolean
}>(), {
  showBackButton: true,
})

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'close'): void
}>()

const router = useRouter()
const instance = getCurrentInstance()

const mapHost = ref<HTMLElement | null>(null)
const popupHost = ref<HTMLElement | null>(null)
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
  goToToday,
  formatHeaderDay,
  handleDeletePoint,
} = useDayTrackData({
  dayUtcProp: toRef(props, 'dayUtc'),
})

// ─── 2. Воспроизведение трека ──────────────────────────────────────────────────
const playback = useDayTrackPlayback({
  selectedDay,
  dayStart,
  dayEnd,
  dayData,
  renderSegments,
})

// ─── 3. Часовые пояса и форматирование времени ─────────────────────────────────
const timezone = useDayTrackTimezone({
  currentPoint: playback.currentPoint,
  dayData,
  t: playback.t,
})

// ─── 4. Карта и интерактивные слои ─────────────────────────────────────────────
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
})

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
      :is-fit-disabled="renderSegments.length === 0 && totalPointsCount === 0"
      @change-day="changeDay"
      @go-to-today="goToToday"
      @update:view-mode="viewMode = $event"
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
        :is-copied="map.isCopied.value"
        :is-deleting="isDeletingPoint"
        :status-badge="map.selectedPoint.value ? map.getPointStatusBadge(map.selectedPoint.value.point) : null"
        @copy="map.copyCoords"
        @delete="onDeletePoint"
        @close="map.closePointPopup"
      />
    </div>

    <!-- Оверлей загрузки / ошибки -->
    <DayTrackOverlayState
      :is-loading="isLoading"
      :load-error="loadError"
      :selected-day="selectedDay"
      @retry="loadDay"
    />

    <!-- Пустое состояние для дня без треков -->
    <DayTrackEmpty
      v-if="!isLoading && !loadError && renderSegments.length === 0 && totalPointsCount === 0"
      :selected-day="selectedDay"
      :today-utc="todayUtc"
      @go-to-today="goToToday"
      @go-to-list="router.push({ name: AppRouteNames.ActivityTracking })"
    />

    <!-- Нижняя панель плеера -->
    <DayTrackPlaybackPanel
      v-if="renderSegments.length > 0 || totalPointsCount > 0"
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
      :time-range-formatted="`${timezone.fmtRange(dayStart)} – ${timezone.fmtRange(dayEnd)}`"
      @toggle-timezone="timezone.toggleTimezone"
      @step-seconds="playback.stepSeconds"
      @skip-to-next-movement="playback.skipToNextMovement"
      @seek-start="playback.t.value = dayStart"
      @seek-end="playback.t.value = dayEnd"
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

    :deep(.ol-viewport) {
      border-radius: var(--r-l, 16px) var(--r-l, 16px) 0 0;
    }
  }

  .floating-close-btn {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 21;
    border-radius: var(--r-full);
  }

  @media (max-width: 640px) {
    .floating-close-btn {
      top: 8px;
      right: 8px;
    }
  }
}
</style>
