<script setup lang="ts">
import type { IDay } from '~/components/04.features/trip-info/trip-plan/models/types'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'

interface Props {
  visible: boolean
  days: IDay[]
}
defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'navigate', dayId: string): void
}>()

function handleNavigate(dayId: string) {
  emit('navigate', dayId)
  emit('update:visible', false)
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Дни путешествия"
    icon="mdi:calendar-range"
    :max-width="800"
    @update:visible="emit('update:visible', $event)"
  >
    <ul class="days-list">
      <li v-for="(day, index) in days" :key="day.id" @click="handleNavigate(day.id)">
        <div class="day-number">
          {{ index + 1 }}
        </div>
        <div class="day-info">
          <span class="day-title">{{ day.title || `День ${index + 1}` }}</span>
          <span class="day-date">{{ new Date(day.date).toLocaleDateString('ru-RU', { month: 'long', day: 'numeric', weekday: 'short' }) }}</span>
        </div>
      </li>
    </ul>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.days-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  li {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    border-radius: var(--r-m);
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: var(--bg-hover-color);
    }
  }
}
.day-number {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: var(--r-s);
  background-color: var(--bg-tertiary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}
.day-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.day-title {
  font-weight: 500;
}
.day-date {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
}
</style>
