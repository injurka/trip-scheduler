<script setup lang="ts">
import type { CorrectionChoice } from '../composables/use-track-correction-drafts'
import type { DayPoint, RouteVisibility, TrackPhoto, ViewMode } from '../models/types'
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { Memory } from '~/shared/types/models/memory'
import { Icon } from '@iconify/vue'
import { classificationExplanation, recordingQuality } from '@limiteddissolve/track-processing'
import { useEventListener } from '@vueuse/core'
import { AlertDialogContent, AlertDialogDescription, AlertDialogOverlay, AlertDialogPortal, AlertDialogRoot, AlertDialogTitle, PopoverContent, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, getCurrentInstance, ref, toRef, useId, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitImageViewer, useImageViewer } from '~/components/01.kit/kit-image-viewer'
import { KitSwitch } from '~/components/01.kit/kit-switch'
import { AppRouteNames } from '~/shared/constants/routes'
import { trackingService } from '~/shared/services/database/tracking.service'
import { useAuthStore } from '~/shared/store/auth.store'
import { useDayTrackData } from '../composables/use-day-track-data'
import { useDayTrackMap } from '../composables/use-day-track-map'
import { useDayTrackPhotos } from '../composables/use-day-track-photos'
import { useDayTrackPlayback } from '../composables/use-day-track-playback'
import { useDayTrackTimezone } from '../composables/use-day-track-timezone'
import { useTrackCorrectionDrafts } from '../composables/use-track-correction-drafts'
import { originalTrackView, saveTrackGpx } from '../lib/track-export'
import { upperTimeIndex } from '../lib/track-time-window'
import DayTrackActivityEditor from './day-track-activity-editor.vue'
import DayTrackBeacon from './day-track-beacon.vue'
import DayTrackEmpty from './day-track-empty.vue'
import DayTrackOverlayState from './day-track-overlay-state.vue'
import DayTrackPhotoPopup from './day-track-photo-popup.vue'
import DayTrackPlaybackPanel from './day-track-playback-panel.vue'
import DayTrackPointPopup from './day-track-point-popup.vue'
import DayTrackQuality from './day-track-quality.vue'
import DayTrackTopNav from './day-track-top-nav.vue'

interface Props {
  timeZone?: string
  tripId?: string
  dayUtc?: string
  /**
   * 'memories' — просмотр прожитого дня: маячок воспроизведения («я здесь сейчас»)
   * не показываем, плеер нужен только для фотографий и трека дня.
   */
  mode?: 'track' | 'memories'
  /**
   * Даты дней поездки (YYYY-MM-DD): в этом режиме переключаться можно только между
   * ними, а смена дня сообщается наружу событием `dayChange` — иначе секция
   * воспоминаний остаётся на прежнем дне и фото на карте не меняются.
   */
  dayDates?: string[]
  showBackButton?: boolean
  showTodayButton?: boolean
  memories?: Memory[]
  galleryImages?: ImageViewerImage[]
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'track',
  showBackButton: true,
  showTodayButton: true,
  memories: () => [],
  galleryImages: () => [],
})
const emit = defineEmits<{
  (e: 'back'): void
  (e: 'close'): void
  (e: 'dayChange', day: string): void
}>()
defineExpose({ requestLeave })

const router = useRouter()
const authStore = useAuthStore()
const drafts = useTrackCorrectionDrafts()
const imageViewer = useImageViewer()
const playbackPanelId = useId()

const showOriginal = ref(false)
const originalGpsSwitchId = useId()
const isActivityEditorOpen = ref(false)
const applying = ref(false)

// ─── 1. Данные дня ─────────────────────────────────────────────────────────────
const {
  sourceDayData,
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
  canRefresh: () => !isActivityEditorOpen.value && !applying.value && !drafts.count.value && !drafts.processing.value,
  preview: data => showOriginal.value ? originalTrackView(data) : drafts.preview(data),
  beforeChange: requestLeave,
  onRejectedChange: () => emit('dayChange', selectedDay.value),
  tripId: toRef(props, 'tripId'),
  timeZone: toRef(props, 'timeZone'),
  dayUtcProp: toRef(props, 'dayUtc'),
  availableDays: toRef(props, 'dayDates'),
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

const exporting = ref(false)
const exportStatus = ref('')
const draftTripId = ref(props.tripId)
const committed = ref(false)
const draftError = ref('')
const leaveOpen = ref(false)
let leaveResult: Promise<boolean> | null = null
let resolveLeave: ((value: boolean) => void) | null = null
const instance = getCurrentInstance()
const mapHost = ref<HTMLElement | null>(null)
const popupHost = ref<HTMLElement | null>(null)
const photoPopupHost = ref<HTMLElement | null>(null)
const playbackMarkerHost = ref<HTMLElement | null>(null)
const viewMode = ref<ViewMode>('route')
const isPlaybackPanelVisible = ref(true)
const routeVisibility = ref<RouteVisibility>('full')
const trailMinutes = ref(15)

// ─── 5. Карта и интерактивные слои ─────────────────────────────────────────────
const map = useDayTrackMap({
  selectedDay,
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
  routeVisibility,
  trailMinutes,
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

const activityEditorTime = ref(0)

// ─── 6. Полноэкранный просмотр фотографий ─────────────────────────────────────
const quality = computed(() => recordingQuality(sourceDayData.value?.rawPoints ?? [], drafts.preview(sourceDayData.value ?? { points: [], segments: [] }).corrections ?? []))
const currentExplanation = computed(() => {
  const point = playback.currentPoint.value

  if (!point)
    return 'Нет GPS-точки в выбранное время.'

  if (point.activitySource === 'manual')
    return 'Тип движения исправлен вручную.'

  const raw = sourceDayData.value?.rawPoints ?? []
  const index = upperTimeIndex(raw, point.tsUtc) - 1

  return classificationExplanation(point, raw[index - 1], raw[index + 1])
})
const canEditTrack = computed(() => !showOriginal.value && (!props.tripId || (authStore.isAuthenticated && dayData.value?.canEdit === true)))
// Маячок воспроизведения — маркер «я здесь сейчас». В режиме воспоминаний
// (просмотр прожитого дня) он читается как текущая геопозиция, поэтому скрыт.
const isBeaconVisible = computed(() => props.mode !== 'memories')
const viewerImages = computed<ImageViewerImage[]>(() => {
  if (props.galleryImages && props.galleryImages.length > 0)
    return props.galleryImages

  return locatedPhotos.value.map(p => ({
    url: p.imageUrl,
    variants: {
      small: p.thumbnailUrl,
      large: p.imageUrl,
      ...(p.thumbhash ? { thumbhash: p.thumbhash } : {}),
    },
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

watch(sourceDayData, () => drafts.clear(), { flush: 'sync' })

async function exportGpx() {
  const data = sourceDayData.value

  if (!data || exporting.value)
    return

  exporting.value = true
  exportStatus.value = ''

  try {
    exportStatus.value = await saveTrackGpx(selectedDay.value, data.rawPoints ?? data.points, drafts.preview(data).points)
  }
  catch (error) { draftError.value = error instanceof Error ? error.message : 'Не удалось сохранить GPX' }
  finally { exporting.value = false }
}
function currentCorrectionIds(data: NonNullable<typeof sourceDayData.value>, point: DayPoint) {
  const segment = playback.currentSegment.value
  const from = segment?.t0 ?? point.tsUtc
  const to = segment?.t1 ?? point.tsUtc

  return (drafts.preview(data).corrections ?? []).filter(c => c.sessionId === point.sessionId && c.startedAt <= to && c.endedAt >= from).map(c => c.id)
}
async function resetCurrentCorrections() {
  const point = playback.currentPoint.value
  const data = sourceDayData.value

  if (!point || !data || !canEditTrack.value || applying.value || drafts.processing.value)
    return

  try {
    await drafts.removeMany(currentCorrectionIds(data, point), data)
  }
  catch (error) { draftError.value = error instanceof Error ? error.message : 'Не удалось сбросить правки' }
}
function seekQualityIssue(issue: { startedAt: number, endedAt: number }, close: () => void) {
  playback.isPlaying.value = false
  playback.t.value = issue.startedAt
  map.centerCurrentPoint()
  close()
}
function handleOpenViewer(photo: TrackPhoto) {
  const list = viewerImages.value

  if (list.length === 0)
    return

  const idx = list.findIndex(img => (img.meta)?.memoryId === photo.memoryId || img.url === photo.imageUrl)
  imageViewer.open(list, idx !== -1 ? idx : 0)
}
/**
 * Смена дня внутри плеера должна уехать наверх: в секции поездки день выбирается
 * стором плана, и без события воспоминания (а с ними и фото) остаются на прежнем дне.
 */
async function handleChangeDay(offset: number) {
  if (!await requestLeave())
    return

  const before = selectedDay.value
  changeDay(offset)

  if (selectedDay.value !== before)
    emit('dayChange', selectedDay.value)
}
async function handleSelectDay(day: string) {
  if (!await requestLeave())
    return

  const before = selectedDay.value
  selectDay(day)

  if (selectedDay.value !== before)
    emit('dayChange', selectedDay.value)
}
async function handleGoToToday() {
  if (!await requestLeave())
    return

  const before = selectedDay.value
  goToToday()

  if (selectedDay.value !== before)
    emit('dayChange', selectedDay.value)
}
async function handleBack() {
  if (!await requestLeave())
    return

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
function followCurrentPoint() {
  playback.isFollowCamera.value = !playback.isFollowCamera.value

  if (playback.isFollowCamera.value)
    map.centerCurrentPoint()
}
function editActivity(time = playback.t.value) {
  if (!canEditTrack.value || applying.value || committed.value || drafts.processing.value)
    return

  playback.isPlaying.value = false
  activityEditorTime.value = time
  isActivityEditorOpen.value = true
}
async function onDeletePoint(pt: DayPoint) {
  if (!canEditTrack.value)
    return

  if (!await requestLeave())
    return

  await handleDeletePoint(pt, () => {
    map.closePointPopup()
    map.rebuildFeatures()
  })
}
async function stageCorrection(choice: CorrectionChoice) {
  if (applying.value || committed.value || drafts.processing.value)
    throw new Error('Дождитесь завершения текущей операции')

  try {
    const pending = sourceDayData.value?.rawPoints?.some(p => p.localPending && p.sessionId === choice.sessionId && p.tsUtc >= choice.startedAt && p.tsUtc <= choice.endedAt)

    if (pending)
      throw new Error('Сначала отправьте GPS-точки выбранного участка на сервер.')

    if (!drafts.count.value)
      draftTripId.value = props.tripId

    await drafts.stage(choice, sourceDayData.value)
    map.closePointPopup()
    draftError.value = ''
  }
  catch (error) {
    draftError.value = error instanceof Error ? error.message : 'Не удалось добавить правку'
    throw error
  }
}
async function removeCorrection(id: string) {
  if (applying.value || committed.value || drafts.processing.value)
    throw new Error('Дождитесь завершения текущей операции')

  try {
    if (!drafts.count.value)
      draftTripId.value = props.tripId

    await drafts.remove(id, sourceDayData.value)
    draftError.value = ''
  }
  catch (error) {
    draftError.value = error instanceof Error ? error.message : 'Не удалось отменить исправление'
    throw error
  }
}
function discardDrafts() {
  if (applying.value || drafts.processing.value)
    return

  clearDrafts()
}
function clearDrafts() {
  drafts.clear()
  committed.value = false
  draftError.value = ''
}
async function applyDrafts(): Promise<boolean> {
  if (applying.value || drafts.processing.value)
    return false

  applying.value = true
  playback.isPlaying.value = false
  draftError.value = ''

  try {
    if (!committed.value) {
      drafts.markSubmitted()
      await trackingService.correctActivities({
        tripId: draftTripId.value,
        dayUtc: selectedDay.value,
        timeZone: dayData.value?.timeZone,
        additions: drafts.additions.value,
        removals: drafts.removals.value,
      })
      committed.value = true
    }

    if (!await loadDay(selectedDay.value))
      throw new Error('Правки сохранены. Не удалось загрузить трек — повторите загрузку.')

    clearDrafts()
    map.closePointPopup()

    return true
  }
  catch (error) {
    draftError.value = error instanceof Error ? error.message : 'Не удалось применить изменения'

    return false
  }
  finally {
    applying.value = false
  }
}
function resolveNavigation(result: boolean) {
  leaveOpen.value = false
  resolveLeave?.(result)
  resolveLeave = null
  leaveResult = null
}
function requestLeave(): Promise<boolean> {
  if (applying.value || drafts.processing.value)
    return Promise.resolve(false)

  if (committed.value) {
    clearDrafts()

    return Promise.resolve(true)
  }

  if (!drafts.count.value)
    return Promise.resolve(true)

  if (leaveResult)
    return leaveResult

  playback.isPlaying.value = false
  leaveOpen.value = true
  leaveResult = new Promise((resolve) => {
    resolveLeave = resolve
  })

  return leaveResult
}
async function applyAndLeave() {
  if (await applyDrafts())
    resolveNavigation(true)
}
function discardAndLeave() {
  discardDrafts()
  resolveNavigation(true)
}

onBeforeRouteLeave((to, from) => to.fullPath === from.fullPath || requestLeave())
onBeforeRouteUpdate((to, from) => to.fullPath === from.fullPath || requestLeave())
useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
  if (drafts.count.value) {
    event.preventDefault()
    event.returnValue = ''
  }
})
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
      :has-track="renderSegments.length > 0 || totalPointsCount > 0"
      :days="dayDates"
      :show-today-button="showTodayButton && mode !== 'memories'"
      :show-day-picker="mode !== 'memories'"
      @change-day="handleChangeDay"
      @select-day="handleSelectDay"
      @go-to-today="handleGoToToday"
      @update:view-mode="viewMode = $event"
      @update:is-photos-visible="isPhotosVisible = $event"
    >
      <template #map-controls>
        <button
          type="button"
          class="track-follow-btn"
          :aria-pressed="playback.isFollowCamera.value"
          aria-label="Слежение за текущей точкой"
          title="Следить за текущей точкой"
          @click="followCurrentPoint"
        >
          <Icon :icon="playback.isFollowCamera.value ? 'mdi:crosshairs-gps' : 'mdi:crosshairs'" />
        </button>
        <button
          v-if="renderSegments.length > 0 || totalPointsCount > 0"
          type="button"
          class="track-follow-btn playback-visibility-btn"
          :aria-pressed="isPlaybackPanelVisible"
          :aria-label="isPlaybackPanelVisible ? 'Скрыть плеер' : 'Показать плеер'"
          :title="isPlaybackPanelVisible ? 'Скрыть плеер' : 'Показать плеер'"
          :aria-controls="playbackPanelId"
          @click="isPlaybackPanelVisible = !isPlaybackPanelVisible"
        >
          <Icon :icon="isPlaybackPanelVisible ? 'mdi:eye-outline' : 'mdi:eye-off-outline'" />
        </button>
        <PopoverRoot v-if="dayData?.localPendingCount || dayData?.localError">
          <PopoverTrigger as-child>
            <button type="button" class="track-follow-btn queue-status-btn" aria-label="Синхронизация GPS">
              <Icon :icon="dayData.localError ? 'mdi:cloud-alert-outline' : 'mdi:cloud-upload-outline'" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            as-child
            position-strategy="absolute"
            align="end"
            :side-offset="8"
            :collision-padding="12"
          >
            <div class="queue-status-popover" aria-label="Синхронизация GPS">
              <strong>Синхронизация GPS</strong>
              <div v-if="dayData.localPendingCount">
                Точек к отправке: {{ dayData.localPendingCount }}
              </div>
              <div v-if="dayData.localError" role="status">
                {{ dayData.localError }}
              </div>
            </div>
          </PopoverContent>
        </PopoverRoot>
      </template>
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
    <div v-if="isBeaconVisible" ref="playbackMarkerHost" class="playback-marker-host">
      <DayTrackBeacon
        :is-active="playback.currentPoint.value != null"
        :activity-color="playback.currentActivityColor.value"
        :activity-icon="playback.currentActivityIcon.value"
        :speed-kmh="playback.speedKmhFromPoints.value"
      />
    </div>

    <!-- Интерактивный попап инспекции точки -->
    <div ref="popupHost" class="point-popup-host">
      <DayTrackPointPopup
        :selected-point="map.selectedPoint.value"
        :readonly="!canEditTrack"
        :timezone-mode="timezone.timezoneMode.value"
        :formatted-time="map.selectedPoint.value ? timezone.formatPointTime(map.selectedPoint.value.point.tsUtc, map.selectedPoint.value.point) : ''"
        :formatted-end-time="map.selectedPoint.value?.point.stop ? timezone.formatPointTime(map.selectedPoint.value.point.stop.endedAt, map.selectedPoint.value.point) : ''"
        :is-copied="map.isCopied.value"
        :is-deleting="isDeletingPoint"
        :status-badge="map.selectedPoint.value ? map.getPointStatusBadge(map.selectedPoint.value.point) : null"
        @copy="map.copyCoords"
        @delete="onDeletePoint"
        @edit-activity="editActivity($event.tsUtc)"
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
      @go-to-today="handleGoToToday"
      @go-to-list="router.push({ name: AppRouteNames.ActivityTracking })"
    />

    <!-- Нижняя панель плеера: только для дней с GPS-треком. В день из одних
         воспоминаний таймлайн пуст («--:--», выключенный ползунок) и бесполезен -->
    <DayTrackPlaybackPanel
      v-if="isPlaybackPanelVisible && (renderSegments.length > 0 || totalPointsCount > 0)"
      :id="playbackPanelId"
      v-model:route-visibility="routeVisibility"
      v-model:trail-minutes="trailMinutes"
      v-model:t="playback.t.value"
      v-model:is-playing="playback.isPlaying.value"
      v-model:speed-multiplier="playback.speedMultiplier.value"
      v-model:is-follow-camera="playback.isFollowCamera.value"
      :readonly="!canEditTrack"
      :time-label="timezone.timeLabel.value"
      :timezone-mode="timezone.timezoneMode.value"
      :device-timezone="timezone.deviceTimezone"
      :track-timezone="timezone.trackTimezone.value"
      :current-segment="playback.currentSegment.value"
      :current-activity="playback.currentActivity.value"
      :confidence="playback.currentPoint.value?.activityConfidence"
      :explanation="currentExplanation"
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
      @edit-activity="editActivity()"
      @toggle-timezone="timezone.toggleTimezone"
      @step-seconds="playback.stepSeconds"
      @skip-to-prev-movement="playback.skipToPrevMovement"
      @skip-to-next-movement="playback.skipToNextMovement"
      @seek-start="playback.t.value = dayStart"
      @seek-end="playback.t.value = dayEnd"
      @seek-photo="(ts) => { playback.t.value = ts }"
    >
      <template #quality="{ close }">
        <DayTrackQuality :quality="quality" :time-zone="dayData?.timeZone" @seek="seekQualityIssue($event, close)">
          <label class="quality-gps-toggle" :for="originalGpsSwitchId">
            Исходные GPS-точки
            <KitSwitch :id="originalGpsSwitchId" v-model="showOriginal" size="sm" />
          </label>
          <div class="quality-actions">
            <KitBtn
              size="sm"
              variant="text"
              color="secondary"
              :disabled="exporting"
              title="Экспорт исходного и обработанного треков"
              @click="exportGpx"
            >
              <Icon icon="mdi:download-outline" />
              Экспорт GPX
            </KitBtn>
            <KitBtn
              v-if="canEditTrack"
              size="sm"
              variant="text"
              color="secondary"
              :disabled="drafts.processing.value || applying"
              title="Сбросить правки текущего участка"
              @click="resetCurrentCorrections"
            >
              Сбросить правки
            </KitBtn>
          </div>
          <p v-if="exportStatus" role="status">
            {{ exportStatus }}
          </p>
          <p v-if="draftError" role="alert">
            {{ draftError }}
          </p>
        </DayTrackQuality>
      </template>
      <template #draft-actions>
        <div v-if="drafts.count.value" class="draft-toolbar" :aria-busy="applying">
          <span role="status">{{ committed ? 'Сохранено' : `Изменений: ${drafts.count.value}` }}</span>
          <KitBtn
            size="sm"
            variant="text"
            :disabled="applying"
            @click="discardDrafts"
          >
            Отменить
          </KitBtn>
          <KitBtn size="sm" :disabled="applying" @click="applyDrafts">
            {{ applying ? 'Применяем…' : committed ? 'Загрузить' : 'Применить' }}
          </KitBtn>
          <p v-if="draftError" class="draft-error" role="alert">
            {{ draftError }}
          </p>
        </div>
      </template>
    </DayTrackPlaybackPanel>

    <DayTrackActivityEditor
      v-if="canEditTrack"
      v-model:visible="isActivityEditorOpen"
      :trip-id="tripId"
      :day-data="dayData"
      :initial-time="activityEditorTime"
      :stage-correction="stageCorrection"
      :remove-correction="removeCorrection"
    />

    <AlertDialogRoot :open="leaveOpen">
      <AlertDialogPortal>
        <AlertDialogOverlay class="draft-leave-overlay" />
        <AlertDialogContent class="draft-leave-card" @escape-key-down.prevent="!applying && resolveNavigation(false)">
          <AlertDialogTitle>Есть неприменённые изменения</AlertDialogTitle>
          <AlertDialogDescription>Применить правки перед выходом?</AlertDialogDescription>
          <p v-if="draftError" role="alert">
            {{ draftError }}
          </p>
          <KitBtn :disabled="applying" @click="applyAndLeave">
            Применить и продолжить
          </KitBtn>
          <KitBtn variant="outlined" :disabled="applying" @click="discardAndLeave">
            Сбросить и продолжить
          </KitBtn>
          <KitBtn variant="text" :disabled="applying" @click="resolveNavigation(false)">
            Остаться
          </KitBtn>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>
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
.queue-status-btn {
  flex-shrink: 0;
}
.queue-status-popover {
  display: grid;
  gap: 6px;
  width: min(260px, calc(100vw - 24px));
  box-sizing: border-box;
  padding: var(--p-m);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  box-shadow: var(--s-l);
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}
.quality-gps-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-xs);
  min-height: 36px;
  padding-top: 4px;
  border-top: 1px solid var(--border-secondary-color);
  cursor: pointer;
}

.quality-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.draft-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border-secondary-color);
  padding-bottom: 8px;
  margin-bottom: 8px;
}
.draft-toolbar > span {
  margin-right: auto;
  font-size: 0.8rem;
}
.draft-error {
  width: 100%;
  margin: 0;
  font-size: 0.8rem;
  color: var(--fg-error-color, #c45148);
}
.draft-leave-overlay {
  position: fixed;
  inset: 0;
  z-index: 11000;
  background: #0005;
}
.draft-leave-card {
  box-sizing: border-box;
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  position: fixed;
  z-index: 11001;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(360px, calc(100% - 32px));
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  border-radius: 20px;
  padding: 20px;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.draft-leave-card h3,
.draft-leave-card p {
  margin: 0;
}

.track-follow-btn {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--r-full);
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  box-shadow: var(--s-m);
  color: var(--fg-secondary-color);
  cursor: pointer;
  font-size: 20px;
  &[aria-pressed='true'] {
    color: var(--fg-accent-color);
  }
  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 2px;
  }
}

@media (max-width: 640px) {
  .track-follow-btn {
    width: 36px;
    height: 36px;
    font-size: 18px;
    flex-shrink: 0;
  }
}

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

  // Хост маячка — элемент маркера MapLibre. Размер задаём явно: якорь считается
  // от габаритов именно этого элемента, а если он окажется обычным блоком в потоке
  // (position: relative из-за :deep-правила), маячок уедет вместе со стопкой.
  .playback-marker-host {
    width: 32px;
    height: 32px;
  }

  :deep(.day-track-photo-marker) {
    // Корень маркера принадлежит MapLibre: он сам ставит ему position: absolute,
    // top/left и transform для привязки к координате. Свои position/transform на
    // корне ломают эту привязку (position: relative уводил метку в поток и сдвигал
    // её вниз по стопке, а transform в :hover молча не применялся). Здесь — только
    // габарит якоря, всё визуальное в .photo-marker-body.
    width: 38px;
    height: 38px;
    cursor: pointer;

    .photo-marker-body {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2.5px solid #ffffff;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35);
      background: var(--bg-primary-color, #ffffff);
      display: flex;
      align-items: center;
      justify-content: center;
      transform-origin: center;
      transition:
        transform 0.15s ease,
        border-color 0.2s ease,
        box-shadow 0.2s ease;
    }

    &:hover {
      z-index: 50;

      .photo-marker-body {
        transform: scale(1.18);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
      }
    }

    &.is-playback-active {
      z-index: 60;

      .photo-marker-body {
        transform: scale(1.22);
        border-color: #f59e0b;
        box-shadow:
          0 0 0 4px rgba(245, 158, 11, 0.45),
          0 6px 16px rgba(0, 0, 0, 0.4);
      }
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

  > .point-popup-host {
    display: none;
  }
  :deep(.maplibregl-popup.day-track-point-popup) {
    .maplibregl-popup-content {
      padding: 0;
      background: transparent;
      box-shadow: none;
    }
    &.maplibregl-popup-anchor-bottom,
    &.maplibregl-popup-anchor-bottom-left,
    &.maplibregl-popup-anchor-bottom-right {
      .maplibregl-popup-tip {
        border-top-color: var(--bg-secondary-color);
      }
    }
    &.maplibregl-popup-anchor-top,
    &.maplibregl-popup-anchor-top-left,
    &.maplibregl-popup-anchor-top-right {
      .maplibregl-popup-tip {
        border-bottom-color: var(--bg-secondary-color);
      }
    }
    &.maplibregl-popup-anchor-left .maplibregl-popup-tip {
      border-right-color: var(--bg-secondary-color);
    }
    &.maplibregl-popup-anchor-right .maplibregl-popup-tip {
      border-left-color: var(--bg-secondary-color);
    }
    @media (max-width: 640px) {
      top: var(--track-point-popup-top, 140px);
      left: 50%;
      transform: translateX(-50%) !important;
      max-width: calc(100% - 24px) !important;
      .maplibregl-popup-tip {
        display: none;
      }
      .point-popup-card {
        width: min(310px, calc(100vw - 24px));
        max-width: 100%;
      }
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
