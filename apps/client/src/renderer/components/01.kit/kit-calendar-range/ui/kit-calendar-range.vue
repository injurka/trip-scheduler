<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import { Icon } from '@iconify/vue'
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

interface DateRange {
  start: CalendarDate | null
  end: CalendarDate | null
}

interface Props {
  minValue?: CalendarDate
  maxValue?: CalendarDate
  initialFocusDate?: CalendarDate
}
const props = defineProps<Props>()

const locale = 'ru-RU'
const model = defineModel<DateRange | null>({ required: true })
</script>

<template>
  <RangeCalendarRoot
    v-slot="{ weekDays, grid }"
    v-model="model as any"
    class="calendar"
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
  z-index: 2000;
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
  width: 2.5rem;
  height: 2.5rem;
  color: var(--fg-primary-color);
  background-color: transparent;
  cursor: pointer;
  border-radius: 0.375rem;
  transition:
    background-color 0.2s,
    color 0.2s;

  &:hover {
    background-color: var(--bg-action-hover-color);
    color: var(--bg-primary-color);
  }

  &[data-disabled] {
    color: var(--fg-muted-color);
    pointer-events: none;
  }
}

.calendarHeading {
  font-weight: 400;
  color: var(--fg-primary-color);
}

.calendarWrapper {
  display: flex;
  padding-top: 1rem;
  flex-direction: column;

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

  & + & {
    margin-top: 0.25rem;
  }
}

.calendarHeadCell {
  font-size: 1rem;
  color: var(--fg-secondary-color);
  font-weight: 400;
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
  padding: 0.5rem 0;
  border: 1px solid transparent;
  outline: none;
  font-size: 1rem;
  font-weight: 400;
  color: var(--fg-primary-color);
  background-color: transparent;
  transition:
    background-color 0.2s,
    color 0.2s,
    border-color 0.2s;
  border-radius: 0;

  &:hover {
    background-color: var(--bg-hover-color);
    border-radius: 0.375rem;
  }

  &:focus {
    box-shadow: 0 0 0 2px var(--border-accent-color);
    border-radius: 0.375rem;
  }

  &[data-disabled] {
    cursor: default;
    color: var(--fg-muted-color);
  }

  &[data-unavailable] {
    cursor: default;
    color: var(--fg-muted-color);
    text-decoration: line-through;
  }

  &[data-today] {
    border-color: var(--border-accent-color);
    border-radius: 0.375rem;
  }

  &[data-selection-start],
  &[data-selection-end] {
    background-color: var(--bg-accent-color);
    color: var(--fg-accent-color);
    font-weight: 400;
  }

  &[data-selection-start] {
    border-top-left-radius: 0.375rem;
    border-bottom-left-radius: 0.375rem;
  }

  &[data-selection-end] {
    border-top-right-radius: 0.375rem;
    border-bottom-right-radius: 0.375rem;
  }

  &[data-within-range] {
    background-color: var(--bg-hover-color);
  }

  &[data-selection-start][data-selection-end] {
    border-radius: 0.375rem;
  }
}
</style>
