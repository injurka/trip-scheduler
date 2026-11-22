<script setup lang="ts">
import type { DaySummary } from '~/components/03.domain/activity-day-summary/types'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import ActivityDayCard from '~/components/03.domain/activity-day-summary/activity-day-card.vue'
import { formatActivityDay, formatActivityDistance, formatActivityDuration, formatActivityTime } from '~/components/03.domain/activity-day-summary/format'
import DayTrackLoadingIndicator from './day-track-loading-indicator.vue'

interface Props {
  isLoading: boolean
  summary?: DaySummary
  summaryTimeZone?: string
  summaryIsToday?: boolean
  loadError: string | null
  selectedDay: string
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'retry', day: string): void
}>()
</script>

<template>
  <!-- Оверлей загрузки -->
  <div v-if="isLoading" class="memories-overlay">
    <div v-if="summary?.hasData" class="summary-scroll">
      <ActivityDayCard
        :summary="summary"
        :is-today="summaryIsToday"
        :format-day="day => formatActivityDay(day, !!summaryIsToday)"
        :format-distance="formatActivityDistance"
        :format-duration="formatActivityDuration"
        :format-time="ts => formatActivityTime(ts, summaryTimeZone)"
        loading
      >
        <template #loading>
          <DayTrackLoadingIndicator />
        </template>
      </ActivityDayCard>
    </div>
    <div v-else class="overlay-card is-loading">
      <DayTrackLoadingIndicator />
    </div>
  </div>

  <!-- Оверлей ошибки -->
  <div v-else-if="loadError" class="memories-overlay">
    <div class="overlay-card is-error">
      <Icon icon="mdi:alert-circle-outline" class="overlay-icon" />
      <span>{{ loadError }}</span>
      <KitBtn size="xs" variant="outlined" @click="emit('retry', selectedDay)">
        Повторить
      </KitBtn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.memories-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  z-index: 15;

  .overlay-card {
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    padding: 16px 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: var(--s-l);
    color: var(--fg-primary-color);

    .overlay-icon {
      font-size: 1.5rem;
    }

    &.is-loading {
      width: min(100% - 24px, 280px);
      padding: 12px;
    }

    &.is-error {
      color: #ef5350;
      flex-direction: column;
    }
  }
}

.summary-scroll {
  container-type: inline-size;
  width: min(100% - 24px, 520px);
  max-height: calc(100% - 136px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 2px;
  border-radius: var(--r-m);
  box-shadow: var(--s-l);
}
</style>
