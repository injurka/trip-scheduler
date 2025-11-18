<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import { Icon } from '@iconify/vue'
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeader,
  CalendarHeading,
  CalendarNext,
  CalendarPrev,
  CalendarRoot,
} from 'reka-ui'

const locale = 'ru-RU'

const model = defineModel<CalendarDate | null>({ required: true })
</script>

<template>
  <CalendarRoot
    v-slot="{ weekDays, grid }"
    v-model="model!"
    class="calendar"
    fixed-weeks
    :locale="locale"
  >
    <CalendarHeader class="calendarHeader">
      <CalendarPrev class="calendarNavButton">
        <Icon
          icon="mdi:chevron-left"
          class="icon"
        />
      </CalendarPrev>
      <CalendarHeading class="calendarHeading" />
      <CalendarNext class="calendarNavButton">
        <Icon
          icon="mdi:chevron-right"
          class="icon"
        />
      </CalendarNext>
    </CalendarHeader>

    <div class="calendarWrapper">
      <CalendarGrid
        v-for="month in grid"
        :key="month.value.toString()"
        class="calendarGrid"
      >
        <CalendarGridHead>
          <CalendarGridRow class="calendarGridRow">
            <CalendarHeadCell
              v-for="day in weekDays"
              :key="day"
              class="calendarHeadCell"
            >
              {{ day }}
            </CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>
        <CalendarGridBody class="calendarGridWrapper">
          <CalendarGridRow
            v-for="(weekDates, index) in month.rows"
            :key="`weekDate-${index}`"
            class="calendarGridRow"
          >
            <CalendarCell
              v-for="weekDate in weekDates"
              :key="weekDate.toString()"
              :date="weekDate"
              class="calendarCell"
            >
              <CalendarCellTrigger
                v-if="weekDate.month === month.value.month"
                :day="weekDate"
                :month="month.value"
                class="calendarCellTrigger"
              />
              <div
                v-else
                class="calendarCellEmpty"
              />
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>
    </div>

    <slot name="footer" />
  </CalendarRoot>
</template>

<style lang="scss" scoped>
.icon {
  width: 1.5rem;
  height: 1.5rem;
}

.calendar {
  border: 1px solid var(--border-primary-color);
  background-color: var(--bg-secondary-color);
  box-shadow: var(--s-m);
  padding: 16px;
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
  border-radius: 0.375rem;
  transition:
    background-color 0.2s,
    color 0.2s,
    border-color 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
  }

  &:focus {
    box-shadow: 0 0 0 2px var(--border-accent-color);
  }

  &[data-disabled] {
    cursor: default;
    color: var(--fg-muted-color);
  }

  &[data-selected] {
    background-color: var(--bg-accent-color);
    color: var(--fg-accent-color);
    font-weight: 400;
  }

  &[data-today] {
    border-color: var(--border-accent-color);
  }
}
</style>
