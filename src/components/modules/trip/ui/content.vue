<script setup lang="ts">
import type { Activity } from '../models/activity'
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import draggable from 'vuedraggable'
import { useActivitiesStore } from '../store/trip.store'
import ActivityItem from './activity/activity-item.vue'
import AddActivityDialog from './activity/add-activity-dialog.vue'
import EditActivityDialog from './activity/edit-activity-dialog.vue'

const activitiesStore = useActivitiesStore()
const selectedDay = ref<number>(1)
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const currentActivity = ref<Activity | null>(null)
const draggingElement = ref<HTMLElement | null>(null)

const activitiesForDay = computed(() => activitiesStore.getActivitiesByDay(selectedDay.value))

const allDays = computed(() => {
  const days = activitiesStore.getAllDays

  if (days.length === 0 || days[days.length - 1] < 5) {
    const additionalDays = Array.from({ length: 5 }, (_, i) => i + 1)
    return [...new Set([...days, ...additionalDays])].sort((a, b) => a - b)
  }
  return days
})

const drag = computed({
  get: () => activitiesStore.getActivitiesByDay(selectedDay.value),
  set: (newValue: Activity[]) => {
    activitiesStore.reorderActivities(selectedDay.value, newValue)
  },
})

function selectDay(day: number) {
  selectedDay.value = day
}

function openEditForm(activity: Activity) {
  currentActivity.value = activity
  showEditDialog.value = true
}

function deleteActivity(activityId: string) {
  activitiesStore.removeActivity(activityId)
}

function onDragEnd() {
  if (draggingElement.value) {
    draggingElement.value.classList.remove('is-dragging')
    draggingElement.value = null
  }
}

function onDragStart(event: DragEvent) {
  draggingElement.value = event.target as HTMLElement
  draggingElement.value.classList.add('is-dragging')
}

function handleDragUpdate(_: { newIndex: number, oldIndex: number }) {
  activitiesStore.reorderActivities(selectedDay.value, drag.value)
}

function addNewActivity() {
  showAddDialog.value = true
}

function onActivityAdded() {
  showAddDialog.value = false
}

function onActivityEdited() {
  showEditDialog.value = false
  currentActivity.value = null
}
</script>

<template>
  <div class="trip-content">
    <div class="controls">
      <div class="days-selector">
        <Button
          v-for="day in allDays"
          :key="day"
          variant="outlined"
          size="small"
          :class="{ 'p-button-primary': selectedDay === day }"
          @click="selectDay(day)"
        >
          День {{ day }}
        </Button>
      </div>

      <div class="actions">
        <Button
          icon="pi pi-plus"
          label="Добавить активность"
          class="p-button-success"
          @click="addNewActivity"
        />
      </div>
    </div>

    <div class="day-activities">
      <div class="activities-container">
        <draggable
          v-model="drag"
          ghost-class="ghost-activity"
          chosen-class="chosen-activity"
          animation="300"
          item-key="id"
          handle=".drag-handle"
          @end="onDragEnd"
          @update="handleDragUpdate"
          @start="onDragStart"
        >
          <template #item="{ element }">
            <ActivityItem
              :activity="element"
              @edit="openEditForm"
              @delete="deleteActivity"
            />
          </template>
        </draggable>

        <div v-if="activitiesForDay.length === 0" class="empty-state">
          <p>На этот день нет запланированных активностей</p>
          <Button
            icon="pi pi-plus"
            label="Добавить активность"
            class="p-button-outlined"
            @click="addNewActivity"
          />
        </div>
      </div>
    </div>

    <AddActivityDialog
      v-model:visible="showAddDialog"
      :selected-day="selectedDay"
      @activity-added="onActivityAdded"
    />
    <EditActivityDialog
      v-model:visible="showEditDialog"
      :activity="currentActivity"
      @activity-edited="onActivityEdited"
    />
  </div>
</template>

<style scoped lang="scss">
.trip-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;

  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 0;
    border-bottom: 1px solid var(--border-secondary-color);

    .days-selector {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .actions {
      display: flex;
      gap: 8px;
    }
  }

  .day-activities {
    display: flex;
    gap: 24px;

    .activities-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
      position: relative;

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        background-color: var(--bg-secondary-color);
        border: 1px dashed var(--border-secondary-color);
        border-radius: 8px;

        p {
          margin-bottom: 20px;
          color: var(--fg-secondary-color);
        }
      }
    }
  }
}

.ghost-activity {
  opacity: 0.5;
  background: var(--bg-secondary-color);
  padding: 10px;
  border: 2px dashed var(--border-secondary-color);
  transition: opacity 0.3s ease;
  border-radius: 6px;
  pointer-events: none;
  * {
    opacity: 0.6;
    ::before {
      opacity: 0 !important;
    }
  }
}
@keyframes pulse {
  0% {
    opacity: 0.2;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.2;
  }
}
.chosen-activity {
  box-shadow: 0 8px 20px var(--border-primary-color);
  transform: translateY(-4px) scale(1.03);
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  z-index: 10;
  background-color: var(--bg-primary-color);
}
.is-dragging {
  opacity: 0.8;
  border: 2px solid var(--primary-color);
}
.drag-handle {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-color-secondary);
  padding: 8px;
}
.sortable-ghost {
  position: relative;
  opacity: 0;
  &::before {
    content: '';
    position: absolute;
    top: -8px;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--primary-color);
    border-radius: 2px;
    animation: pulse 1.5s infinite;
  }
}
</style>
