<script setup lang="ts">
import type { CalendarDateTime } from '@internationalized/date'
import { Icon } from '@iconify/vue'
import { parseDate, parseDateTime } from '@internationalized/date'
import { DateFieldInput, DateFieldRoot, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref, useId } from 'vue'
import { KitCalendar } from '~/components/01.kit/kit-calendar'

interface Props { label: string, disabled?: boolean }
defineProps<Props>()
const model = defineModel<string | number | null>({ required: true })
const id = useId()
const open = ref(false)
const value = computed<CalendarDateTime | undefined>({
  get() {
    const match = String(model.value).match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/)

    if (!match)
      return undefined

    try {
      return parseDateTime(`${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:${match[6]}`)
    }
    catch { return undefined }
  },
  set(date) {
    if (!date) {
      model.value = null

      return
    }

    const pad = (n: number) => String(n).padStart(2, '0')
    model.value = `${pad(date.day)}.${pad(date.month)}.${date.year} ${pad(date.hour)}:${pad(date.minute)}:${pad(date.second)}`
  },
})
const day = computed({
  get: () => value.value ? parseDate(value.value.toString().slice(0, 10)) : null,
  set(date) {
    if (date && value.value) {
      value.value = value.value.set({ year: date.year, month: date.month, day: date.day })
      open.value = false
    }
  },
})
</script>

<template>
  <div class="track-date-field">
    <label :id="id">{{ label }}</label>
    <div class="date-control">
      <PopoverRoot v-model:open="open">
        <PopoverTrigger :disabled="disabled" :aria-label="`Выбрать дату: ${label}`" class="calendar-trigger">
          <Icon icon="mdi:calendar-outline" />
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent class="track-calendar-popup" :side-offset="6" align="start">
            <KitCalendar v-model="day" />
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>
      <DateFieldRoot
        v-slot="{ segments }"
        v-model="value"
        locale="ru-RU"
        :hour-cycle="24"
        granularity="second"
        :disabled="disabled"
        :aria-labelledby="id"
        class="date-segments"
      >
        <DateFieldInput v-for="segment in segments" :key="segment.part" :part="segment.part">
          {{ segment.value }}
        </DateFieldInput>
      </DateFieldRoot>
    </div>
  </div>
</template>

<style scoped lang="scss">
.track-date-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.track-date-field label {
  font-size: 0.85rem;
  font-weight: 600;
}
.date-control {
  display: flex;
  align-items: center;
  min-height: 44px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  background: var(--bg-secondary-color);
}
.calendar-trigger {
  width: 40px;
  height: 44px;
  flex-shrink: 0;
  padding: 0;
  background: transparent;
  border: 0;
  color: var(--fg-secondary-color);
  font-size: 20px;
  cursor: pointer;
}
.date-segments {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
  gap: 1px;
  font-size: 16px;
  padding: 6px 4px;
}
.date-segments :deep([role='spinbutton']:focus) {
  outline: 2px solid var(--fg-accent-color);
  border-radius: 3px;
}
</style>

<style lang="scss">
.track-calendar-popup {
  z-index: 2000;
  max-width: calc(100vw - 24px);
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  box-shadow: var(--s-l);
}
</style>
