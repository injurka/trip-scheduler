<script setup lang="ts">
import type { DaySummary } from '../models/types'
import { Icon } from '@iconify/vue'
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
    <div class="day-head">
      <div class="day-title-group">
        <h2 class="day-title">
          {{ props.formatDay(props.summary.dayUtc) }}
        </h2>
        <span v-if="props.isToday && props.isLiveRecording" class="live-recording-badge">
          <span class="live-dot" />
          Запись
        </span>
      </div>

      <span v-if="props.summary.firstPointTs && props.summary.lastPointTs" class="day-range">
        <Icon icon="mdi:clock-time-four-outline" class="range-icon" />
        {{ props.formatTime(props.summary.firstPointTs) }} – {{ props.formatTime(props.summary.lastPointTs) }}
      </span>
    </div>

    <div class="day-totals-row">
      <div class="totals-stat">
        <span class="stat-value">{{ props.formatDistance(props.summary.totalDistanceM) }}</span>
        <span class="stat-label">расстояние</span>
      </div>
      <div class="stat-divider" />
      <div class="totals-stat">
        <span class="stat-value">{{ props.formatDuration(props.summary.totalDurationMs) }}</span>
        <span class="stat-label">время в пути</span>
      </div>

      <div class="map-action">
        <KitBtn
          variant="tonal"
          size="xs"
          color="primary"
          @click.stop="handleClick"
        >
          <template #prepend>
            <Icon icon="mdi:map-search-outline" />
          </template>
          На карту
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

  &:hover,
  &:focus-visible {
    border-color: var(--border-focus-color);
    transform: translateY(-2px);
    box-shadow: var(--s-m);
  }

  &.is-today {
    border-color: var(--border-success-color);
    background: linear-gradient(180deg, var(--bg-hover-color) 0%, var(--bg-secondary-color) 100%);
  }

  .day-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--p-s);

    .day-title-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .day-title {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--fg-primary-color);
      text-transform: capitalize;
      margin: 0;
    }

    .live-recording-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 7px;
      border-radius: var(--r-full);
      font-size: 0.7rem;
      font-weight: 600;
      background-color: var(--bg-success-color);
      color: var(--fg-success-color);

      .live-dot {
        width: 6px;
        height: 6px;
        border-radius: var(--r-full);
        background-color: var(--fg-success-color);
        animation: pulse 1.5s infinite;
      }
    }

    .day-range {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8rem;
      color: var(--fg-secondary-color);
      font-variant-numeric: tabular-nums;

      .range-icon {
        font-size: 0.95rem;
      }
    }
  }

  .day-totals-row {
    display: flex;
    align-items: center;
    gap: var(--p-m);
    padding: var(--p-xs) var(--p-s);
    background-color: var(--bg-tertiary-color);
    border-radius: var(--r-s);

    .totals-stat {
      display: flex;
      flex-direction: column;

      .stat-value {
        font-size: 1.15rem;
        font-weight: 700;
        color: var(--fg-primary-color);
        font-variant-numeric: tabular-nums;
      }

      .stat-label {
        font-size: 0.72rem;
        color: var(--fg-secondary-color);
      }
    }

    .stat-divider {
      width: 1px;
      height: 28px;
      background-color: var(--border-secondary-color);
    }

    .map-action {
      margin-left: auto;
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
