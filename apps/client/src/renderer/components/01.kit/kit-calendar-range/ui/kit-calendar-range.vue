<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import type { DateRange as CalendarRange } from 'reka-ui'
import { Icon } from '@iconify/vue'
import { toCalendarDate } from '@internationalized/date'
import {
  RangeCalendarCell,
  RangeCalendarCellTrigger,
  RangeCalendarGrid,
  RangeCalendarGridBody,
  RangeCalendarGridHead,
  RangeCalendarGridRow,
  RangeCalendarHeadCell,
  RangeCalendarHeader,
  RangeCalendarHeading,
  RangeCalendarNext,
  RangeCalendarPrev,
  RangeCalendarRoot,
} from 'reka-ui'

export interface DateRange {
  start: DateValue | null
  end: DateValue | null
}
interface Props {
  minValue?: DateValue
  maxValue?: DateValue
  initialFocusDate?: DateValue
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  fullWidth: false,
})
const model = defineModel<DateRange | null>({ required: true })

const locale = 'ru-RU'

const calendarModel = computed<CalendarRange | null>({
  get: () => model.value ? { start: model.value.start ?? undefined, end: model.value.end ?? undefined } : null,
  set: (value) => { model.value = value ? { start: value.start ? toCalendarDate(value.start) : null, end: value.end ? toCalendarDate(value.end) : null } : null },
})
</script>

<template>
  <RangeCalendarRoot
    v-slot="{ weekDays, grid }"
    v-model="calendarModel"
    class="calendar"
    :class="{ 'is-full-width': props.fullWidth }"
    fixed-weeks
    :locale="locale"
    :min-value="props.minValue"
    :max-value="props.maxValue"
    :placeholder="props.initialFocusDate"
  >
    <RangeCalendarHeader class="calendarHeader">
      <RangeCalendarPrev class="calendarNavButton">
        <Icon
          icon="mdi:chevron-left"
          class="icon"
        />
      </RangeCalendarPrev>
      <RangeCalendarHeading class="calendarHeading" />
      <RangeCalendarNext class="calendarNavButton">
        <Icon
          icon="mdi:chevron-right"
          class="icon"
        />
      </RangeCalendarNext>
    </RangeCalendarHeader>

    <div class="calendarWrapper">
      <RangeCalendarGrid
        v-for="month in grid"
        :key="month.value.toString()"
        class="calendarGrid"
      >
        <RangeCalendarGridHead>
          <RangeCalendarGridRow class="calendarGridRow">
            <RangeCalendarHeadCell
              v-for="day in weekDays"
              :key="day"
              class="calendarHeadCell"
            >
              {{ day }}
            </RangeCalendarHeadCell>
          </RangeCalendarGridRow>
        </RangeCalendarGridHead>
        <RangeCalendarGridBody class="calendarGridWrapper">
          <RangeCalendarGridRow
            v-for="(weekDates, index) in month.rows"
            :key="`weekDate-${index}`"
            class="calendarGridRow"
          >
            <RangeCalendarCell
              v-for="weekDate in weekDates"
              :key="weekDate.toString()"
              :date="weekDate"
              class="calendarCell"
            >
              <RangeCalendarCellTrigger
                v-if="weekDate.month === month.value.month"
                :day="weekDate"
                :month="month.value"
                class="calendarCellTrigger"
              />
              <div
                v-else
                class="calendarCellEmpty"
              />
            </RangeCalendarCell>
          </RangeCalendarGridRow>
        </RangeCalendarGridBody>
      </RangeCalendarGrid>
    </div>
    <slot name="footer" />
  </RangeCalendarRoot>
</template>

<style lang="scss" scoped>
.calendar {
  border-radius: 8px;
  width: 300px;
  max-width: 100%;
  z-index: 2000;

  &.is-full-width {
    width: 100%;
    max-width: 100%;
  }
}

.calendarHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.calendarNavButton {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 2.25rem;
  height: 2.25rem;
  color: var(--fg-primary-color);
  background-color: transparent;
  cursor: pointer;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  transition:
    background-color 0.2s,
    color 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
  }

  &[data-disabled] {
    color: var(--fg-muted-color);
    opacity: 0.4;
    pointer-events: none;
  }
}

.calendarHeading {
  font-weight: 600;
  font-size: 1rem;
  color: var(--fg-primary-color);
  text-transform: capitalize;
}

.calendarWrapper {
  display: flex;
  padding-top: 0.75rem;
  flex-direction: column;
  width: 100%;

  @include media-up(sm) {
    flex-direction: row;
  }
}

.calendarGrid {
  width: 100%;
  user-select: none;
  border-collapse: collapse;

  & + & {
    @include media-up(sm) {
      margin-left: 1rem;
    }
    @include media-down(sm) {
      margin-top: 1.5rem;
    }
  }
}

.calendarGridRow {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  width: 100%;
  gap: 2px;

  & + & {
    margin-top: 0.25rem;
  }
}

.calendarHeadCell {
  font-size: 0.875rem;
  color: var(--fg-secondary-color);
  font-weight: 500;
  text-align: center;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-secondary-color);
}

.calendarCell {
  position: relative;
  text-align: center;
}

.calendarCellEmpty {
  display: flex;
  position: relative;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.calendarCellTrigger {
  display: flex;
  position: relative;
  justify-content: center;
  align-items: center;
  width: 100%;
  min-height: 40px;
  padding: 0.35rem 0;
  border: 1.5px solid transparent;
  outline: none;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--fg-primary-color);
  background-color: transparent;
  border-radius: var(--r-xs);
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background-color: var(--bg-hover-color);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--fg-accent-color);
  }

  &[data-disabled] {
    cursor: default;
    color: var(--fg-muted-color);
    opacity: 0.35;
  }

  &[data-unavailable] {
    cursor: default;
    color: var(--fg-muted-color);
    text-decoration: line-through;
    opacity: 0.35;
  }

  &[data-today] {
    border-color: var(--border-secondary-color);
  }

  &[data-within-range] {
    background-color: color-mix(in srgb, var(--fg-accent-color) 16%, var(--bg-secondary-color));
    color: var(--fg-primary-color);
    border-radius: 0;
  }

  &[data-selection-start],
  &[data-selection-end] {
    border-color: var(--fg-accent-color);
    background-color: color-mix(in srgb, var(--fg-accent-color) 24%, var(--bg-secondary-color));
    color: var(--fg-primary-color);
    font-weight: 600;
  }

  &[data-selection-start] {
    border-top-left-radius: var(--r-s);
    border-bottom-left-radius: var(--r-s);
  }

  &[data-selection-end] {
    border-top-right-radius: var(--r-s);
    border-bottom-right-radius: var(--r-s);
  }

  &[data-selection-start][data-selection-end] {
    border-radius: var(--r-s);
  }
}
</style>
