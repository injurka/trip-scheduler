<script setup lang="ts">
import type { Time } from '@internationalized/date'
import { TimeFieldInput, TimeFieldRoot } from 'reka-ui'
import { computed } from 'vue'

interface Props {
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  hourCycle?: 12 | 24
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '--:--',
  hourCycle: 24,
})

const model = defineModel<Time | null | undefined>({ required: true })

/**
 * Reka UI ожидает `Time | undefined`, а не `Time | null`.
 * Когда model = null, важно передавать undefined — иначе Time(0,0)
 * инициализирует segmentValues.hour = 0 вместо null,
 * из-за чего updateHour считает "0" первой введённой цифрой
 * и прыгает на следующий сегмент уже после первого нажатия.
 */
const internalModel = computed({
  get: (): Time | undefined => model.value ?? undefined,
  set: (val: Time | undefined) => {
    model.value = val ?? null
  },
})
</script>

<template>
  <div class="kit-time-field-wrapper">
    <TimeFieldRoot
      id="time-field"
      v-slot="{ segments }"
      v-model="internalModel"
      granularity="minute"
      :disabled="props.disabled"
      :readonly="props.readonly"
      :hour-cycle="props.hourCycle"
      class="kit-time-field"
    >
      <TimeFieldInput
        v-for="item in segments"
        :key="item.part"
        :part="item.part"
      >
        {{ item.value }}
      </TimeFieldInput>
    </TimeFieldRoot>
  </div>
</template>

<style lang="scss">
.kit-time-field-wrapper {
  display: flex;
  flex-direction: column;
}

.kit-time-field {
  display: flex;
  align-items: center;
  padding: 0 4px;
  border-radius: var(--r-2xs);
  border-width: 1px;
  text-align: center;
  background-color: var(--bg-tertiary-color);
  user-select: none;

  .TimeFieldLiteral {
    &:last-of-type {
      display: none;
    }
  }
}
</style>
