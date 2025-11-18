<script setup lang="ts">
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import { Icon } from '@iconify/vue'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { EActivityTag } from '~/components/05.modules/trip-info/models/types'
import DayMetaBadges from '~/components/05.modules/trip-info/ui/day-meta-badges.vue'
import { EActivityStatus } from '~/shared/types/models/activity'
import DayActivitiesList from './list.vue'
import PossibleActivities from './possible-activities.vue'

const { plan: store, ui } = useModuleStore(['plan', 'ui'])

const { getActivitiesForSelectedDay, getSelectedDay } = storeToRefs(store)
const { isViewMode, areAllActivitiesCollapsed } = storeToRefs(ui)

function handleAddNewActivity() {
  if (!getSelectedDay.value)
    return

  const lastActivity = getActivitiesForSelectedDay.value.at(-1)
  const startTimeMinutes = lastActivity ? timeToMinutes(lastActivity.endTime) + 15 : 9 * 60 // 9:00
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

  store.addActivity(getSelectedDay.value.id, newActivity)
}

// --- Логика для сворачивания ---
const allActivityIds = computed(() => getActivitiesForSelectedDay.value.map((a: IActivity) => a.id))
const allRouteBlocksCollapsed = computed(() => areAllActivitiesCollapsed.value(allActivityIds.value))
const collapseRouteIcon = computed(() =>
  allRouteBlocksCollapsed.value ? 'mdi:chevron-double-down' : 'mdi:chevron-double-up',
)
function handleToggleAllActivities() {
  ui.toggleAllActivities(allActivityIds.value)
}
</script>

<template>
  <div class="plan-view">
    <div class="divider-with-action">
      <KitDivider :is-loading="store.isLoadingUpdateActivity">
        маршрут
      </KitDivider>
      <button
        v-if="isViewMode && getSelectedDay?.meta?.length"
        class="collapse-all-btn"
        title="Свернуть/развернуть все активности"
        @click="handleToggleAllActivities"
      >
        <Icon :icon="collapseRouteIcon" />
      </button>
      <button
        v-if="isViewMode && allActivityIds.length > 0"
        class="collapse-all-btn"
        title="Свернуть/развернуть все активности"
        @click="handleToggleAllActivities"
      >
        <Icon :icon="collapseRouteIcon" />
      </button>
    </div>
    <DayActivitiesList @add="handleAddNewActivity" />

    <!-- TODO позже -->
    <!-- <div v-if="!isViewMode" class="add-ideas-wrapper">
      <button class="add-from-ideas-btn" @click="ui.openPossibleActivitiesDrawer">
        <Icon icon="mdi:lightbulb-on-outline" />
        <span>Добавить из идей</span>
      </button>
    </div> -->

    <PossibleActivities />

    <KitDivider v-if="getSelectedDay?.meta?.length || !isViewMode">
      мета-информация
    </KitDivider>

    <DayMetaBadges
      v-if="getSelectedDay && (getSelectedDay.meta?.length || !isViewMode)"
      :meta="getSelectedDay.meta || []"
      :readonly="isViewMode"
      @update:meta="newMeta => store.updateDayDetails(getSelectedDay!.id, { meta: newMeta })"
    />
  </div>
</template>

<style scoped lang="scss">
.plan-view {
  position: relative;
}

.divider-with-action {
  position: relative;
  display: flex;
  align-items: center;

  .kit-divider {
    flex-grow: 1;
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
    z-index: 1;

    &:hover {
      color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
      background-color: var(--bg-hover-color);
    }
  }
}

.add-ideas-wrapper {
  margin-bottom: 32px;
  display: flex;
  justify-content: center;
}

.add-from-ideas-btn {
  width: 100%;
  padding: 10px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  border-radius: var(--r-s);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 0.9rem;
  font-weight: 500;

  &:hover {
    border-color: var(--border-accent-color);
    color: var(--fg-accent-color);
  }
}
</style>
