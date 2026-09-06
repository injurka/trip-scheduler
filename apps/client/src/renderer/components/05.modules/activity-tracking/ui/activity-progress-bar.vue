<script setup lang="ts">
import type { ActivityBreakdownItem } from '../models/types'
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
  <div v-if="activeSegments.length > 0" class="activity-progress-bar" role="progressbar" :aria-valuenow="100">
    <div
      v-for="seg in activeSegments"
      :key="seg.activity"
      class="progress-segment"
      :style="{
        width: `${seg.percentage}%`,
        backgroundColor: seg.color,
      }"
      :title="`${seg.label}: ${props.formatDistance(seg.distanceM)} (${Math.round(seg.percentage)}%)`"
    />
  </div>
</template>

<style scoped lang="scss">
.activity-progress-bar {
  display: flex;
  height: 6px;
  border-radius: var(--r-xs);
  overflow: hidden;
  background-color: var(--bg-tertiary-color);
  width: 100%;

  .progress-segment {
    height: 100%;
    transition: width 0.3s ease;
  }
}
</style>
