<script lang="ts" setup>
import type { CalendarDate, DateValue } from '@internationalized/date'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCalendar } from '~/components/01.kit/kit-calendar'
import { useCalendarPopover } from '../composables/use-calendar-popover'

interface Props {
  disabled?: boolean
  clearable?: boolean
  maxValue?: DateValue
  minValue?: DateValue
  isDateDisabled?: (date: DateValue) => boolean
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  clearable: true,
  side: 'bottom',
  align: 'start',
})

const model = defineModel<CalendarDate | null>({ required: true })
const { isOpen, handleDateSelect, closeCalendar } = useCalendarPopover()

function handleUpdateValue(value: CalendarDate | null) {
  handleDateSelect(value, (v) => {
    model.value = v
  })
}

function clearDate() {
  handleUpdateValue(null)
}
</script>

<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger
      as-child
      class="date-picker-trigger"
      :disabled="disabled"
    >
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :side="props.side"
        :align="props.align"
        class="date-picker-content"
        :avoid-collisions="true"
        :collision-padding="4"
      >
        <KitCalendar
          :model-value="model"
          :max-value="props.maxValue"
          :min-value="props.minValue"
          :is-date-disabled="props.isDateDisabled"
          @update:model-value="handleUpdateValue"
        >
          <template #footer>
            <div v-if="props.clearable || $slots.footer" class="calendar-footer">
              <slot name="footer" :close="closeCalendar" />
              <KitBtn v-if="props.clearable" variant="text" size="sm" @click="clearDate">
                Очистить дату
              </KitBtn>
            </div>
          </template>
        </KitCalendar>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style scoped lang="scss">
:deep(.date-picker-content) {
  border-radius: var(--r-s);
  animation-duration: 0.6s;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  margin-top: 8px;
  z-index: 2002;

  &[data-side='top'] {
    animation-name: slideUp;
  }
  &[data-side='bottom'] {
    animation-name: slideDown;
  }
}
.date-picker-trigger {
  cursor: pointer;
}

.calendar-footer {
  padding: 8px 8px 0;
  margin-top: 8px;
  border-top: 1px solid var(--border-secondary-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

<style>
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
