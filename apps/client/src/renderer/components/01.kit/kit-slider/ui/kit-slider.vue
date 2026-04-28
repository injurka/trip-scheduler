<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { computed } from 'vue'

interface Props {
  label?: string
  min?: number
  max?: number
  step?: number
  valueFormatter?: (value: number) => string
  color?: 'primary' | 'accent' | 'success' | 'warning' | 'error'
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
  color: 'accent',
})

const model = defineModel<number>({ required: true })

// Reka UI SliderRoot ожидает массив значений
const internalValue = computed({
  get: () => [model.value],
  set: (val: number[]) => {
    model.value = val[0]
  },
})

const displayValue = computed(() => {
  return props.valueFormatter ? props.valueFormatter(model.value) : model.value
})
</script>

<template>
  <div class="kit-slider-wrapper">
    <div v-if="label" class="kit-slider-header">
      <span class="kit-slider-label">{{ label }}</span>
      <strong class="kit-slider-value">{{ displayValue }}</strong>
    </div>

    <SliderRoot
      v-model="internalValue"
      class="kit-slider-root"
      :max="max"
      :min="min"
      :step="step"
    >
      <SliderTrack class="kit-slider-track">
        <SliderRange class="kit-slider-range" :class="`is-${color}`" />
      </SliderTrack>
      <SliderThumb class="kit-slider-thumb" aria-label="Volume" />
    </SliderRoot>
  </div>
</template>

<style scoped lang="scss">
.kit-slider-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.kit-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: var(--fg-primary-color);

  .kit-slider-label {
    color: var(--fg-secondary-color);
  }

  .kit-slider-value {
    font-weight: 600;
  }
}

.kit-slider-root {
  position: relative;
  display: flex;
  align-items: center;
  user-select: none;
  touch-action: none;
  width: 100%;
  height: 20px;
}

.kit-slider-track {
  background-color: var(--bg-tertiary-color);
  position: relative;
  flex-grow: 1;
  border-radius: var(--r-full);
  height: 6px;
}

.kit-slider-range {
  position: absolute;
  background-color: var(--fg-accent-color);
  border-radius: var(--r-full);
  height: 100%;

  &.is-primary {
    background-color: var(--fg-primary-color);
  }
  &.is-accent {
    background-color: var(--fg-accent-color);
  }
  &.is-success {
    background-color: var(--fg-success-color);
  }
  &.is-warning {
    background-color: var(--fg-warning-color);
  }
  &.is-error {
    background-color: var(--fg-error-color);
  }
}

.kit-slider-thumb {
  display: block;
  width: 18px;
  height: 18px;
  background-color: var(--bg-primary-color);
  box-shadow: 0 2px 6px var(--bg-overlay-primary-color);
  border-radius: 50%;
  border: 2px solid var(--fg-accent-color);
  cursor: grab;
  transition:
    transform 0.2s,
    box-shadow 0.2s;

  &:focus {
    outline: none;
  }

  &:active {
    cursor: grabbing;
    transform: scale(1.1);
  }
}
</style>
