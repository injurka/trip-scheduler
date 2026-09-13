<script setup lang="ts">
import type { ActivityBreakdownItem } from '../models/types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS } from '../models/constants'

interface Props {
  activities: ActivityBreakdownItem[]
  formatDistance: (m: number) => string
  formatDuration: (ms: number) => string
}

const props = defineProps<Props>()

const visibleActivities = computed(() => {
  return props.activities.filter(item => item.distanceM > 0 || item.durationMs > 60_000)
})

const totalDistance = computed(() => {
  return props.activities.reduce((sum, item) => sum + item.distanceM, 0)
})

function getDistanceShare(distanceM: number): number | null {
  if (totalDistance.value <= 0 || distanceM <= 0)
    return null
  return Math.round((distanceM / totalDistance.value) * 100)
}
</script>

<template>
  <ul v-if="visibleActivities.length > 0" class="activity-breakdown-list">
    <li
      v-for="a in visibleActivities"
      :key="a.activity"
      class="activity-row"
      :style="{ '--act-color': ACTIVITY_COLORS[a.activity] || '#9e9e9e' }"
    >
      <div class="activity-lead">
        <div class="activity-icon-badge">
          <Icon
            :icon="ACTIVITY_ICONS[a.activity] || 'mdi:help-circle-outline'"
            class="activity-icon"
          />
        </div>
        <span class="activity-name">{{ ACTIVITY_LABELS[a.activity] || a.activity }}</span>
        <span
          v-if="getDistanceShare(a.distanceM)"
          class="activity-share-badge"
        >
          {{ getDistanceShare(a.distanceM) }}%
        </span>
      </div>

      <span
        class="activity-distance"
        :class="{ 'is-zero': a.distanceM === 0 }"
      >
        {{ a.distanceM > 0 ? props.formatDistance(a.distanceM) : '—' }}
      </span>
      <span class="activity-duration">{{ props.formatDuration(a.durationMs) }}</span>
    </li>
  </ul>
</template>

<style scoped lang="scss">
.activity-breakdown-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.activity-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: var(--p-s);
  align-items: center;
  font-size: 0.86rem;
  padding: 5px 8px;
  border-radius: var(--r-s);
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--bg-tertiary-color);
  }

  .activity-lead {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;

    .activity-icon-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: var(--r-xs);
      flex-shrink: 0;
      background-color: color-mix(in srgb, var(--act-color, currentColor) 12%, transparent);
      color: var(--act-color, currentColor);

      .activity-icon {
        font-size: 1rem;
      }
    }

    .activity-name {
      color: var(--fg-primary-color);
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .activity-share-badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: var(--r-full);
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
      color: var(--act-color, currentColor);
      background-color: color-mix(in srgb, var(--act-color, currentColor) 8%, transparent);
    }
  }

  .activity-distance {
    font-variant-numeric: tabular-nums;
    color: var(--fg-primary-color);
    font-weight: 500;
    text-align: right;
    min-width: 4.5rem;

    &.is-zero {
      color: var(--fg-muted-color);
      font-weight: 400;
    }
  }

  .activity-duration {
    font-variant-numeric: tabular-nums;
    color: var(--fg-secondary-color);
    min-width: 4.8rem;
    text-align: right;
  }
}
</style>
