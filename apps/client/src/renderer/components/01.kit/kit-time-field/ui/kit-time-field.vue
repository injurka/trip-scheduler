<script setup lang="ts">
import { Time } from '@internationalized/date'
import { TimeFieldInput, TimeFieldRoot } from 'reka-ui'
import { watch } from 'vue'

interface Props {
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  hourCycle?: '12' | '24'
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '--:--',
  hourCycle: '24',
})

const model = defineModel<Time | null | undefined>({ required: true })

watch(model, (newValue) => {
  if (newValue === null)
    model.value = new Time(0, 0)
})
</script>

<template>
  <div class="kit-time-field-wrapper">
    <TimeFieldRoot
      id="time-field"
      v-slot="{ segments }"
      v-model="model"
      granularity="minute"
      :disabled="props.disabled"
      :readonly="props.readonly"
      class="kit-time-field"
      :hour-cycle="24"
      part="dayPeriod"
    >
      <template
        v-for="item in segments"
        :key="item.part"
      >
        <TimeFieldInput
          v-if="item.part === 'literal'"
          :part="item.part"
        >
          {{ item.value }}
        </TimeFieldInput>
        <TimeFieldInput
          v-else
          :part="item.part"
        >
          {{ item.value }}
        </TimeFieldInput>
      </template>
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
