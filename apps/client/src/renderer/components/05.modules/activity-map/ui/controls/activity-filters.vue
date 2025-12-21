<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import type { DateRange } from '../../models/types'
import { getLocalTimeZone } from '@internationalized/date'
import { onClickOutside, useDateFormat } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCalendarRange } from '~/components/01.kit/kit-calendar-range'

interface IProps {
  transparent?: boolean
}

defineProps<IProps>()

const dateRange = defineModel<DateRange>('dateRange', { required: true })

const isDateFilterOpen = ref(false)
const filterWrapperRef = ref<HTMLElement | null>(null)

const formattedDateRange = computed(() => {
  const { start, end } = dateRange.value
  if (!start || !end)
    return 'Даты: Все'

  const formatDate = (d: CalendarDate) => useDateFormat(d.toDate(getLocalTimeZone()), 'D MMM', { locales: 'ru-RU' }).value

  return `${formatDate(start)} - ${formatDate(end)}`
})

function resetDateFilter() {
  dateRange.value = { start: null, end: null }
  isDateFilterOpen.value = false
}

onClickOutside(filterWrapperRef, () => {
  isDateFilterOpen.value = false
})
</script>

<template>
  <div ref="filterWrapperRef" class="activity-filters">
    <div class="main-trigger">
      <KitBtn
        :variant="transparent ? 'solid' : 'outlined'"
        :color="transparent ? 'secondary' : 'secondary'"
        icon="mdi:calendar-range"
        :class="{ 'active': isDateFilterOpen || (dateRange.start && dateRange.end), 'is-glass': transparent }"
        @click="isDateFilterOpen = !isDateFilterOpen"
      >
        {{ formattedDateRange }}
      </KitBtn>
    </div>

    <Transition name="fade">
      <div v-if="isDateFilterOpen" class="filter-popover">
        <KitCalendarRange v-model="dateRange" />
        <div class="popover-footer">
          <KitBtn variant="text" size="sm" @click="resetDateFilter">
            Сбросить
          </KitBtn>
          <KitBtn size="sm" @click="isDateFilterOpen = false">
            Готово
          </KitBtn>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.activity-filters {
  position: relative;
  z-index: 20;
}

.is-glass {
  background-color: rgba(var(--bg-secondary-color-rgb), 0.85) !important;
  backdrop-filter: blur(8px);
  border-color: rgba(var(--border-secondary-color-rgb), 0.5);
  box-shadow: var(--s-s);

  &:hover {
    background-color: rgba(var(--bg-secondary-color-rgb), 0.95) !important;
  }
}

.filter-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 8px;
  box-shadow: var(--s-l);
  z-index: 100;
  min-width: 300px;
}

.popover-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-secondary-color);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
