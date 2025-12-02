<script setup lang="ts">
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { EActivityStatus, EActivityTag } from '~/shared/types/models/activity'
import DayNote from './day-note.vue'
import DayActivitiesList from './list.vue'

const { plan, ui } = useModuleStore(['plan', 'ui'])

const { getActivitiesForSelectedDay, getSelectedDay } = storeToRefs(plan)
const { isViewMode, areAllActivitiesCollapsed, isParallelPlanView } = storeToRefs(ui)

// --- View Modes ---
const viewMode = ref<'template' | 'canvas'>('template')

function setViewMode(mode: 'template' | 'canvas') {
  viewMode.value = mode
}

function toggleParallelView() {
  ui.toggleParallelPlanView()
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
    tag: EActivityTag.ATTRACTION,
    sections: [],
    status: EActivityStatus.NONE,
  }

  plan.addActivity(getSelectedDay.value.id, newActivity)
}

// --- Логика для сворачивания ---
const allActivityIds = computed(() => getActivitiesForSelectedDay.value.map((a: IActivity) => a.id))
const allRouteBlocksCollapsed = computed(() => areAllActivitiesCollapsed.value(allActivityIds.value))
const collapseRouteIcon = computed(() => allRouteBlocksCollapsed.value ? 'mdi:chevron-double-down' : 'mdi:chevron-double-up')
</script>

<template>
  <div class="plan-view">
    <div class="divider-with-action" :class="{ 'is-parallel-mode': isParallelPlanView }">
      <!-- Левая панель управления видами -->
      <div class="view-mode-controls">
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
        <div class="separator" />
        <KitBtn
          class="mode-parallel"
          variant="outlined"
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
        <span class="divider-label">маршрут</span>
      </KitDivider>

      <button
        v-if="isViewMode && getSelectedDay?.meta?.length"
        class="collapse-all-btn"
        title="Свернуть/развернуть все активности"
        @click="ui.toggleAllActivities(allActivityIds)"
      >
        <Icon :icon="collapseRouteIcon" />
      </button>
      <button
        v-if="isViewMode && allActivityIds.length > 0"
        class="collapse-all-btn"
        title="Свернуть/развернуть все активности"
        @click="ui.toggleAllActivities(allActivityIds)"
      >
        <Icon :icon="collapseRouteIcon" />
      </button>
    </div>

    <!-- Основной контент -->
    <div class="plan-content" :class="{ 'is-parallel': isParallelPlanView }">
      <!-- Шаблонный список (Plan) -->
      <div
        v-if="isParallelPlanView || viewMode === 'template'"
        class="plan-column"
      >
        <DayActivitiesList @add="handleAddNewActivity" />
      </div>

      <!-- Полотно (Canvas) -->
      <div
        v-if="isParallelPlanView || viewMode === 'canvas'"
        class="canvas-column"
      >
        <DayNote :day-id="getSelectedDay?.id || ''" />
      </div>
    </div>

    <slot name="footer" />
  </div>
</template>

<style scoped lang="scss">
.plan-view {
  position: relative;
  overflow: hidden;
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
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 2;
    background-color: var(--bg-primary-color);

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

    .separator {
      width: 1px;
      height: 20px;
      background-color: var(--border-secondary-color);
    }

    .kit-btn.active {
      background-color: var(--bg-accent-color);
      color: var(--fg-on-accent-color);
      border-color: var(--fg-accent-color);
    }
  }

  .collapse-all-btn {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
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

  .divider-label {
    background-color: var(--bg-primary-color);
    padding: 0 12px;
    border-radius: 4px;
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
      min-width: 920px;
      width: 100%;
    }
  }
}

.add-ideas-wrapper {
  margin-bottom: 32px;
  display: flex;
  justify-content: center;
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
      gap: 0;

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
