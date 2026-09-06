<script setup lang="ts">
import type { RenderSegment, TimezoneMode } from '../models/types'
import type { ActivityType } from '~/shared/services/tracking/track-processing'
import { Icon } from '@iconify/vue'
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS, SPEED_MULTIPLIERS } from '../models/types'

const props = defineProps<{
  timeLabel: string
  timezoneMode: TimezoneMode
  deviceTimezone: string
  trackTimezone: string | undefined
  currentSegment: RenderSegment | undefined
  currentActivity: ActivityType
  currentActivityColor: string
  currentActivityIcon: string
  currentActivityLabel: string
  speedKmh: number | null
  isFollowCamera: boolean
  displayPointsCount: number
  totalPointsCount: number
  t: number
  dayStart: number
  dayEnd: number
  isPlaying: boolean
  speedMultiplier: number
  timeRangeFormatted: string
}>()

const emit = defineEmits<{
  (e: 'update:t', val: number): void
  (e: 'update:isPlaying', val: boolean): void
  (e: 'update:speedMultiplier', val: number): void
  (e: 'update:isFollowCamera', val: boolean): void
  (e: 'toggleTimezone'): void
  (e: 'stepSeconds', delta: number): void
  (e: 'skipToNextMovement'): void
  (e: 'seekStart'): void
  (e: 'seekEnd'): void
}>()

const currentT = computed({
  get: () => props.t,
  set: (val: number) => emit('update:t', val),
})
</script>

<template>
  <div class="memories-panel">
    <div class="memories-readout">
      <div class="readout-header">
        <div class="readout-time-group">
          <span class="time">{{ timeLabel }}</span>
          <button
            class="tz-toggle-chip"
            :class="{ 'is-track': timezoneMode === 'track', 'is-device': timezoneMode === 'device' }"
            :title="timezoneMode === 'track'
              ? `Показывается местное время в месте записи${trackTimezone ? ` (${trackTimezone})` : ''}. Нажмите для переключения на локальное время устройства (${deviceTimezone})`
              : `Показывается локальное время устройства (${deviceTimezone}). Нажмите для переключения на местное время записи${trackTimezone ? ` (${trackTimezone})` : ''}`"
            @click="emit('toggleTimezone')"
          >
            {{ timezoneMode === 'track' ? 'Местное' : 'Локальное' }}
          </button>
        </div>

        <div class="track-stats-right">
          <button
            class="camera-follow-btn"
            :class="{ 'is-active': isFollowCamera }"
            title="Слежение камерой за движением"
            @click="emit('update:isFollowCamera', !isFollowCamera)"
          >
            <Icon :icon="isFollowCamera ? 'mdi:crosshairs-gps' : 'mdi:crosshairs'" />
            <span class="camera-btn-text">{{ isFollowCamera ? 'Слежение' : 'Свободная' }}</span>
          </button>
          <span
            class="points-count"
            :title="totalPointsCount !== displayPointsCount ? `Отображается ${displayPointsCount} объединенных точек из ${totalPointsCount} исходных` : ''"
          >
            {{ displayPointsCount }} точек
            <span v-if="totalPointsCount !== displayPointsCount" class="raw-count-sub">({{ totalPointsCount }})</span>
          </span>
        </div>
      </div>

      <div v-if="currentSegment || speedKmh !== null" class="readout-badges">
        <div
          v-if="currentSegment"
          class="activity-badge"
          :style="{
            backgroundColor: `${ACTIVITY_COLORS[currentSegment.activity]}20`,
            color: ACTIVITY_COLORS[currentSegment.activity],
            borderColor: `${ACTIVITY_COLORS[currentSegment.activity]}40`,
          }"
        >
          <Icon :icon="ACTIVITY_ICONS[currentSegment.activity]" />
          <span>{{ ACTIVITY_LABELS[currentSegment.activity] }}</span>
        </div>

        <div v-if="speedKmh !== null" class="speed-badge">
          <Icon icon="mdi:speedometer" />
          <span>{{ speedKmh.toFixed(0) }} км/ч</span>
        </div>
      </div>
    </div>

    <!-- Ползунок таймлайна -->
    <div class="slider-container">
      <input
        v-model.number="currentT"
        class="memories-slider"
        type="range"
        :min="dayStart"
        :max="dayEnd"
        step="1000"
        :disabled="dayEnd === 0"
      >
    </div>

    <!-- Кнопки управления воспроизведением -->
    <div class="memories-actions">
      <div class="playback-controls">
        <button
          class="control-btn"
          aria-label="В начало дня"
          title="В начало"
          @click="emit('seekStart')"
        >
          <Icon icon="mdi:skip-backward" />
        </button>

        <button
          class="control-btn step-btn"
          aria-label="Назад на 15 секунд"
          title="-15 сек"
          @click="emit('stepSeconds', -15)"
        >
          <Icon icon="mdi:rewind-15" />
        </button>

        <button
          class="control-btn play-btn"
          :disabled="dayEnd === 0"
          :aria-label="isPlaying ? 'Пауза' : 'Воспроизвести'"
          :title="isPlaying ? 'Пауза' : 'Воспроизведение'"
          @click="emit('update:isPlaying', !isPlaying)"
        >
          <Icon :icon="isPlaying ? 'mdi:pause' : 'mdi:play'" />
        </button>

        <button
          class="control-btn step-btn"
          aria-label="Вперед на 15 секунд"
          title="+15 сек"
          @click="emit('stepSeconds', 15)"
        >
          <Icon icon="mdi:fast-forward-15" />
        </button>

        <button
          class="control-btn skip-still-btn"
          :disabled="dayEnd === 0"
          aria-label="Пропустить стоянку / к следующему движению"
          title="Пропустить стоянку (к движению)"
          @click="emit('skipToNextMovement')"
        >
          <Icon icon="mdi:motion-play-outline" />
        </button>

        <button
          class="control-btn"
          aria-label="В конец дня"
          title="В конец"
          @click="emit('seekEnd')"
        >
          <Icon icon="mdi:skip-forward" />
        </button>
      </div>

      <!-- Переключатель множителя скорости -->
      <div class="speed-selector">
        <button
          v-for="s in SPEED_MULTIPLIERS"
          :key="s"
          class="speed-chip"
          :class="{ 'is-active': speedMultiplier === s }"
          @click="emit('update:speedMultiplier', s)"
        >
          {{ s }}x
        </button>
      </div>

      <div class="time-range-display">
        <span class="range">{{ timeRangeFormatted }}</span>
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
  z-index: 20;
  background-color: var(--bg-secondary-color);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 12px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: var(--s-l);

  .memories-readout {
    display: flex;
    align-items: center;
    gap: 12px;
    font-variant-numeric: tabular-nums;

    .readout-header {
      display: contents;
    }

    .readout-time-group {
      order: 1;
      display: flex;
      align-items: baseline;
      gap: 6px;

      .time {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--fg-primary-color);
      }

      .tz-toggle-chip {
        font-size: 0.68rem;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: var(--r-full);
        border: 1px solid var(--border-secondary-color);
        background: var(--bg-tertiary-color);
        color: var(--fg-secondary-color);
        cursor: pointer;
        transition: all 0.2s;
        line-height: 1.2;
        user-select: none;

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

        &.is-device {
          background: var(--bg-tertiary-color);
          color: var(--fg-secondary-color);
          border-color: var(--border-secondary-color);
        }
      }
    }

    .readout-badges {
      order: 2;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .activity-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: var(--r-full);
      font-size: 0.8rem;
      font-weight: 600;
      border: 1px solid;
    }

    .speed-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.82rem;
      color: var(--fg-secondary-color);
    }

    .track-stats-right {
      order: 3;
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.78rem;
      color: var(--fg-secondary-color);

      .camera-follow-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: var(--r-full);
        border: 1px solid var(--border-secondary-color);
        background: var(--bg-tertiary-color);
        color: var(--fg-secondary-color);
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;

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

        @media (max-width: 600px) {
          .camera-btn-text {
            display: none;
          }
        }
      }

      .points-count {
        white-space: nowrap;

        .raw-count-sub {
          font-size: 0.68rem;
          opacity: 0.65;
          margin-left: 2px;
        }
      }
    }
  }

  .slider-container {
    width: 100%;
    display: flex;
    align-items: center;

    .memories-slider {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      outline: none;
      accent-color: var(--fg-accent-color);
      cursor: pointer;
    }
  }

  .memories-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

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
        font-size: 1.1rem;
        transition:
          background-color 0.2s,
          transform 0.1s;

        &:hover:not(:disabled) {
          background: var(--bg-hover-color);
        }

        &:active:not(:disabled) {
          transform: scale(0.95);
        }

        &.step-btn {
          font-size: 1.15rem;
        }

        &.skip-still-btn {
          font-size: 1.1rem;
          color: var(--fg-secondary-color);

          &:hover:not(:disabled) {
            color: var(--fg-accent-color);
          }
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

    .speed-selector {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--bg-tertiary-color);
      border: 1px solid var(--border-secondary-color);
      padding: 3px;
      border-radius: var(--r-full);

      .speed-chip {
        padding: 2px 8px;
        border-radius: var(--r-full);
        font-size: 0.72rem;
        font-weight: 600;
        border: none;
        background: transparent;
        color: var(--fg-secondary-color);
        cursor: pointer;
        transition: all 0.2s;

        &.is-active {
          background: var(--bg-hover-color);
          color: var(--fg-primary-color);
        }
      }
    }

    .time-range-display {
      font-size: 0.8rem;
      color: var(--fg-secondary-color);
      font-variant-numeric: tabular-nums;
    }
  }

  @media (max-width: 640px) {
    bottom: 8px;
    left: 8px;
    right: 8px;
    padding: 10px 12px;
    gap: 8px;

    .memories-readout {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 6px;

      .readout-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        gap: 8px;
      }

      .readout-time-group {
        order: 1;

        .time {
          font-size: 1.1rem;
        }

        .tz-toggle-chip {
          padding: 2px 6px;
          font-size: 0.65rem;
        }
      }

      .readout-badges {
        order: 2;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }

      .activity-badge {
        padding: 2px 7px;
        font-size: 0.74rem;
      }

      .speed-badge {
        font-size: 0.74rem;
      }

      .track-stats-right {
        order: 2;
        margin-left: 0;
        gap: 6px;
        font-size: 0.72rem;

        .camera-follow-btn {
          padding: 3px 6px;

          .camera-btn-text {
            display: none;
          }
        }

        .points-count {
          font-size: 0.7rem;
        }
      }
    }

    .slider-container {
      margin: 2px 0;
    }

    .memories-actions {
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;

      .playback-controls {
        order: 1;
        gap: 6px;

        .control-btn {
          width: 32px;
          height: 32px;
          font-size: 1rem;

          &.play-btn {
            width: 38px;
            height: 38px;
            font-size: 1.2rem;
          }
        }
      }

      .speed-selector {
        order: 2;
        padding: 2px;
        gap: 2px;

        .speed-chip {
          padding: 2px 6px;
          font-size: 0.68rem;
        }
      }

      .time-range-display {
        order: 3;
        width: 100%;
        text-align: center;
        font-size: 0.72rem;
        margin-top: -2px;
      }
    }
  }
}
</style>
