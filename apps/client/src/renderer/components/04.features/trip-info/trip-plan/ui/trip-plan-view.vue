<script setup lang="ts">
import type { ActivitySectionGeolocation } from '~/components/03.domain/trip-info/geolocation-section/models/types'
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import type { ActivitySectionMetro } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { onKeyStroke } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { useDialogHistory } from '~/components/01.kit/kit-dialog-with-close'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useCurrentTime } from '~/shared/composables/use-current-time'
import { useFullscreenBackground } from '~/shared/composables/use-fullscreen-background'
import { minutesToTime, timeToMinutes } from '~/shared/lib/date-time'
import { lazyComponent } from '~/shared/lib/lazy-component'
import { openExternalUrl } from '~/shared/lib/opener'
import { EActivitySectionType, EActivityStatus, EActivityTag } from '~/shared/types/models/activity'
import DayActivitiesList from './list.vue'

interface ActivityLocationSummary {
  label: string
  coordsText?: string
  mapsUrl: string
}

const { plan, ui } = useModuleStore(['plan', 'ui'])
const now = useCurrentTime()

const DayNote = lazyComponent(() => import('./day-note.vue'))
const { getActivitiesForSelectedDay, getSelectedDay, lastDeletedActivity } = storeToRefs(plan)
const { isViewMode, areAllActivitiesCollapsed, isParallelPlanView } = storeToRefs(ui)
const viewMode = ref<'template' | 'canvas'>('template')
const isFullScreen = ref(false)
const hasRenderedCanvas = ref(false)
const isWhatsNextPinnedOpen = ref(false)
const isWhatsNextDismissed = ref(false)

const hasRenderedPlan = computed(() => isParallelPlanView.value || viewMode.value === 'template')
const allActivityIds = computed(() => getActivitiesForSelectedDay.value.map((a: IActivity) => a.id))
const allRouteBlocksCollapsed = computed(() => areAllActivitiesCollapsed.value(allActivityIds.value))
const collapseRouteIcon = computed(() => allRouteBlocksCollapsed.value ? 'mdi:chevron-double-down' : 'mdi:chevron-double-up')
const isSelectedDayToday = computed(() => {
  const dayDate = getSelectedDay.value?.date?.slice(0, 10)

  if (!dayDate)
    return false

  const d = now.value
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  return dayDate === todayStr
})
const currentMinutes = computed(() => now.value.getHours() * 60 + now.value.getMinutes())
const currentActivity = computed<IActivity | null>(() => {
  if (!isSelectedDayToday.value)
    return null

  return getActivitiesForSelectedDay.value.find((act) => {
    if (act.status === EActivityStatus.SKIPPED || act.status === EActivityStatus.COMPLETED)
      return false

    const startMin = timeToMinutes(act.startTime)
    const rawEndMin = timeToMinutes(act.endTime)
    const endMin = rawEndMin >= startMin ? rawEndMin : rawEndMin + 24 * 60

    return startMin <= currentMinutes.value && currentMinutes.value < endMin
  }) ?? null
})
const nextActivity = computed<IActivity | null>(() => {
  const uncompleted = getActivitiesForSelectedDay.value.filter(act => act.status !== EActivityStatus.SKIPPED && act.status !== EActivityStatus.COMPLETED)

  if (isSelectedDayToday.value) {
    return uncompleted.find(act => timeToMinutes(act.startTime) > currentMinutes.value) ?? null
  }

  return uncompleted[0] ?? null
})
const showWhatsNextWidget = computed(() => {
  if (getActivitiesForSelectedDay.value.length === 0)
    return false

  if (isWhatsNextPinnedOpen.value)
    return !!(currentActivity.value || nextActivity.value)

  return isSelectedDayToday.value && !isWhatsNextDismissed.value && !!(currentActivity.value || nextActivity.value)
})

watch(() => getSelectedDay.value?.id, () => {
  isWhatsNextDismissed.value = false
})
watchEffect(() => {
  if (isParallelPlanView.value || viewMode.value === 'canvas') {
    hasRenderedCanvas.value = true
  }
})

function formatRelativeMinutes(diffMinutes: number): string {
  const abs = Math.max(0, Math.round(diffMinutes))

  if (abs < 60)
    return `${abs} мин`

  const hours = Math.floor(abs / 60)
  const mins = abs % 60

  return mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`
}
function getCurrentActivityRemainingText(activity: IActivity): string {
  const startMin = timeToMinutes(activity.startTime)
  const rawEndMin = timeToMinutes(activity.endTime)
  const endMin = rawEndMin >= startMin ? rawEndMin : rawEndMin + 24 * 60
  const remaining = Math.max(0, endMin - currentMinutes.value)

  return `ещё ${formatRelativeMinutes(remaining)}`
}
function getNextActivityWaitText(activity: IActivity): string | null {
  if (!isSelectedDayToday.value)
    return null

  const wait = timeToMinutes(activity.startTime) - currentMinutes.value

  if (wait <= 0)
    return null

  return `через ${formatRelativeMinutes(wait)}`
}
// eslint-disable-next-line complexity
function extractActivityLocation(activity: IActivity): ActivityLocationSummary | null {
  const sections = activity.sections || []

  for (const sec of sections) {
    if (sec.type === EActivitySectionType.GEOLOCATION) {
      const geo = sec as ActivitySectionGeolocation
      const point = geo.points?.[0] || geo.routes?.[0]?.points?.[0]

      if (point) {
        const [lon, lat] = point.coordinates || []
        const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lon)
        const coordsText = hasValidCoords ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : undefined
        const label = point.address || point.comment || geo.title || coordsText || 'Локация на карте'
        const mapsUrl = hasValidCoords
          ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`

        return { label, coordsText, mapsUrl }
      }
    }
    else if (sec.type === EActivitySectionType.METRO) {
      const metro = sec as ActivitySectionMetro
      const firstRide = metro.rides?.[0]

      if (firstRide?.startStation) {
        const label = `${firstRide.startStation} → ${firstRide.endStation}`

        return {
          label,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(firstRide.startStation)}`,
        }
      }
    }
  }

  return null
}
function scrollToActivity(activityId: string) {
  const el = document.getElementById(`activity-${activityId}`)

  if (!el)
    return

  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('highlight-pulse')
  setTimeout(() => {
    el.classList.remove('highlight-pulse')
  }, 1800)
}
function openActivityMapRoute(activity: IActivity) {
  const loc = extractActivityLocation(activity)
  const url = loc?.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.title)}`
  void openExternalUrl(url)
}
function toggleWhatsNextWidget() {
  if (showWhatsNextWidget.value) {
    isWhatsNextPinnedOpen.value = false
    isWhatsNextDismissed.value = true
  }
  else {
    isWhatsNextPinnedOpen.value = true
    isWhatsNextDismissed.value = false
  }
}
function setViewMode(mode: 'template' | 'canvas') {
  viewMode.value = mode

  if (isParallelPlanView.value) {
    ui.toggleParallelPlanView()
  }
}
function toggleParallelView() {
  ui.toggleParallelPlanView()

  if (!isParallelPlanView.value) {
    isFullScreen.value = false
  }
}
function toggleFullScreen() {
  isFullScreen.value = !isFullScreen.value
}
function handleAddNewActivity() {
  if (!getSelectedDay.value)
    return

  const lastActivity = getActivitiesForSelectedDay.value.at(-1)
  const startTimeMinutes = lastActivity ? timeToMinutes(lastActivity.endTime) : 9 * 60 // 9:00
  const endTimeMinutes = startTimeMinutes + 60

  const newActivity: Omit<IActivity, 'id'> = {
    dayId: getSelectedDay.value.id,
    title: 'Новая активность',
    startTime: minutesToTime(startTimeMinutes),
    endTime: minutesToTime(endTimeMinutes),
    tag: EActivityTag.ACTIVITY,
    sections: [],
    status: EActivityStatus.NONE,
  }

  plan.addActivity(getSelectedDay.value.id, newActivity)
}

useFullscreenBackground(isFullScreen)
useDialogHistory('trip-plan-fullscreen', isFullScreen)
onKeyStroke('Escape', (e) => {
  if (isFullScreen.value) {
    e.preventDefault()
    isFullScreen.value = false
  }
})
</script>

<template>
  <Teleport to="body" :disabled="!isFullScreen">
    <div class="plan-view" :class="{ 'is-full-screen': isFullScreen }">
      <div class="divider-with-action" :class="{ 'is-parallel-mode': isParallelPlanView }">
        <div v-if="!isFullScreen" class="view-mode-controls left">
          <div class="mode-group">
            <KitBtn
              icon="mdi:view-list-outline"
              variant="outlined"
              size="xs"
              color="secondary"
              :class="{ active: viewMode === 'template' && !isParallelPlanView }"
              title="Шаблонный вид"
              @click="setViewMode('template')"
            />
            <KitBtn
              icon="mdi:text-box-outline"
              variant="outlined"
              size="xs"
              color="secondary"
              :class="{ active: viewMode === 'canvas' && !isParallelPlanView }"
              title="Полотно (сплошной текст)"
              @click="setViewMode('canvas')"
            />
          </div>
          <KitBtn
            class="mode-parallel"
            variant="subtle"
            size="xs"
            color="secondary"
            :class="{ active: isParallelPlanView }"
            title="Параллельный просмотр"
            @click="toggleParallelView"
          >
            <Icon icon="mdi:view-column-outline" />
          </KitBtn>
        </div>

        <KitDivider :is-loading="plan.isLoadingUpdateActivity" class="route-divider">
          <div class="divider-content">
            <span class="divider-label">маршрут</span>
          </div>
        </KitDivider>

        <div class="view-mode-controls right">
          <KitTooltip v-if="allActivityIds.length > 0" text="Режим «Что дальше?»">
            <button
              class="whats-next-toggle-btn"
              type="button"
              :aria-pressed="showWhatsNextWidget"
              :class="{ active: showWhatsNextWidget }"
              @click="toggleWhatsNextWidget"
            >
              <Icon icon="mdi:compass-outline" />
            </button>
          </KitTooltip>

          <KitTooltip :text="isFullScreen ? 'Выйти из полноэкранного режима (Esc)' : 'На весь экран'">
            <button
              class="fullscreen-toggle-btn"
              type="button"
              :aria-label="isFullScreen ? 'Выйти из полноэкранного режима' : 'Открыть маршрут на весь экран'"
              :aria-pressed="isFullScreen"
              :class="{ active: isFullScreen }"
              @click="toggleFullScreen"
            >
              <Icon :icon="isFullScreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" />
            </button>
          </KitTooltip>

          <KitTooltip v-if="isViewMode && allActivityIds.length > 0 && !isFullScreen" text="Свернуть/развернуть все активности">
            <button
              class="collapse-all-btn"
              @click="ui.toggleAllActivities(allActivityIds)"
            >
              <Icon :icon="collapseRouteIcon" />
            </button>
          </KitTooltip>
        </div>
      </div>

      <div v-if="lastDeletedActivity" class="activity-undo-banner" data-testid="activity-undo-banner">
        <div class="activity-undo-info">
          <Icon icon="mdi:restore" />
          <span>Активность «{{ lastDeletedActivity.activity.title || 'Без названия' }}» удалена</span>
        </div>
        <div class="activity-undo-actions">
          <KitBtn
            size="xs"
            variant="tonal"
            icon="mdi:undo"
            @click="plan.undoLastActivityChange()"
          >
            Восстановить удалённую активность (Отменить)
          </KitBtn>
          <button
            type="button"
            class="activity-undo-dismiss"
            title="Скрыть"
            @click="plan.dismissLastDeletedActivity()"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>
      </div>

      <section v-if="showWhatsNextWidget" class="whats-next-widget" aria-label="Сейчас и далее">
        <header class="whats-next-header">
          <div class="whats-next-title">
            <Icon icon="mdi:compass-outline" />
            <span>Сейчас и далее («Что дальше?»)</span>
          </div>
          <button
            type="button"
            class="whats-next-close"
            title="Скрыть подсказку"
            @click="toggleWhatsNextWidget"
          >
            <Icon icon="mdi:close" />
          </button>
        </header>

        <div class="whats-next-cards">
          <div v-if="currentActivity" class="whats-next-card is-current">
            <div class="card-top">
              <span class="status-pill is-current">Сейчас</span>
              <span class="time-range">{{ currentActivity.startTime }} – {{ currentActivity.endTime }}</span>
              <span class="remaining-pill">{{ getCurrentActivityRemainingText(currentActivity) }}</span>
            </div>
            <div class="card-title">
              {{ currentActivity.title }}
            </div>
            <div v-if="extractActivityLocation(currentActivity)" class="card-location">
              <Icon icon="mdi:map-marker-outline" />
              <span>{{ extractActivityLocation(currentActivity)!.label }}</span>
              <span v-if="extractActivityLocation(currentActivity)!.coordsText" class="coords-text">
                ({{ extractActivityLocation(currentActivity)!.coordsText }})
              </span>
            </div>
            <div class="card-actions">
              <KitBtn
                size="xs"
                variant="outlined"
                icon="mdi:target"
                @click="scrollToActivity(currentActivity.id)"
              >
                К активности
              </KitBtn>
              <KitBtn
                size="xs"
                variant="tonal"
                icon="mdi:map-Search-outline"
                @click="openActivityMapRoute(currentActivity)"
              >
                Маршрут в картах
              </KitBtn>
            </div>
          </div>

          <div v-if="nextActivity" class="whats-next-card is-next">
            <div class="card-top">
              <span class="status-pill is-next">Далее</span>
              <span class="time-range">{{ nextActivity.startTime }} – {{ nextActivity.endTime }}</span>
              <span v-if="getNextActivityWaitText(nextActivity)" class="remaining-pill">
                {{ getNextActivityWaitText(nextActivity) }}
              </span>
            </div>
            <div class="card-title">
              {{ nextActivity.title }}
            </div>
            <div v-if="extractActivityLocation(nextActivity)" class="card-location">
              <Icon icon="mdi:map-marker-outline" />
              <span>{{ extractActivityLocation(nextActivity)!.label }}</span>
              <span v-if="extractActivityLocation(nextActivity)!.coordsText" class="coords-text">
                ({{ extractActivityLocation(nextActivity)!.coordsText }})
              </span>
            </div>
            <div class="card-actions">
              <KitBtn
                size="xs"
                variant="outlined"
                icon="mdi:target"
                @click="scrollToActivity(nextActivity.id)"
              >
                К активности
              </KitBtn>
              <KitBtn
                size="xs"
                variant="tonal"
                icon="mdi:directions"
                @click="openActivityMapRoute(nextActivity)"
              >
                Маршрут в картах
              </KitBtn>
            </div>
          </div>
        </div>
      </section>

      <div class="plan-content" :class="{ 'is-parallel': isParallelPlanView }">
        <div
          v-if="hasRenderedPlan"
          v-show="isParallelPlanView || viewMode === 'template'"
          class="plan-column"
        >
          <DayActivitiesList @add="handleAddNewActivity" />
        </div>

        <div
          v-if="hasRenderedCanvas && (!isFullScreen || isParallelPlanView || viewMode === 'canvas')"
          v-show="isParallelPlanView || viewMode === 'canvas'"
          class="canvas-column"
        >
          <DayNote :day-id="getSelectedDay?.id || ''" />
        </div>
      </div>

      <slot v-if="!isFullScreen" name="footer" />
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.plan-view {
  position: relative;
  transition: background-color 0.3s ease;

  &.is-full-screen {
    position: fixed;
    // Keyboard-Aware: полноэкранный редактор занимает только видимую область
    top: var(--visible-top, 0px);
    left: 0;
    width: 100vw;
    height: var(--visible-height, 100dvh);
    box-sizing: border-box;
    z-index: 995;
    background-color: var(--bg-primary-color);
    padding: calc(16px + var(--safe-area-inset-top, 0px)) calc(32px + var(--safe-area-inset-right, 0px))
      calc(16px + var(--safe-area-inset-bottom, 0px)) calc(32px + var(--safe-area-inset-left, 0px));
    display: flex;
    flex-direction: column;
    overflow: hidden;

    @include media-down(sm) {
      padding-right: calc(2px + var(--safe-area-inset-right, 0px));
      padding-left: calc(2px + var(--safe-area-inset-left, 0px));
    }

    .divider-with-action {
      flex-shrink: 0;
      margin-bottom: 0px;

      &::before {
        display: none;
      }
    }

    .plan-content {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      margin-bottom: 0;
      padding-bottom: 0;
      align-items: stretch;

      &::after {
        height: 100%;
        bottom: auto;
      }

      .plan-column,
      .canvas-column {
        height: 100%;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding-left: 8px;
        padding-bottom: 32px;

        &::-webkit-scrollbar {
          width: 6px;
        }
        &::-webkit-scrollbar-thumb {
          background-color: var(--border-secondary-color);
          border-radius: 4px;
        }
        &::-webkit-scrollbar-track {
          background: transparent;
        }
      }

      .canvas-column {
        position: static;
      }

      &.is-parallel {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
      }
    }
  }
}

.divider-with-action {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  min-height: 40px;

  .kit-divider {
    flex-grow: 1;
    margin-left: 120px;
  }

  .is-full-screen & .kit-divider {
    margin-left: 0;
  }

  &.is-parallel-mode::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100vw;
    height: 1px;
    background-color: var(--border-secondary-color);
    z-index: 0;
    pointer-events: none;
  }

  .view-mode-controls {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 2;

    .mode-group {
      display: flex;
      gap: 2px;
      background-color: var(--bg-secondary-color);
      padding: 2px;
      border-radius: var(--r-xs);
      border: 1px solid var(--border-secondary-color);

      .kit-btn {
        border: none;
        background: transparent;
        border-radius: var(--r-xs);

        &.active {
          background-color: var(--bg-tertiary-color);
          color: var(--fg-primary-color);
          transform: none;
        }
        &:hover:not(.active) {
          background-color: var(--bg-hover-color);
          transform: none;
        }
      }
    }

    .mode-parallel {
      background-color: var(--bg-secondary-color);
      padding: 6px;
    }

    .kit-btn.active {
      background-color: var(--bg-accent-color);
      color: var(--fg-on-accent-color);
      border-color: var(--fg-accent-color);
    }

    &.left {
      left: 0;
    }

    &.right {
      right: 0;
    }
  }

  .whats-next-toggle-btn,
  .fullscreen-toggle-btn {
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-s);
    color: var(--fg-secondary-color);
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 1.1rem;
    transition: all 0.2s ease;
    z-index: 2;

    &:hover {
      color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
      background-color: var(--bg-hover-color);
    }
    &.active {
      color: var(--fg-accent-color);
      background: var(--bg-tertiary-color);
    }
  }

  .collapse-all-btn {
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-s);
    color: var(--fg-secondary-color);
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 1.1rem;
    transition: all 0.2s ease;
    z-index: 2;

    &:hover {
      color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
      background-color: var(--bg-hover-color);
    }
  }
}

.route-divider {
  position: relative;
  z-index: 1;

  .divider-content {
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 4px;

    .divider-label {
      background: var(--bg-primary-color);
      padding: 0 12px;
    }
  }
}

.plan-content {
  display: block;

  &.is-parallel {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    align-items: start;
    position: relative;
    margin-bottom: 16px;

    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      bottom: 0;
      width: 1px;
      background-color: var(--border-secondary-color);
      transform: translateX(-50%);
    }

    .plan-column {
      width: 100%;
      min-width: 0;
    }

    .canvas-column {
      width: 100%;
      min-width: 0;
    }
  }
}

.add-ideas-wrapper {
  margin-bottom: 32px;
  display: flex;
  justify-content: center;
}

.activity-undo-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 14px;
  margin-bottom: 14px;
  border-radius: var(--r-s);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);

  .activity-undo-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--fg-primary-color);
  }

  .activity-undo-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .activity-undo-dismiss {
    background: transparent;
    border: none;
    color: var(--fg-tertiary-color);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: var(--r-2xs);

    &:hover {
      color: var(--fg-primary-color);
      background-color: var(--bg-hover-color);
    }
  }
}

.whats-next-widget {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  margin-bottom: 16px;
  border-radius: var(--r-m);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);

  .whats-next-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .whats-next-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.82rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--fg-accent-color);
  }

  .whats-next-close {
    background: transparent;
    border: none;
    color: var(--fg-tertiary-color);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    padding: 4px;
    border-radius: var(--r-2xs);

    &:hover {
      color: var(--fg-primary-color);
    }
  }

  .whats-next-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 10px;
  }

  .whats-next-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: var(--r-s);
    background-color: var(--bg-primary-color);
    border: 1px solid var(--border-secondary-color);

    &.is-current {
      border-color: rgba(var(--fg-success-color-rgb, 34, 197, 94), 0.45);
    }

    &.is-next {
      border-color: rgba(var(--fg-info-color-rgb, 59, 130, 246), 0.45);
    }

    .card-top {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      font-size: 0.78rem;
    }

    .status-pill {
      padding: 2px 7px;
      border-radius: var(--r-full);
      font-size: 0.7rem;
      font-weight: 700;

      &.is-current {
        color: var(--fg-success-color, #22c55e);
        background-color: rgba(var(--fg-success-color-rgb, 34, 197, 94), 0.14);
      }

      &.is-next {
        color: var(--fg-info-color, #3b82f6);
        background-color: rgba(var(--fg-info-color-rgb, 59, 130, 246), 0.14);
      }
    }

    .time-range {
      font-family: var(--font-mono);
      font-weight: 600;
      color: var(--fg-primary-color);
    }

    .remaining-pill {
      margin-left: auto;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--fg-secondary-color);
    }

    .card-title {
      font-size: 0.92rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }

    .card-location {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      font-size: 0.78rem;
      color: var(--fg-secondary-color);

      .coords-text {
        font-family: var(--font-mono);
        font-size: 0.72rem;
        color: var(--fg-tertiary-color);
      }
    }

    .card-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 2px;
    }
  }
}

@include media-down(xl) {
  .plan-content.is-parallel {
    grid-template-columns: 1fr;
    gap: 24px;

    &::after {
      display: none;
    }
  }

  .divider-with-action {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    justify-content: center;

    .view-mode-controls {
      top: auto;
      transform: none;
      left: auto;
      justify-content: center;

      &.left {
        gap: 0;
      }

      .separator {
        display: none;
      }

      .mode-parallel {
        display: none;
      }
    }

    .kit-divider {
      margin-left: 0;
    }
  }
}
</style>
