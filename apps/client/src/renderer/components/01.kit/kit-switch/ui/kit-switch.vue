<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { computed } from 'vue'

type SwitchColor = 'accent' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'
type SwitchSize = 'sm' | 'md'

interface Props {
  disabled?: boolean
  readonly?: boolean
  color?: SwitchColor
  size?: SwitchSize
  id?: string
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  color: 'accent',
  size: 'md',
})

const model = defineModel<boolean>({ default: false })

const colorClass = computed(() => `is-color-${props.color}`)
const sizeClass = computed(() => `is-size-${props.size}`)
</script>

<template>
  <SwitchRoot
    :id="id"
    v-model="model"
    class="kit-switch-root"
    :class="[colorClass, sizeClass, { 'is-readonly': readonly }]"
    :disabled="disabled || readonly"
    :aria-label="ariaLabel"
  >
    <SwitchThumb class="kit-switch-thumb" />
  </SwitchRoot>
</template>

<style scoped lang="scss">
.kit-switch-root {
  position: relative;
  display: inline-flex;
  align-items: center;
  border-radius: var(--r-full);
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  outline: none;
  padding: 0;
  transition:
    background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  user-select: none;

  &:focus-visible {
    box-shadow:
      0 0 0 2px var(--bg-primary-color),
      0 0 0 4px var(--fg-accent-color);
  }

  &[data-disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.is-readonly {
    pointer-events: none;
  }

  // Sizes
  &.is-size-md {
    width: 40px;
    height: 22px;

    .kit-switch-thumb {
      width: 16px;
      height: 16px;
      transform: translateX(2px);

      &[data-state='checked'] {
        transform: translateX(20px);
      }
    }
  }

  &.is-size-sm {
    width: 32px;
    height: 18px;

    .kit-switch-thumb {
      width: 12px;
      height: 12px;
      transform: translateX(2px);

      &[data-state='checked'] {
        transform: translateX(16px);
      }
    }
  }

  // Checked Colors
  &[data-state='checked'] {
    &.is-color-accent {
      background-color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
    }

    &.is-color-primary {
      background-color: var(--fg-primary-color);
      border-color: var(--fg-primary-color);
    }

    &.is-color-secondary {
      background-color: var(--fg-secondary-color);
      border-color: var(--fg-secondary-color);
    }

    &.is-color-success {
      background-color: var(--fg-success-color);
      border-color: var(--fg-success-color);
    }

    &.is-color-warning {
      background-color: var(--fg-warning-color);
      border-color: var(--fg-warning-color);
    }

    &.is-color-error {
      background-color: var(--fg-error-color);
      border-color: var(--fg-error-color);
    }
  }
}

.kit-switch-thumb {
  display: block;
  border-radius: var(--r-full);
  background-color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}
</style>
