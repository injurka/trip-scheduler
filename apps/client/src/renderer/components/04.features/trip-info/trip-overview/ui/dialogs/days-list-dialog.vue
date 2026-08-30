<script setup lang="ts">
import type { IDay } from '~/components/04.features/trip-info/trip-plan/models/types'
import { Icon } from '@iconify/vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'

interface Props {
  visible: boolean
  days: IDay[]
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'navigate', dayId: string): void
}>()

const calendarDays = computed(() =>
  props.days
    .filter(d => !!d.date)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()),
)

const draftDays = computed(() =>
  props.days.filter(d => !d.date),
)

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
    <div class="dialog-scroll-content">
      <ul class="days-list">
        <li v-for="(day, index) in calendarDays" :key="day.id" @click="handleNavigate(day.id)">
          <div class="day-number">
            {{ index + 1 }}
          </div>
          <div class="day-info">
            <span class="day-title">{{ day.title || `День ${index + 1}` }}</span>
            <span class="day-date">{{ new Date(day.date!).toLocaleDateString('ru-RU', { month: 'long', day: 'numeric', weekday: 'short' }) }}</span>
          </div>
        </li>
      </ul>

      <template v-if="draftDays.length > 0">
        <div class="drafts-separator">
          <span>Черновики и варианты маршрутов</span>
        </div>
        <ul class="days-list">
          <li v-for="(day, index) in draftDays" :key="day.id" class="draft-item" @click="handleNavigate(day.id)">
            <div class="day-number day-number--draft">
              <Icon icon="mdi:map-marker-path" />
            </div>
            <div class="day-info">
              <span class="day-title">{{ day.title || `Черновик ${index + 1}` }}</span>
              <span class="day-date">Без даты (Черновик)</span>
            </div>
          </li>
        </ul>
      </template>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.dialog-scroll-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.drafts-separator {
  padding: 0.5rem 0.75rem 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-top: 1px dashed var(--border-secondary-color);
}

.days-list {
  list-style: none;
  padding: 0;
  margin: 0;
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

  &--draft {
    color: var(--fg-secondary-color);
    border: 1px dashed var(--border-secondary-color);
    background-color: transparent;
  }
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
