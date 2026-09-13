<script setup lang="ts">
import type { ActivityBreakdownItem } from '../models/types'
import { computed } from 'vue'
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from '../models/constants'

interface Props {
  activities: ActivityBreakdownItem[]
  totalDistanceM: number
  formatDistance: (m: number) => string
}

const props = defineProps<Props>()

const activeSegments = computed(() => {
  if (props.totalDistanceM <= 0)
    return []
  return props.activities
    .filter(item => item.distanceM > 0)
    .map(item => ({
      activity: item.activity,
      distanceM: item.distanceM,
      percentage: (item.distanceM / props.totalDistanceM) * 100,
      color: ACTIVITY_COLORS[item.activity] || '#9e9e9e',
      label: ACTIVITY_LABELS[item.activity] || item.activity,
    }))
})
</script>

<template>
  <div
    v-if="activeSegments.length > 0"
    class="activity-progress-bar"
    role="progressbar"
    aria-label="Распределение активности за день"
    :aria-valuenow="100"
  >
    <div
      v-for="seg in activeSegments"
      :key="seg.activity"
      class="progress-segment"
      :style="{
        '--seg-width': `${seg.percentage}%`,
        '--seg-bg': seg.color,
      }"
      :title="`${seg.label}: ${props.formatDistance(seg.distanceM)} (${Math.round(seg.percentage)}%)`"
    />
  </div>
</template>

<style scoped lang="scss">
.activity-progress-bar {
  display: flex;
  height: 8px;
  border-radius: var(--r-full);
  overflow: hidden;
  background-color: var(--bg-tertiary-color);
  width: 100%;
  gap: 2px;
  padding: 1px;
  border: 1px solid var(--border-secondary-color);

  .progress-segment {
    height: 100%;
    width: var(--seg-width);
    background-color: var(--seg-bg);
    border-radius: 3px;
    transition:
      width 0.3s ease,
      filter 0.2s ease;

    &:hover {
      filter: brightness(1.2);
    }
  }
}
</style>
