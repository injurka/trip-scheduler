<script setup lang="ts">
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { useTrackingStore } from '~/shared/store/tracking.store'
import { useActivityTracking } from '../composables/use-activity-tracking'
import ActivityTrackingDays from './activity-tracking-days.vue'
import ActivityTrackingEmpty from './activity-tracking-empty.vue'
import ActivityTrackingHeader from './activity-tracking-header.vue'
import ActivityTrackingMetrics from './activity-tracking-metrics.vue'
import ActivityTrackingSkeleton from './activity-tracking-skeleton.vue'
import TrackingControlCard from './tracking-control-card.vue'

const trackingStore = useTrackingStore()

const {
  selectedDays,
  isLoading,
  isRefreshing,
  loadError,
  overallDistanceM,
  overallDurationMs,
  activeDaysCount,
  recordedDays,
  hasAnyData,
  loadSummaries,
  refresh,
  setDaysRange,
  isToday,
  formatDay,
  formatDistance,
  formatDuration,
  formatTime,
  openDayOnMap,
  openMemories,
} = useActivityTracking()

async function handleSync() {
  await trackingStore.syncNow()
  // После отправки точек статистика на сервере могла измениться — перезагружаем
  await loadSummaries()
}
</script>

<template>
  <div class="activity-tracking-module">
    <ActivityTrackingHeader
      :is-loading="isLoading"
      :is-refreshing="isRefreshing"
      :selected-days="selectedDays"
      @refresh="refresh"
      @select-days="setDaysRange"
      @open-memories="openMemories"
    />

    <!-- Виджет управления GPS-трекингом -->
    <TrackingControlCard @changed="refresh" />

    <!-- Содержимое со статистикой и списком дней -->
    <AsyncStateWrapper
      :loading="isLoading"
      :error="loadError"
      :data="hasAnyData ? recordedDays : null"
      :retry-handler="loadSummaries"
    >
      <template #loading>
        <ActivityTrackingSkeleton />
      </template>

      <template #empty>
        <ActivityTrackingEmpty
          :selected-days="selectedDays"
          :unsent-count="trackingStore.unsentCount"
          :is-tracking-running="trackingStore.isRunning"
          :is-syncing="trackingStore.isSyncing"
          @sync="handleSync"
          @open-memories="openMemories"
        />
      </template>

      <template #success="{ data }">
        <div class="activity-tracking-results" :class="{ 'is-refreshing': isRefreshing }">
          <ActivityTrackingMetrics
            :overall-distance-formatted="formatDistance(overallDistanceM)"
            :overall-duration-formatted="formatDuration(overallDurationMs)"
            :active-days-count="activeDaysCount"
            :selected-days="selectedDays"
          />

          <ActivityTrackingDays
            :days="data"
            :is-today="isToday"
            :is-tracking-running="trackingStore.isRunning"
            :format-day="formatDay"
            :format-distance="formatDistance"
            :format-duration="formatDuration"
            :format-time="formatTime"
            @open-map="openDayOnMap"
          />
        </div>
      </template>
    </AsyncStateWrapper>
  </div>
</template>

<style scoped lang="scss">
.activity-tracking-module {
  max-width: 860px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--p-m);
}

.activity-tracking-results {
  display: flex;
  flex-direction: column;
  gap: var(--p-m);
  transition: opacity 0.2s ease;

  &.is-refreshing {
    opacity: 0.65;
    pointer-events: none;
  }
}
</style>
