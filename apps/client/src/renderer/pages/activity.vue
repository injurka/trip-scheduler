<script setup lang="ts">
import type { ActivityType } from '~/shared/services/tracking/track-processing'
// Страница «Активность» (подвижность): сводки за сегодня и прошлые дни
// + тумблер фонового трекинга. Открывается из profile-drawer.
import { Icon } from '@iconify/vue'
import TrackingToggle from '~/components/05.modules/activity-map/ui/memories/tracking-toggle.vue'
import { trpc } from '~/shared/services/trpc/trpc.service'

interface DaySummary {
  dayUtc: string
  totalDistanceM: number
  totalDurationMs: number
  byActivity: Array<{
    activity: ActivityType
    distanceM: number
    durationMs: number
    segmentCount: number
  }>
  firstPointTs: number | null
  lastPointTs: number | null
  hasData: boolean
}

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  still: '#9e9e9e',
  walk: '#4caf50',
  bike: '#ff9800',
  vehicle: '#2196f3',
  rail: '#9c27b0',
  unknown: '#607d8b',
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  still: 'Покой',
  walk: 'Пешком',
  bike: 'Велосипед',
  vehicle: 'Авто',
  rail: 'Поезд',
  unknown: 'Другое',
}

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  still: 'mdi:motion-pause-outline',
  walk: 'mdi:walk',
  bike: 'mdi:bike',
  vehicle: 'mdi:car-outline',
  rail: 'mdi:train',
  unknown: 'mdi:help-circle-outline',
}

const isLoading = ref(true)
const loadError = ref<string | null>(null)
const summaries = ref<DaySummary[]>([])

async function load() {
  isLoading.value = true
  loadError.value = null
  try {
    const res = await (trpc as any).tracking.getSummaries.query({ days: 14 })
    summaries.value = res.summaries
  }
  catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
  finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void load()
})

const todayUtc = new Date().toISOString().slice(0, 10)

function isToday(dayUtc: string): boolean {
  return dayUtc === todayUtc
}

function formatDay(dayUtc: string): string {
  if (isToday(dayUtc))
    return 'Сегодня'
  const d = new Date(`${dayUtc}T12:00:00Z`)
  return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatDistance(m: number): string {
  if (m < 1000)
    return `${Math.round(m)} м`
  return `${(m / 1000).toFixed(1)} км`
}

function formatDuration(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min < 60)
    return `${min} мин`
  const h = Math.floor(min / 60)
  return `${h} ч ${min % 60} мин`
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}
</script>

<template>
  <section class="activity-page content-wrapper">
    <header class="activity-header">
      <h1 class="activity-title">
        <Icon icon="mdi:map-marker-path" class="title-icon" />
        Активность
      </h1>
    </header>

    <TrackingToggle @changed="load" />

    <div class="activity-content">
      <div v-if="isLoading" class="activity-state">
        Загрузка…
      </div>
      <div v-else-if="loadError" class="activity-state is-error">
        {{ loadError }}
      </div>
      <div v-else-if="summaries.length === 0" class="activity-state">
        <Icon icon="mdi:radar" class="empty-icon" />
        <p>Данных пока нет.</p>
        <p class="hint">
          Включи фоновый трекинг — маршруты появятся здесь и в воспоминаниях дня.
        </p>
      </div>

      <template v-else>
        <article
          v-for="s in summaries"
          :key="s.dayUtc"
          class="day-card"
          :class="{ 'is-today': isToday(s.dayUtc) }"
        >
          <div class="day-head">
            <h2 class="day-title">
              {{ formatDay(s.dayUtc) }}
            </h2>
            <span class="day-range">{{ formatTime(s.firstPointTs!) }} – {{ formatTime(s.lastPointTs!) }}</span>
          </div>

          <div class="day-totals">
            <span class="total-distance">{{ formatDistance(s.totalDistanceM) }}</span>
            <span class="total-duration">{{ formatDuration(s.totalDurationMs) }}</span>
          </div>

          <ul class="activity-list">
            <li v-for="a in s.byActivity" :key="a.activity" class="activity-row">
              <Icon :icon="ACTIVITY_ICONS[a.activity]" class="activity-icon" :style="{ color: ACTIVITY_COLORS[a.activity] }" />
              <span class="activity-name">{{ ACTIVITY_LABELS[a.activity] }}</span>
              <span class="activity-distance">{{ formatDistance(a.distanceM) }}</span>
              <span class="activity-duration">{{ formatDuration(a.durationMs) }}</span>
            </li>
          </ul>
        </article>
      </template>
    </div>
  </section>
</template>

<style scoped lang="scss">
.activity-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: calc(100vh - 53px);
}

.activity-header {
  .activity-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.4rem;
    font-weight: 600;

    .title-icon {
      color: var(--primary, #4caf50);
    }
  }
}

.activity-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.activity-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--fg-secondary-color);

  &.is-error {
    color: var(--danger, #f44336);
  }

  .empty-icon {
    font-size: 2.4rem;
    opacity: 0.5;
  }

  .hint {
    font-size: 0.85rem;
    opacity: 0.7;
  }
}

.day-card {
  border: 1px solid var(--border-color, #333);
  border-radius: var(--r-m, 12px);
  padding: 12px 16px;

  &.is-today {
    border-color: var(--primary, #4caf50);
  }

  .day-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .day-title {
    font-size: 1rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .day-range {
    font-size: 0.8rem;
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
  }

  .day-totals {
    display: flex;
    gap: 16px;
    margin: 6px 0 10px;

    .total-distance {
      font-size: 1.2rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .total-duration {
      align-self: baseline;
      opacity: 0.7;
      font-variant-numeric: tabular-nums;
    }
  }

  .activity-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .activity-row {
    display: grid;
    grid-template-columns: 24px 1fr auto auto;
    gap: 10px;
    align-items: center;
    font-size: 0.9rem;
    padding: 4px 0;

    .activity-icon {
      font-size: 1.1rem;
    }

    .activity-distance,
    .activity-duration {
      font-variant-numeric: tabular-nums;
    }

    .activity-duration {
      opacity: 0.6;
      min-width: 5.5em;
      text-align: right;
    }
  }
}
</style>
