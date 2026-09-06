<script setup lang="ts">
import type { DaySummary } from '../models/types'
import ActivityDayCard from './activity-day-card.vue'

interface Props {
  days: DaySummary[]
  isToday: (dayUtc: string) => boolean
  isTrackingRunning?: boolean
  formatDay: (dayUtc: string) => string
  formatDistance: (m: number) => string
  formatDuration: (ms: number) => string
  formatTime: (ts: number | null) => string
}

const props = withDefaults(defineProps<Props>(), {
  isTrackingRunning: false,
})

const emit = defineEmits<{
  (e: 'openMap', dayUtc: string): void
}>()
</script>

<template>
  <div class="activity-tracking-days">
    <div class="days-list-header">
      <span class="list-title">Записанные дни</span>
      <span class="list-counter">{{ props.days.length }} дн.</span>
    </div>

    <div class="days-grid">
      <ActivityDayCard
        v-for="day in props.days"
        :key="day.dayUtc"
        :summary="day"
        :is-today="props.isToday(day.dayUtc)"
        :is-live-recording="props.isTrackingRunning"
        :format-day="props.formatDay"
        :format-distance="props.formatDistance"
        :format-duration="props.formatDuration"
        :format-time="props.formatTime"
        @open-map="emit('openMap', $event)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.activity-tracking-days {
  display: flex;
  flex-direction: column;
  gap: var(--p-s);
}

.days-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 2px;

  .list-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }

  .list-counter {
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
  }
}

.days-grid {
  display: flex;
  flex-direction: column;
  gap: var(--p-s);
}
</style>
