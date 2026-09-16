<script setup lang="ts">
import type { DaySummary } from '../models/types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import ActivityBreakdownList from './activity-breakdown-list.vue'
import ActivityProgressBar from './activity-progress-bar.vue'

interface Props {
  summary: DaySummary
  isToday?: boolean
  isLiveRecording?: boolean
  formatDay: (dayUtc: string) => string
  formatDistance: (m: number) => string
  formatDuration: (ms: number) => string
  formatTime: (ts: number | null) => string
}

const props = withDefaults(defineProps<Props>(), {
  isToday: false,
  isLiveRecording: false,
})

const emit = defineEmits<{
  (e: 'openMap', dayUtc: string): void
}>()

const formattedDateSubtitle = computed(() => {
  if (!props.isToday)
    return null
  const d = new Date(`${props.summary.dayUtc}T12:00:00Z`)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
})

function handleClick() {
  emit('openMap', props.summary.dayUtc)
}
</script>

<template>
  <article
    class="activity-day-card"
    :class="{ 'is-today': props.isToday }"
    tabindex="0"
    role="button"
    @click="handleClick"
    @keydown.enter="handleClick"
  >
    <header class="day-head">
      <div class="day-title-group">
        <h2 class="day-title">
          {{ props.formatDay(props.summary.dayUtc) }}
        </h2>
        <span v-if="props.isToday && formattedDateSubtitle" class="day-subtitle">
          {{ formattedDateSubtitle }}
        </span>
        <span v-if="props.isToday && props.isLiveRecording" class="live-recording-badge">
          <span class="live-dot" />
          Запись
        </span>
      </div>

      <span v-if="props.summary.firstPointTs && props.summary.lastPointTs" class="day-range">
        <Icon icon="mdi:clock-outline" class="range-icon" />
        {{ props.formatTime(props.summary.firstPointTs) }} – {{ props.formatTime(props.summary.lastPointTs) }}
      </span>
    </header>

    <div class="day-totals-row">
      <div class="totals-stats-group">
        <div class="totals-stat">
          <div class="stat-icon-wrapper distance">
            <Icon icon="mdi:map-marker-distance" />
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ props.formatDistance(props.summary.totalDistanceM) }}</span>
            <span class="stat-label">дистанция</span>
          </div>
        </div>

        <div class="stat-divider" />

        <div class="totals-stat">
          <div class="stat-icon-wrapper duration">
            <Icon icon="mdi:timer-outline" />
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ props.formatDuration(props.summary.totalDurationMs) }}</span>
            <span class="stat-label">время в пути</span>
          </div>
        </div>
      </div>

      <div class="map-action">
        <KitBtn
          variant="tonal"
          size="xs"
          color="primary"
          icon="mdi:map-search-outline"
          class="map-btn"
          aria-label="На карту"
          @click.stop="handleClick"
        >
          <span class="map-btn-text">На карту</span>
        </KitBtn>
      </div>
    </div>

    <!-- Пропорциональная полоска видов активности -->
    <ActivityProgressBar
      v-if="props.summary.totalDistanceM > 0"
      :activities="props.summary.byActivity"
      :total-distance-m="props.summary.totalDistanceM"
      :format-distance="props.formatDistance"
    />

    <!-- Разбивка по видам активности -->
    <ActivityBreakdownList
      :activities="props.summary.byActivity"
      :format-distance="props.formatDistance"
      :format-duration="props.formatDuration"
    />
  </article>
</template>

<style scoped lang="scss">
.activity-day-card {
  position: relative;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: var(--p-m);
  display: flex;
  flex-direction: column;
  gap: var(--p-s);
  cursor: pointer;
  outline: none;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
    box-shadow: var(--s-m);
    transform: translateY(-1px);

    .map-btn {
      color: var(--fg-accent-color);
      background-color: var(--bg-hover-color);
    }
  }

  &:focus-visible {
    border-color: var(--border-focus-color);
    box-shadow: 0 0 0 2px var(--border-focus-color);
  }

  &.is-today {
    border-color: var(--border-accent-color);
    background: linear-gradient(
      180deg,
      rgba(var(--fg-accent-color-rgb, 255, 136, 86), 0.04) 0%,
      var(--bg-secondary-color) 100%
    );
    box-shadow: 0 0 0 1px rgba(var(--fg-accent-color-rgb, 255, 136, 86), 0.15);

    &:hover {
      border-color: var(--fg-accent-color);
      box-shadow:
        0 0 0 1px var(--fg-accent-color),
        var(--s-m);
    }
  }

  .day-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--p-s);
    flex-wrap: wrap;

    .day-title-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .day-title {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--fg-primary-color);
      text-transform: capitalize;
      margin: 0;
      line-height: 1.3;
    }

    .day-subtitle {
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--fg-secondary-color);
      padding: 1px 7px;
      border-radius: var(--r-2xs);
      background-color: var(--bg-tertiary-color);
      border: 1px solid var(--border-secondary-color);
    }

    .live-recording-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 8px;
      border-radius: var(--r-full);
      font-size: 0.72rem;
      font-weight: 600;
      background-color: var(--bg-success-color);
      color: var(--fg-success-color);
      border: 1px solid var(--border-success-color);
      box-shadow: 0 0 8px rgba(var(--fg-success-color-rgb, 103, 209, 116), 0.25);

      .live-dot {
        width: 6px;
        height: 6px;
        border-radius: var(--r-full);
        background-color: var(--fg-success-color);
        animation: pulse 1.5s infinite;
      }
    }

    .day-range {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.78rem;
      font-weight: 500;
      color: var(--fg-secondary-color);
      font-variant-numeric: tabular-nums;
      padding: 2px 8px;
      background-color: var(--bg-tertiary-color);
      border: 1px solid var(--border-secondary-color);
      border-radius: var(--r-full);

      .range-icon {
        font-size: 0.95rem;
        color: var(--fg-secondary-color);
      }
    }
  }

  .day-totals-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-s);
    padding: 10px 14px;
    background-color: var(--bg-tertiary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-s);
    flex-wrap: wrap;

    .totals-stats-group {
      display: flex;
      align-items: center;
      gap: var(--p-m);
      flex-wrap: wrap;
    }

    .totals-stat {
      display: flex;
      align-items: center;
      gap: 10px;

      .stat-icon-wrapper {
        width: 32px;
        height: 32px;
        border-radius: var(--r-xs);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.15rem;
        flex-shrink: 0;

        &.distance {
          background-color: var(--bg-info-color);
          color: var(--fg-info-color);
        }

        &.duration {
          background-color: var(--bg-warning-color);
          color: var(--fg-warning-color);
        }
      }

      .stat-content {
        display: flex;
        flex-direction: column;

        .stat-value {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--fg-primary-color);
          font-variant-numeric: tabular-nums;
          line-height: 1.2;
        }

        .stat-label {
          font-size: 0.72rem;
          color: var(--fg-secondary-color);
          line-height: 1.2;
        }
      }
    }

    .stat-divider {
      width: 1px;
      height: 26px;
      background-color: var(--border-secondary-color);
    }

    .map-action {
      margin-left: auto;

      .map-btn {
        transition: all 0.2s ease;

        @include media-down(sm) {
          padding: 0.375rem;

          :deep(.kit-btn-content) {
            gap: 0;
          }

          .map-btn-text {
            display: none;
          }
        }
      }
    }
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
  100% {
    opacity: 1;
  }
}
</style>
