<script setup lang="ts">
import type { ActivityBreakdownItem } from '../models/types'
import { Icon } from '@iconify/vue'
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
</script>

<template>
  <ul v-if="visibleActivities.length > 0" class="activity-breakdown-list">
    <li
      v-for="a in visibleActivities"
      :key="a.activity"
      class="activity-row"
    >
      <div class="activity-lead">
        <Icon
          :icon="ACTIVITY_ICONS[a.activity] || 'mdi:help-circle-outline'"
          class="activity-icon"
          :style="{ color: ACTIVITY_COLORS[a.activity] }"
        />
        <span class="activity-name">{{ ACTIVITY_LABELS[a.activity] || a.activity }}</span>
      </div>
      <span class="activity-distance">{{ props.formatDistance(a.distanceM) }}</span>
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
  gap: 6px;
}

.activity-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: var(--p-s);
  align-items: center;
  font-size: 0.88rem;
  padding: 2px 0;

  .activity-lead {
    display: flex;
    align-items: center;
    gap: 8px;

    .activity-icon {
      font-size: 1.15rem;
    }

    .activity-name {
      color: var(--fg-primary-color);
    }
  }

  .activity-distance,
  .activity-duration {
    font-variant-numeric: tabular-nums;
    color: var(--fg-secondary-color);
  }

  .activity-duration {
    min-width: 5.5em;
    text-align: right;
  }
}
</style>
