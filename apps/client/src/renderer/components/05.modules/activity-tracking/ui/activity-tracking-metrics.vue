<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface Props {
  overallDistanceFormatted: string
  overallDurationFormatted: string
  activeDaysCount: number
  selectedDays?: number
}

const props = withDefaults(defineProps<Props>(), {
  selectedDays: 14,
})
</script>

<template>
  <div class="metrics-grid">
    <div class="metric-card">
      <div class="metric-icon distance">
        <Icon icon="mdi:map-marker-distance" />
      </div>
      <div class="metric-info">
        <span class="metric-value">{{ props.overallDistanceFormatted }}</span>
        <span class="metric-label">Дистанция за {{ props.selectedDays }} дн.</span>
      </div>
    </div>

    <div class="metric-card">
      <div class="metric-icon duration">
        <Icon icon="mdi:timer-outline" />
      </div>
      <div class="metric-info">
        <span class="metric-value">{{ props.overallDurationFormatted }}</span>
        <span class="metric-label">В движении</span>
      </div>
    </div>

    <div class="metric-card">
      <div class="metric-icon days">
        <Icon icon="mdi:calendar-check-outline" />
      </div>
      <div class="metric-info">
        <span class="metric-value">{{ props.activeDaysCount }}</span>
        <span class="metric-label">Дней с активностью</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--p-s);

  .metric-card {
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    padding: var(--p-s) var(--p-m);
    display: flex;
    align-items: center;
    gap: var(--p-s);
    box-shadow: var(--s-xs);

    .metric-icon {
      width: 40px;
      height: 40px;
      border-radius: var(--r-s);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
      flex-shrink: 0;

      &.distance {
        background-color: var(--bg-info-color);
        color: var(--fg-info-color);
      }

      &.duration {
        background-color: var(--bg-warning-color);
        color: var(--fg-warning-color);
      }

      &.days {
        background-color: var(--bg-success-color);
        color: var(--fg-success-color);
      }
    }

    .metric-info {
      display: flex;
      flex-direction: column;

      .metric-value {
        font-size: 1.25rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--fg-primary-color);
      }

      .metric-label {
        font-size: 0.78rem;
        color: var(--fg-secondary-color);
      }
    }
  }
}
</style>
