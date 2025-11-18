<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import type { CreateTripInput } from '~/shared/types/models/trip'
import { parseDate } from '@internationalized/date'
import { KitInput } from '~/components/01.kit/kit-input'
import { CalendarPopover } from '~/components/02.shared/calendar-popover'

const tripData = defineModel<CreateTripInput>({ required: true })

const toYyyyMmDd = (date: string | Date) => new Date(date).toISOString().split('T')[0]

const startDate = computed({
  get: () => parseDate(toYyyyMmDd(tripData.value.startDate!)),
  set: (date: CalendarDate | null) => {
    if (date) {
      tripData.value.startDate = date.toDate('UTC').toISOString()
    }
  },
})
</script>

<template>
  <div class="step-basic-info">
    <KitInput
      v-model="tripData.title"
      label="Название путешествия"
      placeholder="Например, Поездка в Альпы"
    />
    <KitInput
      v-model="tripData.description"
      label="Краткое описание (необязательно)"
      placeholder="Цель поездки, основные идеи"
    />
    <div class="date-pickers">
      <div class="date-picker">
        <label>Дата начала</label>
        <CalendarPopover v-model="startDate">
          <template #trigger>
            <button class="date-trigger">
              {{ startDate?.toString() }}
            </button>
          </template>
        </CalendarPopover>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.step-basic-info {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.date-pickers {
  display: flex;
  gap: 16px;
}
.date-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}
.date-trigger {
  width: 100%;
  padding: 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  color: var(--fg-primary-color);
  font-size: 1rem;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--border-focus-color);
  }
}
</style>
