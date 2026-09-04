<script setup lang="ts">
import type { ActivityType } from '~/shared/services/tracking/track-processing'
import { Icon } from '@iconify/vue'
import TrackingToggle from '~/components/05.modules/activity-map/ui/memories/tracking-toggle.vue'
import { AppRouteNames } from '~/shared/constants/routes'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { useTrackingStore } from '~/shared/store/tracking.store'

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

const router = useRouter()
const trackingStore = useTrackingStore()

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

const overallDistanceM = computed(() =>
  summaries.value.reduce((sum, s) => sum + s.totalDistanceM, 0),
)

const overallDurationMs = computed(() =>
  summaries.value.reduce((sum, s) => sum + s.totalDurationMs, 0),
)

const activeDaysCount = computed(() =>
  summaries.value.filter(s => s.hasData && s.totalDistanceM > 0).length,
)

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
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })
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

function formatTime(ts: number | null): string {
  if (!ts)
    return '--:--'
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

function openDayOnMap(dayUtc: string) {
  router.push({
    name: AppRouteNames.ActivityMap,
    query: { view: 'memories', day: dayUtc },
  })
}
</script>

<template>
  <section class="activity-page content-wrapper">
    <header class="activity-header">
      <div class="header-main">
        <h1 class="activity-title">
          <Icon icon="mdi:map-marker-path" class="title-icon" />
          Активность и GPS
        </h1>
        <p class="activity-desc">
          История перемещений, статистика видов транспорта и трекинг в реальном времени
        </p>
      </div>

      <KitBtn
        variant="tonal"
        size="sm"
        :loading="isLoading"
        @click="load"
      >
        <template #prepend>
          <Icon icon="mdi:refresh" />
        </template>
        Обновить
      </KitBtn>
    </header>

    <!-- Виджет управления трекингом -->
    <TrackingToggle @changed="load" />

    <!-- Сводка за последние 14 дней -->
    <div v-if="summaries.length > 0 && activeDaysCount > 0" class="metrics-grid">
      <div class="metric-card">
        <div class="metric-icon distance">
          <Icon icon="mdi:map-marker-distance" />
        </div>
        <div class="metric-info">
          <span class="metric-value">{{ formatDistance(overallDistanceM) }}</span>
          <span class="metric-label">Дистанция за 14 дней</span>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon duration">
          <Icon icon="mdi:timer-outline" />
        </div>
        <div class="metric-info">
          <span class="metric-value">{{ formatDuration(overallDurationMs) }}</span>
          <span class="metric-label">В движении</span>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon days">
          <Icon icon="mdi:calendar-check-outline" />
        </div>
        <div class="metric-info">
          <span class="metric-value">{{ activeDaysCount }}</span>
          <span class="metric-label">Дней с активностью</span>
        </div>
      </div>
    </div>

    <!-- Список дней -->
    <div class="activity-content">
      <div v-if="isLoading" class="activity-state">
        <Icon icon="mdi:loading" class="spin state-icon" />
        <p>Загрузка статистики перемещений…</p>
      </div>

      <div v-else-if="loadError" class="activity-state is-error">
        <Icon icon="mdi:alert-circle-outline" class="state-icon" />
        <p>{{ loadError }}</p>
        <KitBtn variant="outlined" size="sm" @click="load">
          Повторить
        </KitBtn>
      </div>

      <div v-else-if="summaries.length === 0 || activeDaysCount === 0" class="activity-state empty-state">
        <div class="empty-icon-wrap">
          <Icon icon="mdi:radar" class="empty-icon" />
        </div>
        <h3 class="empty-title">
          Маршрутов пока нет
        </h3>
        <p class="empty-hint">
          Включите переключатель фонового GPS-трекинга выше, и ваши перемещения начнут автоматически сохраняться и отображаться на карте воспоминаний.
        </p>
      </div>

      <template v-else>
        <div class="days-list-header">
          <span class="list-title">Записанные дни</span>
          <span class="list-counter">{{ summaries.filter(s => s.hasData).length }} дней</span>
        </div>

        <div class="days-grid">
          <article
            v-for="s in summaries.filter(s => s.hasData)"
            :key="s.dayUtc"
            class="day-card"
            :class="{ 'is-today': isToday(s.dayUtc) }"
            @click="openDayOnMap(s.dayUtc)"
          >
            <div class="day-head">
              <div class="day-title-group">
                <h2 class="day-title">
                  {{ formatDay(s.dayUtc) }}
                </h2>
                <span v-if="isToday(s.dayUtc) && trackingStore.isRunning" class="live-recording-badge">
                  <span class="live-dot" />
                  Запись
                </span>
              </div>
              <span v-if="s.firstPointTs && s.lastPointTs" class="day-range">
                <Icon icon="mdi:clock-time-four-outline" class="range-icon" />
                {{ formatTime(s.firstPointTs) }} – {{ formatTime(s.lastPointTs) }}
              </span>
            </div>

            <div class="day-totals-row">
              <div class="totals-stat">
                <span class="stat-value">{{ formatDistance(s.totalDistanceM) }}</span>
                <span class="stat-label">расстояние</span>
              </div>
              <div class="stat-divider" />
              <div class="totals-stat">
                <span class="stat-value">{{ formatDuration(s.totalDurationMs) }}</span>
                <span class="stat-label">время в пути</span>
              </div>

              <div class="map-action">
                <KitBtn variant="tonal" size="xs" color="primary">
                  <template #prepend>
                    <Icon icon="mdi:map-search-outline" />
                  </template>
                  На карту
                </KitBtn>
              </div>
            </div>

            <!-- Пропорциональная полоска видов активности -->
            <div v-if="s.totalDistanceM > 0" class="activity-progress-bar">
              <div
                v-for="a in s.byActivity.filter(item => item.distanceM > 0)"
                :key="a.activity"
                class="progress-segment"
                :style="{
                  width: `${(a.distanceM / s.totalDistanceM) * 100}%`,
                  backgroundColor: ACTIVITY_COLORS[a.activity],
                }"
                :title="`${ACTIVITY_LABELS[a.activity]}: ${formatDistance(a.distanceM)}`"
              />
            </div>

            <!-- Разбивка по видам активности -->
            <ul class="activity-list">
              <li
                v-for="a in s.byActivity.filter(item => item.distanceM > 0 || item.durationMs > 60000)"
                :key="a.activity"
                class="activity-row"
              >
                <div class="activity-lead">
                  <Icon
                    :icon="ACTIVITY_ICONS[a.activity]"
                    class="activity-icon"
                    :style="{ color: ACTIVITY_COLORS[a.activity] }"
                  />
                  <span class="activity-name">{{ ACTIVITY_LABELS[a.activity] }}</span>
                </div>
                <span class="activity-distance">{{ formatDistance(a.distanceM) }}</span>
                <span class="activity-duration">{{ formatDuration(a.durationMs) }}</span>
              </li>
            </ul>
          </article>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped lang="scss">
.activity-page {
  max-width: 820px;
  margin: 0 auto;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: calc(100vh - 53px);
}

.activity-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  .header-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .activity-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--fg-color, #fff);

    .title-icon {
      color: var(--primary, #4caf50);
      font-size: 1.8rem;
    }
  }

  .activity-desc {
    font-size: 0.88rem;
    color: var(--fg-secondary-color, rgba(255, 255, 255, 0.65));
  }
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;

  .metric-card {
    background: var(--surface-color, #1e1e1e);
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-m, 12px);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 12px;

    .metric-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;

      &.distance {
        background: rgba(33, 150, 243, 0.15);
        color: #42a5f5;
      }

      &.duration {
        background: rgba(255, 152, 0, 0.15);
        color: #ffa726;
      }

      &.days {
        background: rgba(76, 175, 80, 0.15);
        color: #66bb6a;
      }
    }

    .metric-info {
      display: flex;
      flex-direction: column;

      .metric-value {
        font-size: 1.25rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--fg-color, #fff);
      }

      .metric-label {
        font-size: 0.78rem;
        color: var(--fg-secondary-color, rgba(255, 255, 255, 0.6));
      }
    }
  }
}

.activity-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.days-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 2px;

  .list-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--fg-color, #fff);
  }

  .list-counter {
    font-size: 0.8rem;
    color: var(--fg-secondary-color, rgba(255, 255, 255, 0.6));
  }
}

.days-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.day-card {
  background: var(--surface-color, #1e1e1e);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius-m, 14px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    transform 0.2s,
    box-shadow 0.2s;

  &:hover {
    border-color: var(--primary, #4caf50);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  }

  &.is-today {
    border-color: rgba(76, 175, 80, 0.5);
    background: linear-gradient(180deg, rgba(76, 175, 80, 0.04) 0%, var(--surface-color, #1e1e1e) 100%);
  }

  .day-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;

    .day-title-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .day-title {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--fg-color, #fff);
      text-transform: capitalize;
    }

    .live-recording-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 7px;
      border-radius: 12px;
      font-size: 0.7rem;
      font-weight: 600;
      background: rgba(76, 175, 80, 0.15);
      color: #81c784;

      .live-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #4caf50;
        animation: pulse 1.5s infinite;
      }
    }

    .day-range {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8rem;
      color: var(--fg-secondary-color, rgba(255, 255, 255, 0.6));
      font-variant-numeric: tabular-nums;

      .range-icon {
        font-size: 0.95rem;
      }
    }
  }

  .day-totals-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 12px;
    background: var(--bg-hover-color, rgba(255, 255, 255, 0.03));
    border-radius: 8px;

    .totals-stat {
      display: flex;
      flex-direction: column;

      .stat-value {
        font-size: 1.15rem;
        font-weight: 700;
        color: var(--fg-color, #fff);
        font-variant-numeric: tabular-nums;
      }

      .stat-label {
        font-size: 0.72rem;
        color: var(--fg-secondary-color, rgba(255, 255, 255, 0.6));
      }
    }

    .stat-divider {
      width: 1px;
      height: 28px;
      background: var(--border-color, rgba(255, 255, 255, 0.1));
    }

    .map-action {
      margin-left: auto;
    }
  }

  .activity-progress-bar {
    display: flex;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.08);

    .progress-segment {
      height: 100%;
      transition: width 0.3s;
    }
  }

  .activity-list {
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
    gap: 12px;
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
        color: var(--fg-color, #fff);
      }
    }

    .activity-distance,
    .activity-duration {
      font-variant-numeric: tabular-nums;
      color: var(--fg-secondary-color, rgba(255, 255, 255, 0.7));
    }

    .activity-duration {
      min-width: 5.5em;
      text-align: right;
    }
  }
}

.activity-state {
  text-align: center;
  padding: 48px 16px;
  color: var(--fg-secondary-color, rgba(255, 255, 255, 0.6));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;

  .state-icon {
    font-size: 2.2rem;
  }

  &.is-error {
    color: #ef5350;
  }

  &.empty-state {
    .empty-icon-wrap {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(76, 175, 80, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary, #4caf50);

      .empty-icon {
        font-size: 2rem;
      }
    }

    .empty-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--fg-color, #fff);
      margin: 0;
    }

    .empty-hint {
      max-width: 420px;
      font-size: 0.85rem;
      line-height: 1.4;
      margin: 0;
    }
  }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
  100% {
    opacity: 1;
  }
}
</style>
