<script setup lang="ts">
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useActivitiesStore } from '../store/trip.store.ts'

import ActivityItem from './activity/activity-item.vue'

const activitiesStore = useActivitiesStore()
const selectedDay = ref<number>(1)

const activitiesForDay = computed(() => activitiesStore.getActivitiesByDay(selectedDay.value))

const allDays = computed(() => {
  const days = activitiesStore.getAllDays

  if (days.length === 0 || days[days.length - 1] < 5) {
    const additionalDays = Array.from({ length: 5 }, (_, i) => i + 1)
    return [...new Set([...days, ...additionalDays])].sort((a, b) => a - b)
  }
  return days
})

function selectDay(day: number) {
  selectedDay.value = day
}

function openEditForm() {}
function deleteActivity() {}
</script>

<template>
  <div class="trip-content">
    <div class="controls">
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

    <div class="day-activities">
      <div class="activities-container">
        <ActivityItem
          v-for="activity in activitiesForDay"
          :key="activity.id"
          :activity="activity"
          @edit="openEditForm"
          @delete="deleteActivity"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.trip-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.controls {
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid var(--surface-border);
}

.day-activities {
  display: flex;

  .activities-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
}
</style>
