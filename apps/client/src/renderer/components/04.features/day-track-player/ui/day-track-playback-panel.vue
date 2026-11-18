<script setup lang="ts">
import type { RenderSegment, RouteVisibility, TimezoneMode, TrackPhoto } from '../models/types'
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { ActivityType } from '~/shared/services/tracking/track-processing'
import { Icon } from '@iconify/vue'
import { classificationExplanation } from '@limiteddissolve/track-processing'
import { useEventListener } from '@vueuse/core'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import {
  ACTIVITY_COLORS,
  ACTIVITY_LABELS,
  SPEED_MULTIPLIERS,
} from '../models/types'

interface Props {
  readonly?: boolean
  routeVisibility: RouteVisibility
  trailMinutes: number
  timeLabel: string
  timezoneMode: TimezoneMode
  deviceTimezone: string
  trackTimezone?: string
  currentSegment?: RenderSegment
  explanation?: string
  confidence?: number
  currentActivity: ActivityType
  currentActivityColor: string
  currentActivityIcon: string
  currentActivityLabel: string
  speedKmh?: number | null
  isFollowCamera: boolean
  displayPointsCount?: number
  totalPointsCount?: number
  t: number
  dayStart: number
  dayEnd: number
  isPlaying: boolean
  speedMultiplier: number
  timeRangeFormatted?: string
  dayStartFormatted?: string
  dayEndFormatted?: string
  renderSegments?: RenderSegment[]
  photoMarkers?: Array<{ id: string, tsUtc: number, percent: number, photo: TrackPhoto }>
}
// ─── 2. Визуальные сегменты таймлайна активности ────────────────────────────────
interface VisualSegment {
  leftPercent: number
  widthPercent: number
  color: string
  label: string
  timeStr: string
}

const props = withDefaults(defineProps<Props>(), {
  trackTimezone: undefined,
  currentSegment: undefined,
  speedKmh: null,
  displayPointsCount: 0,
  totalPointsCount: 0,
  timeRangeFormatted: '',
  dayStartFormatted: '',
  dayEndFormatted: '',
  renderSegments: () => [],
  photoMarkers: () => [],
})
const emit = defineEmits<{
  (e: 'update:routeVisibility', val: RouteVisibility): void
  (e: 'update:trailMinutes', val: number): void
  (e: 'update:t', val: number): void
  (e: 'update:isPlaying', val: boolean): void
  (e: 'update:speedMultiplier', val: number): void
  (e: 'update:isFollowCamera', val: boolean): void
  (e: 'editActivity'): void
  (e: 'toggleTimezone'): void
  (e: 'stepSeconds', delta: number): void
  (e: 'skipToPrevMovement'): void
  (e: 'skipToNextMovement'): void
  (e: 'seekStart'): void
  (e: 'seekEnd'): void
  (e: 'seekPhoto', tsUtc: number): void
}>()

const panelHost = ref<HTMLElement | null>(null)
const qualityOpen = ref(false)
const activityOpen = ref(false)
const routeVisibilityItems: KitDropdownItem<RouteVisibility>[] = [
  { value: 'full', label: 'Весь маршрут', icon: 'mdi:routes' },
  { value: 'elapsed', label: 'До текущего времени', icon: 'mdi:timeline-clock-outline' },
  { value: 'recent', label: 'Последний отрезок', icon: 'mdi:history' },
]
const trailItems = [5, 15, 30, 60].map(value => ({ value, label: `${value} мин` }))
// ─── 3. Hover Preview на таймлайне (Scrubber tooltip) ───────────────────────────
const timelineBarRef = ref<HTMLElement | null>(null)
const hoverPreview = ref<{
  leftPercent: number
  timeStr: string
  activityLabel?: string
  activityColor?: string
} | null>(null)

const visibilityLabel = computed(() => routeVisibilityItems.find(item => item.value === props.routeVisibility)?.label ?? '')
const visibilityIcon = computed(() => routeVisibilityItems.find(item => item.value === props.routeVisibility)?.icon ?? 'mdi:routes')
const telemetryLabel = computed(() => `${props.currentActivityLabel}${props.speedKmh != null && props.speedKmh > 0.5 ? ` · ${props.speedKmh.toFixed(0)} км/ч` : ''}`)
const mobileSettingsValue = computed(() => props.routeVisibility === 'recent' ? `recent-${props.trailMinutes}` : props.routeVisibility)
const mobileSettingsItems = computed<KitDropdownItem<string>[]>(() => [
  ...routeVisibilityItems.filter(item => item.value !== 'recent'),
  ...[5, 15, 30, 60].map(value => ({ value: `recent-${value}`, label: `Последние ${value} мин`, icon: 'mdi:history' })),
  { value: 'timezone', label: props.timezoneMode === 'track' ? 'Время записи → время устройства' : 'Время устройства → время записи', icon: 'mdi:clock-outline' },
  { value: 'start', label: 'В начало дня', icon: 'mdi:skip-backward' },
  { value: 'end', label: 'В конец дня', icon: 'mdi:skip-forward' },
])
const currentT = computed({
  get: () => props.t,
  set: (val: number) => emit('update:t', val),
})
// Название часового пояса для компактного чипа
const timezoneChipLabel = computed(() => {
  if (props.timezoneMode === 'device')
    return 'Локальное'

  if (props.trackTimezone) {
    const city = props.trackTimezone.split('/').pop()?.replace(/_/g, ' ')

    return city || 'Местное'
  }

  return 'Местное'
})
const timelineSegments = computed<VisualSegment[]>(() => {
  if (!props.renderSegments || props.renderSegments.length === 0 || props.dayEnd <= props.dayStart)
    return []

  const total = props.dayEnd - props.dayStart

  if (total <= 0)
    return []

  return props.renderSegments.map((s) => {
    const leftPercent = Math.max(0, Math.min(100, ((s.t0 - props.dayStart) / total) * 100))
    const widthPercent = Math.max(0.4, Math.min(100 - leftPercent, ((s.t1 - s.t0) / total) * 100))
    const label = ACTIVITY_LABELS[s.activity] || 'Движение'
    const timeStr = `${formatTimeShort(s.t0)} – ${formatTimeShort(s.t1)}`

    return {
      leftPercent,
      widthPercent,
      color: ACTIVITY_COLORS[s.activity] || '#2196f3',
      label,
      timeStr,
    }
  })
})
const progressPercent = computed(() => {
  if (props.dayEnd <= props.dayStart)
    return 0

  const p = ((props.t - props.dayStart) / (props.dayEnd - props.dayStart)) * 100

  return Math.max(0, Math.min(100, p))
})
// ─── 4. Селектор скорости (KitDropdown) ─────────────────────────────────────────
const speedDropdownItems = computed<KitDropdownItem<number>[]>(() =>
  SPEED_MULTIPLIERS.map(s => ({
    value: s,
    label: `${s}x скорость`,
  })))

function selectMobileSetting(value: string) {
  if (value === 'timezone') {
    emit('toggleTimezone')
  }
  else if (value === 'start') {
    emit('seekStart')
  }
  else if (value === 'end') {
    emit('seekEnd')
  }
  else if (value === 'full' || value === 'elapsed') {
    emit('update:routeVisibility', value)
  }
  else if (value.startsWith('recent-')) {
    emit('update:trailMinutes', Number(value.slice(7)))
    emit('update:routeVisibility', 'recent')
  }
}
function formatTimeShort(ms: number): string {
  if (ms <= 0)
    return '--:--'

  const tz = props.timezoneMode === 'track' ? props.trackTimezone : undefined

  return new Date(ms).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    ...(tz ? { timeZone: tz } : {}),
  })
}
function formatTimelineHoverTime(ms: number): string {
  if (ms <= 0)
    return '--:--'

  const tz = props.timezoneMode === 'track' ? props.trackTimezone : undefined

  return new Date(ms).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...(tz ? { timeZone: tz } : {}),
  })
}
function handleTimelineMouseMove(e: MouseEvent) {
  if (!timelineBarRef.value || props.dayEnd <= props.dayStart)
    return

  const rect = timelineBarRef.value.getBoundingClientRect()

  if (rect.width <= 0)
    return

  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
  const fraction = x / rect.width
  const hoverT = props.dayStart + fraction * (props.dayEnd - props.dayStart)

  const timeStr = formatTimelineHoverTime(hoverT)

  let activityLabel: string | undefined
  let activityColor: string | undefined

  if (props.renderSegments && props.renderSegments.length > 0) {
    const seg = props.renderSegments.find(s => hoverT >= s.t0 && hoverT <= s.t1)

    if (seg) {
      activityLabel = ACTIVITY_LABELS[seg.activity]
      activityColor = ACTIVITY_COLORS[seg.activity]
    }
  }

  hoverPreview.value = {
    leftPercent: fraction * 100,
    timeStr,
    activityLabel,
    activityColor,
  }
}
function handleTimelineMouseLeave() {
  hoverPreview.value = null
}
function formatPhotoTime(tsUtc: number): string {
  const tz = props.timezoneMode === 'track' ? props.trackTimezone : undefined

  return new Date(tsUtc).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    ...(tz ? { timeZone: tz } : {}),
  })
}
function handlePhotoTickClick(tsUtc: number) {
  emit('update:t', tsUtc)
  emit('seekPhoto', tsUtc)
}
// ─── 5. Горячие клавиши (Keyboard shortcuts) ───────────────────────────────────
function isInteractiveTarget(target: HTMLElement | null): boolean {
  if (!(target instanceof HTMLElement))
    return false

  const interactiveTags = ['BUTTON', 'SELECT', 'TEXTAREA']

  return interactiveTags.includes(target.tagName)
    || Boolean(target.closest('[role="dialog"]'))
    || target.isContentEditable
    || isNonRangeInput(target)
    || Boolean(target.closest('button, [role="button"], [role="menuitem"], [role="option"], [role="combobox"], [role="listbox"], .kit-dropdown, a[href]'))
}
function isNonRangeInput(target: HTMLElement): boolean {
  return target.tagName === 'INPUT' && target.getAttribute('type') !== 'range'
}
function handleTimelineShortcut(e: KeyboardEvent) {
  if (e.code === 'Space') {
    e.preventDefault()
    emit('update:isPlaying', !props.isPlaying)
  }
  else if (e.code === 'ArrowLeft') {
    e.preventDefault()

    if (e.shiftKey)
      emit('skipToPrevMovement')
    else
      emit('stepSeconds', -15)
  }
  else if (e.code === 'ArrowRight') {
    e.preventDefault()

    if (e.shiftKey)
      emit('skipToNextMovement')
    else
      emit('stepSeconds', 15)
  }
  else if (e.code === 'KeyC' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    emit('update:isFollowCamera', !props.isFollowCamera)
  }
}

useEventListener(typeof window !== 'undefined' ? window : null, 'keydown', (e: KeyboardEvent) => {
  if (isInteractiveTarget(e.target as HTMLElement | null))
    return

  handleTimelineShortcut(e)
})
</script>

<template>
  <div ref="panelHost" class="memories-panel" :data-route-visibility="routeVisibility">
    <slot name="draft-actions" />
    <!-- Верхняя строка: Телеметрия, Часовой пояс и Слежение камерой -->
    <div class="memories-readout">
      <div class="readout-time-group">
        <span class="time">{{ timeLabel }}</span>
        <button
          class="tz-toggle-chip"
          :aria-label="`Переключить часовой пояс. Сейчас: ${timezoneMode === 'track' ? 'местное время записи' : 'время устройства'}`"
          :class="{ 'is-track': timezoneMode === 'track', 'is-device': timezoneMode === 'device' }"
          :title="timezoneMode === 'track'
            ? `Показывается местное время записи${trackTimezone ? ` (${trackTimezone})` : ''}. Нажмите для переключения на локальное время устройства (${deviceTimezone})`
            : `Показывается локальное время устройства (${deviceTimezone}). Нажмите для переключения на местное время записи${trackTimezone ? ` (${trackTimezone})` : ''}`"
          @click="emit('toggleTimezone')"
        >
          <Icon :icon="timezoneMode === 'track' ? 'mdi:earth' : 'mdi:clock-outline'" class="tz-icon" />
          <span class="tz-text">{{ timezoneChipLabel }}</span>
        </button>
      </div>

      <div class="route-visibility-controls">
        <KitDropdown :items="routeVisibilityItems" :model-value="routeVisibility" @update:model-value="emit('update:routeVisibility', $event)">
          <template #trigger>
            <KitBtn
              size="sm"
              variant="text"
              color="secondary"
              class="route-visibility-trigger"
              :aria-label="`Отображение маршрута: ${visibilityLabel}`"
              :title="visibilityLabel"
            >
              <Icon :icon="visibilityIcon" />
              <span class="route-visibility-label">{{ visibilityLabel }}</span>
              <Icon icon="mdi:chevron-down" class="visibility-chevron" />
            </KitBtn>
          </template>
        </KitDropdown>
        <KitDropdown
          v-if="routeVisibility === 'recent'"
          :items="trailItems"
          :model-value="trailMinutes"
          @update:model-value="emit('update:trailMinutes', $event)"
        >
          <template #trigger>
            <KitBtn
              size="sm"
              variant="text"
              color="secondary"
              :aria-label="`Длительность последнего отрезка: ${trailMinutes} минут`"
              :title="`${trailMinutes} минут`"
            >
              {{ trailMinutes }}<span class="trail-unit">мин</span>
              <Icon icon="mdi:chevron-down" class="visibility-chevron" />
            </KitBtn>
          </template>
        </KitDropdown>
      </div>
      <!-- Единый аккуратный чип телеметрии по центру -->
      <div class="readout-actions">
        <div class="readout-telemetry">
          <PopoverRoot v-model:open="activityOpen">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="telemetry-pill"
                :aria-label="telemetryLabel"
                :title="telemetryLabel"
                :style="{ '--act-color': currentActivityColor }"
              >
                <Icon :icon="currentActivityIcon" class="pill-icon" />
                <span class="pill-label">{{ currentActivityLabel }}</span>
                <template v-if="speedKmh !== null && speedKmh > 0.5">
                  <span class="pill-sep">•</span>
                  <span class="pill-speed">{{ speedKmh.toFixed(0) }} км/ч</span>
                </template>
              </button>
            </PopoverTrigger>
            <PopoverPortal :to="panelHost ?? undefined">
              <PopoverContent
                class="recording-quality-popover"
                position-strategy="absolute"
                side="top"
                align="end"
                :side-offset="8"
                :collision-padding="12"
              >
                <strong>{{ currentActivityLabel }}</strong>
                <p>{{ explanation || classificationExplanation({ tsUtc: t, sessionId: '', activity: currentActivity }) }}</p>
                <p v-if="confidence != null">
                  Эвристическая уверенность: {{ Math.round(confidence <= 1 ? confidence * 100 : confidence) }}%
                </p>
                <KitBtn variant="text" size="sm" @click="activityOpen = false">
                  Закрыть
                </KitBtn>
              </PopoverContent>
            </PopoverPortal>
          </PopoverRoot>
        </div>
        <PopoverRoot v-if="$slots.quality" v-model:open="qualityOpen">
          <PopoverTrigger as-child>
            <KitBtn
              variant="text"
              color="secondary"
              size="sm"
              class="quality-trigger"
              aria-label="Качество записи"
              title="Качество записи"
            >
              <Icon icon="mdi:chart-box-outline" />
            </KitBtn>
          </PopoverTrigger>
          <PopoverPortal :to="panelHost ?? undefined">
            <PopoverContent
              class="recording-quality-popover"
              position-strategy="absolute"
              side="top"
              align="end"
              :side-offset="8"
              :collision-padding="12"
              aria-label="Качество записи"
            >
              <KitBtn
                class="quality-close"
                variant="text"
                color="secondary"
                size="xs"
                aria-label="Закрыть качество записи"
                @click="qualityOpen = false"
              >
                <Icon icon="mdi:close" />
              </KitBtn>
              <slot name="quality" :close="() => { qualityOpen = false }" />
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
        <div class="mobile-playback-settings">
          <KitDropdown
            :items="mobileSettingsItems"
            :model-value="mobileSettingsValue"
            align="end"
            size="sm"
            @update:model-value="selectMobileSetting"
          >
            <template #trigger>
              <KitBtn
                variant="text"
                color="secondary"
                size="sm"
                aria-label="Настройки воспроизведения"
                :title="`${visibilityLabel}${routeVisibility === 'recent' ? ` · ${trailMinutes} мин` : ''}. ${timezoneChipLabel}`"
              >
                <Icon icon="mdi:tune-variant" />
              </KitBtn>
            </template>
          </KitDropdown>
        </div>
      </div>
    </div>

    <!-- Интеллектуальный таймлайн со сегментами активности и превью -->
    <div class="timeline-container">
      <div
        class="timeline-track-wrap"
        @mousemove="handleTimelineMouseMove"
        @mouseleave="handleTimelineMouseLeave"
      >
        <div ref="timelineBarRef" class="timeline-rail">
          <!-- Дорожка таймлайна с фоном и цветными сегментами активности -->
          <div class="timeline-segments-track">
            <div
              v-for="(seg, idx) in timelineSegments"
              :key="idx"
              class="timeline-segment"
              :style="{
                '--seg-left': `${seg.leftPercent}%`,
                '--seg-width': `${seg.widthPercent}%`,
                '--seg-color': seg.color,
              }"
              :title="`${seg.label}: ${seg.timeStr}`"
            />
          </div>

          <!-- Заливка пройденной части таймлайна -->
          <div
            class="timeline-progress-fill"
            :style="{ '--progress-width': `${progressPercent}%` }"
          />

          <!-- Засечки фотографий на таймлайне -->
          <div v-if="photoMarkers && photoMarkers.length > 0" class="timeline-photo-markers">
            <button
              v-for="pm in photoMarkers"
              :key="pm.id"
              type="button"
              class="timeline-photo-tick"
              :class="{ 'is-active': Math.abs(currentT - pm.tsUtc) < 45_000 }"
              :style="{ left: `${pm.percent}%` }"
              :title="`Фото: ${formatPhotoTime(pm.tsUtc)}${pm.photo.title ? ` (${pm.photo.title})` : ''}`"
              :aria-label="`Перейти к фото: ${formatPhotoTime(pm.tsUtc)}${pm.photo.title ? ` (${pm.photo.title})` : ''}`"
              @click.stop="handlePhotoTickClick(pm.tsUtc)"
            />
          </div>

          <!-- Всплывающее превью при наведении курсора -->
          <div
            v-if="hoverPreview"
            class="timeline-hover-indicator"
            :style="{
              '--hover-left': `${hoverPreview.leftPercent}%`,
              '--hover-color': hoverPreview.activityColor,
            }"
          >
            <div class="hover-bubble">
              <span class="hover-time">{{ hoverPreview.timeStr }}</span>
              <span
                v-if="hoverPreview.activityLabel"
                class="hover-activity"
              >
                {{ hoverPreview.activityLabel }}
              </span>
            </div>
            <div class="hover-needle" />
          </div>

          <div class="timeline-playhead" :style="{ left: `${progressPercent}%` }" aria-hidden="true" />
        </div>

        <!-- Нативный ползунок range для плавного скраббинга и доступности -->
        <input
          v-model.number="currentT"
          class="memories-slider"
          type="range"
          :min="dayStart"
          :max="dayEnd"
          step="1000"
          :disabled="dayEnd <= dayStart"
          aria-label="Временная шкала трека"
        >
      </div>
    </div>

    <!-- Кнопки управления воспроизведением и селектор скорости -->
    <div class="memories-actions">
      <!-- Левый вспомогательный блок (счетчик точек при наличии) -->
      <div class="actions-left">
        <KitBtn
          v-if="!readonly"
          size="sm"
          variant="text"
          color="secondary"
          aria-label="Исправить тип движения"
          @click="emit('editActivity')"
        >
          <Icon icon="mdi:pencil-outline" />
        </KitBtn>
        <span
          v-if="displayPointsCount && displayPointsCount > 0"
          class="points-badge"
          :title="totalPointsCount && totalPointsCount !== displayPointsCount
            ? `Отображается ${displayPointsCount} объединенных точек из ${totalPointsCount} исходных`
            : `${displayPointsCount} точек маршрута`"
        >
          <Icon icon="mdi:map-marker-multiple-outline" class="points-icon" />
          <span class="points-num">{{ displayPointsCount }}</span>
        </span>
      </div>

      <!-- Центральная группа кнопок воспроизведения -->
      <div class="playback-controls">
        <button
          class="control-btn boundary-control"
          aria-label="В начало дня"
          title="В начало дня"
          @click="emit('seekStart')"
        >
          <Icon icon="mdi:skip-backward" />
        </button>

        <button
          class="control-btn"
          aria-label="К предыдущему отрезку / движению"
          title="Предыдущее движение (Shift + ←)"
          @click="emit('skipToPrevMovement')"
        >
          <Icon icon="mdi:step-backward" />
        </button>

        <button
          class="control-btn play-btn"
          :disabled="dayEnd <= dayStart"
          :aria-label="isPlaying ? 'Пауза' : 'Воспроизвести'"
          :title="isPlaying ? 'Пауза (Пробел)' : 'Воспроизведение (Пробел)'"
          @click="emit('update:isPlaying', !isPlaying)"
        >
          <Icon :icon="isPlaying ? 'mdi:pause' : 'mdi:play'" />
        </button>

        <button
          class="control-btn"
          aria-label="К следующему отрезку / движению"
          title="Следующее движение (Shift + →)"
          @click="emit('skipToNextMovement')"
        >
          <Icon icon="mdi:step-forward" />
        </button>

        <button
          class="control-btn boundary-control"
          aria-label="В конец дня"
          title="В конец дня"
          @click="emit('seekEnd')"
        >
          <Icon icon="mdi:skip-forward" />
        </button>
      </div>

      <!-- Правый блок: выпадающее меню выбора скорости -->
      <div class="actions-right">
        <KitDropdown
          :model-value="speedMultiplier"
          :items="speedDropdownItems"
          size="sm"
          align="end"
          @update:model-value="emit('update:speedMultiplier', $event)"
        >
          <template #trigger>
            <button
              class="speed-pill-btn"
              type="button"
              title="Скорость воспроизведения"
              :aria-label="`Скорость воспроизведения: ${speedMultiplier}×`"
            >
              <Icon icon="mdi:play-speed" class="speed-icon" />
              <span class="speed-text">{{ speedMultiplier }}x</span>
              <Icon icon="mdi:chevron-down" class="chevron-icon" />
            </button>
          </template>
        </KitDropdown>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.readout-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;
}
.readout-actions .readout-telemetry {
  min-width: 0;
}
.readout-actions .pill-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quality-close {
  float: right;
  margin-left: var(--p-xs);
}
.quality-trigger {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  padding: 0;
  font-size: 20px;
}
.recording-quality-popover {
  z-index: 2000;
  width: min(360px, calc(100vw - 24px));
  max-height: min(420px, var(--reka-popover-content-available-height));
  overflow-y: auto;
  box-sizing: border-box;
  padding: var(--p-m);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  box-shadow: var(--s-l);
}

.route-visibility-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;

  :deep(.kit-btn) {
    min-height: 36px;
    box-shadow: none;
    white-space: nowrap;
  }

  .route-tools {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }
}

.memories-panel {
  position: absolute;
  bottom: calc(14px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
  left: 14px;
  right: 14px;
  max-width: 860px;
  margin: 0 auto;
  z-index: 20;
  background-color: var(--bg-secondary-color);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: var(--s-l);
  user-select: none;

  /* ── 1. Верхняя инфо-строка ── */
  .memories-readout {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 12px;
    font-variant-numeric: tabular-nums;

    .readout-time-group {
      justify-self: start;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      height: 28px;

      .time {
        font-size: 1.25rem;
        font-weight: 700;
        letter-spacing: -0.01em;
        line-height: 28px;
        color: var(--fg-primary-color);
      }

      .tz-toggle-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 28px;
        box-sizing: border-box;
        padding: 0 10px;
        border-radius: var(--r-full);
        border: 1px solid var(--border-secondary-color);
        background: var(--bg-tertiary-color);
        color: var(--fg-secondary-color);
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;

        .tz-icon {
          font-size: 0.95rem;
        }

        .tz-text {
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        &:hover {
          color: var(--fg-primary-color);
          background: var(--bg-hover-color);
          border-color: var(--border-primary-color);
        }

        &.is-track {
          background: rgba(33, 150, 243, 0.12);
          color: #2196f3;
          border-color: rgba(33, 150, 243, 0.35);

          &:hover {
            background: rgba(33, 150, 243, 0.2);
            border-color: rgba(33, 150, 243, 0.5);
          }
        }
      }
    }

    .readout-telemetry {
      justify-self: center;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
      height: 28px;

      .telemetry-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 28px;
        box-sizing: border-box;
        padding: 0 12px;
        border-radius: var(--r-full);
        border: 1px solid color-mix(in srgb, var(--act-color, currentColor) 25%, transparent);
        background-color: color-mix(in srgb, var(--act-color, currentColor) 10%, transparent);
        color: var(--act-color, currentColor);
        font-size: 0.78rem;
        font-weight: 600;
        white-space: nowrap;
        transition: all 0.25s ease;

        .pill-icon {
          font-size: 1.05rem;
        }

        .pill-sep {
          opacity: 0.5;
          font-size: 0.75rem;
        }

        .pill-speed {
          font-variant-numeric: tabular-nums;
        }
      }
    }
  }

  /* ── 2. Интеллектуальный таймлайн ── */
  .timeline-container {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    margin: 2px 0;

    .timeline-track-wrap {
      position: relative;
      flex: 1;
      min-width: 0;
      height: 44px;
      display: flex;
      align-items: center;
      cursor: pointer;

      // Same endpoints as the native 24px thumb's centre.
      .timeline-rail {
        position: absolute;
        inset: 0 12px;
        z-index: 3;
        pointer-events: none;
      }

      .timeline-playhead {
        position: absolute;
        top: 50%;
        width: 3px;
        height: 24px;
        transform: translate(-50%, -50%);
        border-radius: 2px;
        background: var(--fg-accent-color);
        box-shadow: 0 0 0 2px var(--bg-primary-color);
        pointer-events: none;
        z-index: 6;
      }

      &:has(.memories-slider:focus-visible) .timeline-playhead {
        outline: 2px solid var(--fg-accent-color);
        outline-offset: 3px;
      }

      .timeline-segments-track {
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        height: 6px;
        border-radius: 3px;
        background: var(--bg-tertiary-color);
        overflow: hidden;
        pointer-events: none;
        border: 1px solid var(--border-secondary-color);

        .timeline-segment {
          position: absolute;
          top: 0;
          bottom: 0;
          left: var(--seg-left);
          width: var(--seg-width);
          background-color: var(--seg-color);
          opacity: 0.85;
          transition: opacity 0.15s;
        }
      }

      .timeline-progress-fill {
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        height: 6px;
        border-radius: 3px;
        width: var(--progress-width, 0%);
        background: rgba(var(--fg-accent-color-rgb, 59, 130, 246), 0.35);
        pointer-events: none;
      }

      .timeline-photo-markers {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 5;
      }

      .timeline-photo-tick {
        position: absolute;
        top: 50%;
        width: 12px;
        height: 32px;
        transform: translate(-50%, -50%);
        padding: 0;
        border: 0;
        background: transparent;
        cursor: pointer;
        pointer-events: auto;

        &::before {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 2px;
          height: 12px;
          border-radius: 1px;
          background: var(--fg-secondary-color);
        }

        &:hover::before,
        &:focus-visible::before,
        &.is-active::before {
          height: 16px;
          background: var(--fg-accent-color);
        }

        // Let dragging start on the playhead when a photo shares its time.
        &.is-active {
          pointer-events: none;
        }

        &:focus-visible {
          outline: 2px solid var(--fg-accent-color);
          outline-offset: 1px;
          border-radius: 2px;
        }
      }

      .timeline-hover-indicator {
        position: absolute;
        top: -26px;
        left: var(--hover-left, 0%);
        transform: translateX(-50%);
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 10;
        transition: opacity 0.15s;

        .hover-bubble {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: var(--bg-primary-color);
          border: 1px solid var(--border-secondary-color);
          border-radius: var(--r-s);
          padding: 2px 6px;
          font-size: 0.72rem;
          font-weight: 600;
          box-shadow: var(--s-m);
          white-space: nowrap;

          .hover-time {
            color: var(--fg-primary-color);
            font-variant-numeric: tabular-nums;
          }

          .hover-activity {
            font-size: 0.68rem;
            font-weight: 600;
            color: var(--hover-color, var(--fg-secondary-color));
          }
        }

        .hover-needle {
          width: 2px;
          height: 10px;
          background: var(--fg-accent-color);
          border-radius: 1px;
          margin-top: 1px;
        }
      }

      .memories-slider {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        opacity: 1;
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        cursor: pointer;
        z-index: 2;

        &:focus {
          outline: none;
        }

        &::-webkit-slider-runnable-track {
          background: transparent;
          border: none;
          height: 6px;
        }

        &::-moz-range-track {
          background: transparent;
          border: none;
          height: 6px;
        }

        &::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          box-sizing: border-box;
          width: 24px;
          height: 44px;
          margin-top: -19px;
          border: 0;
          border-radius: 0;
          background: transparent;
          cursor: grab;
        }

        &::-moz-range-thumb {
          box-sizing: border-box;
          width: 24px;
          height: 44px;
          border: 0;
          border-radius: 0;
          background: transparent;
          cursor: grab;
        }

        &:active::-webkit-slider-thumb {
          cursor: grabbing;
        }

        &:active::-moz-range-thumb {
          cursor: grabbing;
        }
      }
    }
  }

  /* ── 3. Панель управления и селектор скорости ── */
  .memories-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    .actions-left {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: flex-start;

      .points-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.72rem;
        color: var(--fg-tertiary-color);
        font-variant-numeric: tabular-nums;
        cursor: default;

        .points-icon {
          font-size: 0.85rem;
        }
      }
    }

    .playback-controls {
      display: flex;
      align-items: center;
      gap: 8px;

      .control-btn {
        width: 34px;
        height: 34px;
        border-radius: var(--r-full);
        border: 1px solid var(--border-secondary-color);
        background: var(--bg-tertiary-color);
        color: var(--fg-primary-color);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1.15rem;
        transition:
          background-color 0.2s,
          transform 0.1s,
          border-color 0.2s;

        &:hover:not(:disabled) {
          background: var(--bg-hover-color);
          border-color: var(--border-primary-color);
        }

        &:active:not(:disabled) {
          transform: scale(0.94);
        }

        &.play-btn {
          width: 42px;
          height: 42px;
          background: var(--fg-accent-color);
          color: var(--fg-inverted-color);
          border-color: var(--border-accent-color);
          font-size: 1.3rem;

          &:hover:not(:disabled) {
            background: var(--bg-action-hover-color);
          }
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      }
    }

    .actions-right {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: flex-end;

      .speed-pill-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px 9px;
        border-radius: var(--r-full);
        border: 1px solid var(--border-secondary-color);
        background: var(--bg-tertiary-color);
        color: var(--fg-primary-color);
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        user-select: none;

        .speed-icon {
          font-size: 0.95rem;
          color: var(--fg-secondary-color);
        }

        .chevron-icon {
          font-size: 0.8rem;
          color: var(--fg-tertiary-color);
        }

        &:hover {
          background: var(--bg-hover-color);
          border-color: var(--border-primary-color);
        }
      }
    }
  }

  @media (max-width: 380px) {
    .route-visibility-controls .edit-label,
    .tz-text {
      display: none;
    }
  }

  /* ── Адаптивность для мобильных устройств ── */
  @media (max-width: 640px) {
    bottom: calc(8px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
    left: 8px;
    right: 8px;
    padding: 10px 12px;
    gap: 6px;

    .memories-readout {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;

      .readout-time-group {
        flex-shrink: 0;
        gap: 8px;
        height: 26px;

        .time {
          font-size: 1.15rem;
          line-height: 26px;
        }

        .tz-toggle-chip {
          height: 26px;
          padding: 0 8px;
          font-size: 0.68rem;
          flex-shrink: 0;

          .tz-text {
            max-width: 60px;
          }
        }
      }

      .readout-telemetry {
        flex: 0 1 auto;
        min-width: 0;
        height: 26px;
        justify-self: auto;
        display: flex;
        align-items: center;
        justify-content: center;

        .telemetry-pill {
          min-width: 0;
          max-width: 100%;
          height: 26px;
          padding: 0 8px;
          font-size: 0.72rem;

          .pill-label {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .pill-speed {
            flex-shrink: 0;
          }

          .pill-icon {
            flex-shrink: 0;
          }

          .pill-sep {
            flex-shrink: 0;
          }
        }
      }
    }

    .memories-actions {
      .playback-controls {
        gap: 6px;

        .control-btn {
          width: 32px;
          height: 32px;
          font-size: 1.05rem;

          &.play-btn {
            width: 38px;
            height: 38px;
            font-size: 1.2rem;
          }
        }
      }

      .actions-right {
        .speed-pill-btn {
          padding: 4px 7px;
          font-size: 0.72rem;

          .speed-icon {
            display: none;
          }
        }
      }
    }
  }
}

.memories-panel {
  gap: 4px;
  padding: 6px 10px;
  .memories-readout {
    flex-wrap: wrap;
  }
  .route-visibility-controls {
    justify-content: center;
    gap: 0;
  }
  .route-visibility-controls :deep(.kit-btn) {
    min-height: 44px;
    padding: 0 6px;
    font-size: 0.75rem;
  }
  .actions-left :deep(.kit-btn) {
    min-width: 44px;
    min-height: 44px;
    padding: 0;
  }
  .memories-actions .actions-left .points-badge {
    display: none;
  }
  .memories-actions .playback-controls {
    gap: 0;
  }
  .memories-actions .playback-controls .control-btn {
    width: 44px;
    height: 44px;
    border: 0;
    background: transparent;
  }
  .memories-actions .playback-controls .play-btn {
    background: var(--fg-accent-color);
  }
  .memories-actions .actions-right .speed-pill-btn {
    min-height: 44px;
    border: 0;
    padding: 4px;
  }
  @media (max-width: 640px) {
    .memories-actions {
      gap: 4px;
    }
    .readout-time-group .tz-toggle-chip .tz-text {
      display: none;
    }
    .memories-readout .readout-telemetry .telemetry-pill {
      padding: 0 4px;
      border: 0;
      background: transparent;
    }
    .route-visibility-controls :deep(.kit-btn) {
      max-width: 145px;
    }
    .memories-actions .playback-controls .control-btn {
      width: 40px;
    }
    .speed-icon,
    .chevron-icon {
      display: none;
    }
  }
}
.mobile-playback-settings {
  display: none;
}
@media (max-width: 640px) {
  .memories-panel {
    padding: 8px 10px;
    gap: 6px;
    .memories-readout {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 8px;
      flex-wrap: nowrap;
      .readout-time-group {
        height: auto;
        .time {
          font-size: 1.15rem;
          white-space: nowrap;
        }
        .tz-toggle-chip {
          display: none;
        }
      }
      .route-visibility-controls {
        display: none;
      }
      .readout-telemetry {
        min-width: 0;
        justify-self: end;
        .telemetry-pill {
          gap: 5px;
          height: 28px;
          padding: 0 7px;
          font-size: 0.75rem;
          border: 1px solid color-mix(in srgb, var(--act-color) 20%, transparent);
          background: color-mix(in srgb, var(--act-color) 8%, transparent);
          .pill-label {
            display: inline;
          }
          .pill-speed,
          .pill-sep {
            display: none;
          }
        }
      }
    }
    .mobile-playback-settings {
      display: block;
      :deep(.kit-btn) {
        width: 44px;
        height: 44px;
        padding: 0;
        box-shadow: none;
        font-size: 20px;
      }
    }
    .timeline-container {
      gap: 8px;
      margin: 0;
      .timeline-track-wrap {
        height: 32px;
      }
    }
    .memories-actions {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) 44px;
      gap: 4px;
      .actions-left,
      .actions-right {
        min-width: 0;
      }
      .playback-controls {
        justify-content: center;
        .control-btn {
          width: 44px;
          height: 44px;
          flex: 0 0 44px;
          font-size: 22px;
        }
        .boundary-control {
          display: none;
        }
        .play-btn {
          width: 48px;
          height: 48px;
          flex-basis: 48px;
          font-size: 26px;
        }
      }
      .actions-right .speed-pill-btn {
        width: 44px;
        height: 44px;
        padding: 0;
        justify-content: center;
        border-radius: var(--r-s);
        background: transparent;
        font-size: 0.85rem;
      }
    }
  }
}
</style>
