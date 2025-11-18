<script setup lang="ts">
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import draggable from 'vuedraggable'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import AddDayActivity from '~/components/05.modules/trip-info/ui/controls/add-day-activity.vue'
import ActivityItem from './item.vue'

const emit = defineEmits<{
  (e: 'add'): void
}>()

const { plan: data, ui } = useModuleStore(['plan', 'ui'])

const { getActivitiesForSelectedDay, getSelectedDay } = storeToRefs(data)
const { reorderActivities, updateActivity, removeActivity } = data
const { isViewMode } = storeToRefs(ui)
const { collapsedActivities } = storeToRefs(ui)

function onUpdateActivity(updatedActivity: IActivity) {
  updateActivity(getSelectedDay.value!.id, updatedActivity)
}

function onDeleteActivity(activityId: string) {
  removeActivity(getSelectedDay.value!.id, activityId)
}

function onMoveActivity(activity: IActivity, direction: 'up' | 'down') {
  const activities = [...getActivitiesForSelectedDay.value]
  const currentIndex = activities.findIndex(a => a.id === activity.id)

  if (direction === 'up' && currentIndex > 0) {
    [activities[currentIndex], activities[currentIndex - 1]] = [activities[currentIndex - 1], activities[currentIndex]]
    reorderActivities(activities)
  }
  else if (direction === 'down' && currentIndex < activities.length - 1) {
    [activities[currentIndex], activities[currentIndex + 1]] = [activities[currentIndex + 1], activities[currentIndex]]
    reorderActivities(activities)
  }
}

const draggableActivities = computed({
  get: () => getActivitiesForSelectedDay.value,
  set: (newOrder: IActivity[]) => {
    reorderActivities(newOrder)
  },
})
</script>

<template>
  <div class="day-activities">
    <div class="activities-container">
      <draggable
        v-model="draggableActivities"
        ghost-class="ghost-activity"
        chosen-class="chosen-activity"
        animation="300"
        item-key="id"
        handle=".drag-handle"
        :disabled="isViewMode"
        class="draggable-area"
      >
        <template #item="{ element: activity, index }">
          <ActivityItem
            :activity="activity"
            :is-first="index === 0"
            :is-last="index === draggableActivities.length - 1"
            :is-collapsed="collapsedActivities.has(activity.id)"
            @update="onUpdateActivity"
            @delete="onDeleteActivity"
            @move-up="onMoveActivity(activity, 'up')"
            @move-down="onMoveActivity(activity, 'down')"
            @toggle-collapse="ui.toggleActivityCollapsed(activity.id)"
          />
        </template>
      </draggable>

      <div v-if="getActivitiesForSelectedDay.length === 0" class="empty-state">
        <p>На этот день нет запланированных активностей</p>
      </div>

      <AddDayActivity
        v-if="!isViewMode "
        @add="emit('add')"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.day-activities {
  margin-bottom: 32px;

  .activities-container {
    width: 100%;
    position: relative;
    min-height: 100px;

    .draggable-area {
      min-height: 1px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      border: 2px dashed var(--border-secondary-color);
      border-radius: var(--r-s);
      margin-top: 20px;

      p {
        text-align: center;
        font-size: 0.9rem;
        color: var(--fg-secondary-color);
      }
    }
  }
}

.ghost-activity {
  opacity: 0.5;
  background: var(--bg-secondary-color);
  border-radius: var(--r-xs);
  > div {
    visibility: hidden;
  }
}

.chosen-activity {
  box-shadow: var(--s-l);
  transform: scale(1.02);
  z-index: 10;
}
</style>
