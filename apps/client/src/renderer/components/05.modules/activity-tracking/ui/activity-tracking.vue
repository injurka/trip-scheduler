<script setup lang="ts">
import { useScrollLock } from '@vueuse/core'
import { watch } from 'vue'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import DayMemoriesPlayer from '~/components/05.modules/activity-map/ui/memories/day-memories-player.vue'
import { isMobile } from '~/shared/lib/env'
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
  isPlayerOpen,
  playerDayUtc,
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
  closePlayer,
} = useActivityTracking()

const isBodyScrollLocked = useScrollLock(typeof document !== 'undefined' ? document.body : null)
const isHtmlScrollLocked = useScrollLock(typeof document !== 'undefined' ? document.documentElement : null)

watch(isPlayerOpen, (open) => {
  isBodyScrollLocked.value = open
  isHtmlScrollLocked.value = open
})

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

    <!-- Drawer просмотра GPS-трекинга на карте -->
    <Teleport to="body">
      <Transition name="tracking-drawer">
        <div
          v-if="isPlayerOpen"
          class="tracking-drawer-overlay"
          @click.self="closePlayer"
          @touchmove.self.prevent
        >
          <div class="tracking-drawer-sheet">
            <div v-if="isMobile" class="drawer-handle-bar">
              <span class="drawer-drag-handle" />
            </div>

            <DayMemoriesPlayer
              class="tracking-player-embedded"
              :day-utc="playerDayUtc"
              @close="closePlayer"
              @back="closePlayer"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
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

.tracking-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.tracking-drawer-sheet {
  width: 100%;
  height: 94dvh;
  max-height: calc(100dvh - var(--safe-area-inset-top) - 8px);
  background-color: var(--bg-primary-color);
  border-radius: var(--r-xl) var(--r-xl) 0 0;
  border: 1px solid var(--border-secondary-color);
  border-bottom: none;
  box-shadow: var(--s-xl);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;

  .drawer-handle-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 0 4px;
    background-color: var(--bg-secondary-color);
    border-bottom: 1px solid var(--border-secondary-color);
    flex-shrink: 0;

    @include media-up(md) {
      display: none;
    }

    .drawer-drag-handle {
      width: 44px;
      height: 4px;
      border-radius: var(--r-full);
      background-color: var(--border-primary-color);
    }
  }

  .tracking-player-embedded {
    flex: 1;
    min-height: 0;
    width: 100%;
    height: 100%;
  }
}

.tracking-drawer-enter-active,
.tracking-drawer-leave-active {
  transition: opacity 0.25s ease;

  .tracking-drawer-sheet {
    transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
  }
}

.tracking-drawer-enter-from,
.tracking-drawer-leave-to {
  opacity: 0;

  .tracking-drawer-sheet {
    transform: translateY(100%);
  }
}
</style>
