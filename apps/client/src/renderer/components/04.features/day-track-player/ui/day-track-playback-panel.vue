<script setup lang="ts">
import type { RenderSegment, TimezoneMode } from '../models/types'
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { ActivityType } from '~/shared/services/tracking/track-processing'
import { Icon } from '@iconify/vue'
import { useEventListener } from '@vueuse/core'
import { computed, ref } from 'vue'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import {
  ACTIVITY_COLORS,
  ACTIVITY_LABELS,
  SPEED_MULTIPLIERS,
} from '../models/types'

const props = withDefaults(defineProps<{
  timeLabel: string
  timezoneMode: TimezoneMode
  deviceTimezone: string
  trackTimezone?: string
  currentSegment?: RenderSegment
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
}>(), {
  trackTimezone: undefined,
  currentSegment: undefined,
  speedKmh: null,
  displayPointsCount: 0,
  totalPointsCount: 0,
  timeRangeFormatted: '',
  dayStartFormatted: '',
  dayEndFormatted: '',
  renderSegments: () => [],
})

const emit = defineEmits<{
  (e: 'update:t', val: number): void
  (e: 'update:isPlaying', val: boolean): void
  (e: 'update:speedMultiplier', val: number): void
  (e: 'update:isFollowCamera', val: boolean): void
  (e: 'toggleTimezone'): void
  (e: 'stepSeconds', delta: number): void
  (e: 'skipToPrevMovement'): void
  (e: 'skipToNextMovement'): void
  (e: 'seekStart'): void
  (e: 'seekEnd'): void
}>()

const currentT = computed({
  get: () => props.t,
  set: (val: number) => emit('update:t', val),
})

// ─── 1. Форматирование времени границ дня ───────────────────────────────────────
const formattedStart = computed(() => {
  if (props.dayStartFormatted)
    return props.dayStartFormatted
  if (props.dayStart <= 0)
    return '--:--'
  const tz = props.timezoneMode === 'track' ? props.trackTimezone : undefined
  return new Date(props.dayStart).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    ...(tz ? { timeZone: tz } : {}),
  })
})

const formattedEnd = computed(() => {
  if (props.dayEndFormatted)
    return props.dayEndFormatted
  if (props.dayEnd <= 0)
    return '--:--'
  const tz = props.timezoneMode === 'track' ? props.trackTimezone : undefined
  return new Date(props.dayEnd).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    ...(tz ? { timeZone: tz } : {}),
  })
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

// ─── 2. Визуальные сегменты таймлайна активности ────────────────────────────────
interface VisualSegment {
  leftPercent: number
  widthPercent: number
  color: string
  label: string
  timeStr: string
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

// ─── 3. Hover Preview на таймлайне (Scrubber tooltip) ───────────────────────────
const timelineBarRef = ref<HTMLElement | null>(null)
const hoverPreview = ref<{
  leftPercent: number
  timeStr: string
  activityLabel?: string
  activityColor?: string
} | null>(null)

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

// ─── 4. Селектор скорости (KitDropdown) ─────────────────────────────────────────
const speedDropdownItems = computed<KitDropdownItem<number>[]>(() =>
  SPEED_MULTIPLIERS.map(s => ({
    value: s,
    label: `${s}x скорость`,
  })),
)

// ─── 5. Горячие клавиши (Keyboard shortcuts) ───────────────────────────────────
useEventListener(typeof window !== 'undefined' ? window : null, 'keydown', (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null
  if (target) {
    const isInteractive = (
      target.tagName === 'BUTTON'
      || target.tagName === 'SELECT'
      || target.tagName === 'TEXTAREA'
      || target.isContentEditable
      || (target.tagName === 'INPUT' && target.getAttribute('type') !== 'range')
      || Boolean(target.closest('button, [role="button"], [role="menuitem"], [role="option"], [role="combobox"], [role="listbox"], .kit-dropdown, a[href]'))
    )
    if (isInteractive)
      return
  }

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
})
</script>

<template>
  <div class="memories-panel">
    <!-- Верхняя строка: Телеметрия, Часовой пояс и Слежение камерой -->
    <div class="memories-readout">
      <div class="readout-time-group">
        <span class="time">{{ timeLabel }}</span>
        <button
          class="tz-toggle-chip"
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

      <!-- Единый аккуратный чип телеметрии по центру -->
      <div class="readout-telemetry">
        <div
          class="telemetry-pill"
          :style="{ '--act-color': currentActivityColor }"
        >
          <Icon :icon="currentActivityIcon" class="pill-icon" />
          <span class="pill-label">{{ currentActivityLabel }}</span>
          <template v-if="speedKmh !== null && speedKmh > 0.5">
            <span class="pill-sep">•</span>
            <span class="pill-speed">{{ speedKmh.toFixed(0) }} км/ч</span>
          </template>
        </div>
      </div>

      <!-- Правая часть: кнопка слежения камерой -->
      <div class="readout-actions-right">
        <button
          class="camera-follow-btn"
          :class="{ 'is-active': isFollowCamera }"
          :title="isFollowCamera ? 'Слежение камерой активно (нажмите для свободного обзора, или C)' : 'Включить слежение камерой за движением (C)'"
          @click="emit('update:isFollowCamera', !isFollowCamera)"
        >
          <Icon :icon="isFollowCamera ? 'mdi:crosshairs-gps' : 'mdi:crosshairs'" />
          <span class="camera-btn-text">{{ isFollowCamera ? 'Слежение' : 'Свободная' }}</span>
        </button>
      </div>
    </div>

    <!-- Интеллектуальный таймлайн со сегментами активности и превью -->
    <div class="timeline-container">
      <span class="timeline-bound-time start">{{ formattedStart }}</span>

      <div
        ref="timelineBarRef"
        class="timeline-track-wrap"
        @mousemove="handleTimelineMouseMove"
        @mouseleave="handleTimelineMouseLeave"
      >
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

        <!-- Нативный ползунок range для плавного скраббинга и доступности -->
        <input
          v-model.number="currentT"
          class="memories-slider"
          type="range"
          :min="dayStart"
          :max="dayEnd"
          step="1000"
          :disabled="dayEnd === 0"
          aria-label="Временная шкала трека"
        >
      </div>

      <span class="timeline-bound-time end">{{ formattedEnd }}</span>
    </div>

    <!-- Кнопки управления воспроизведением и селектор скорости -->
    <div class="memories-actions">
      <!-- Левый вспомогательный блок (счетчик точек при наличии) -->
      <div class="actions-left">
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
          class="control-btn"
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
          :disabled="dayEnd === 0"
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
          class="control-btn"
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
            <button class="speed-pill-btn" type="button" title="Скорость воспроизведения">
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
  padding: 12px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: var(--s-l);
  user-select: none;

  /* ── 1. Верхняя инфо-строка ── */
  .memories-readout {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
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

    .readout-actions-right {
      justify-self: end;
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      height: 28px;

      .camera-follow-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 28px;
        box-sizing: border-box;
        padding: 0 11px;
        border-radius: var(--r-full);
        border: 1px solid var(--border-secondary-color);
        background: var(--bg-tertiary-color);
        color: var(--fg-secondary-color);
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;

        svg {
          font-size: 1.05rem;
        }

        &:hover {
          background: var(--bg-hover-color);
          color: var(--fg-primary-color);
        }

        &.is-active {
          background: rgba(var(--fg-accent-color-rgb, 59, 130, 246), 0.18);
          border-color: var(--border-accent-color);
          color: var(--fg-accent-color);
          font-weight: 600;
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

    .timeline-bound-time {
      font-size: 0.76rem;
      font-weight: 500;
      color: var(--fg-tertiary-color);
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
      min-width: 36px;

      &.start {
        text-align: right;
      }

      &.end {
        text-align: left;
      }
    }

    .timeline-track-wrap {
      position: relative;
      flex: 1;
      height: 24px;
      display: flex;
      align-items: center;
      cursor: pointer;

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
        z-index: 5;

        &:focus {
          outline: none;
        }

        &::-webkit-slider-runnable-track {
          background: transparent;
          border: none;
          height: 100%;
        }

        &::-moz-range-track {
          background: transparent;
          border: none;
          height: 100%;
        }

        &::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid var(--fg-accent-color);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
          margin-top: 5px;
          cursor: grab;
          transition:
            transform 0.12s ease,
            box-shadow 0.12s ease;
        }

        &::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid var(--fg-accent-color);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
          cursor: grab;
          transition:
            transform 0.12s ease,
            box-shadow 0.12s ease;
        }

        &:active::-webkit-slider-thumb {
          cursor: grabbing;
          transform: scale(1.25);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
        }

        &:active::-moz-range-thumb {
          cursor: grabbing;
          transform: scale(1.25);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
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

  /* ── Адаптивность для мобильных устройств ── */
  @media (max-width: 640px) {
    bottom: 8px;
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
            max-width: 90px;
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

      .readout-actions-right {
        flex-shrink: 0;
        height: 26px;
        justify-self: auto;

        .camera-follow-btn {
          height: 26px;
          padding: 0 8px;

          .camera-btn-text {
            display: none;
          }
        }
      }
    }

    .timeline-container {
      .timeline-bound-time {
        font-size: 0.68rem;
        min-width: 30px;
      }
    }

    .memories-actions {
      .actions-left {
        display: none;
      }

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
</style>
