<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'
import { computed } from 'vue'

type CheckboxColor = 'accent' | 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'error'

interface Props {
  disabled?: boolean
  readonly?: boolean
  color?: CheckboxColor
}

const props = withDefaults(defineProps<Props>(), {
  color: 'accent',
})

const model = defineModel<boolean>()

const id = `kit-checkbox-${Math.random().toString(36).substring(2, 9)}`

/**
 * Генерирует класс для цветового оформления.
 */
const colorClass = computed(() => `is-color-${props.color}`)
</script>

<template>
  <label
    :for="id"
    class="kit-checkbox-wrapper"
    :class="{ 'is-disabled': disabled, 'is-readonly': readonly }"
  >
    <CheckboxRoot
      :id="id"
      v-model="model"
      class="kit-checkbox-root"
      :class="colorClass"
      :disabled="disabled"
    >
      <CheckboxIndicator class="kit-checkbox-indicator">
        <Icon icon="mdi:check" class="kit-checkbox-icon" />
      </CheckboxIndicator>
    </CheckboxRoot>

    <span v-if="$slots.default" class="kit-checkbox-label">
      <slot />
    </span>
  </label>
</template>

<style lang="scss">
.kit-checkbox-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s ease-out;

  // Стиль для полностью отключенного состояния
  &.is-disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  // Стиль для состояния "только для чтения"
  &.is-readonly {
    pointer-events: none; // Блокируем любые события мыши (клики, наведения)
  }
}

.kit-checkbox-root {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-xs);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;

  &:hover:not([data-disabled]) {
    transform: scale(1.05);
  }

  // --- Стили для разных цветов ---
  &.is-color-accent {
    &:hover:not([data-disabled]) {
      border-color: var(--border-accent-color);
    }
    &[data-state='checked'] {
      background-color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
    }
  }

  &.is-color-primary {
    &:hover:not([data-disabled]) {
      border-color: var(--border-primary-color);
    }
    &[data-state='checked'] {
      background-color: var(--fg-primary-color);
      border-color: var(--fg-primary-color);
    }
  }

  &.is-color-secondary {
    &:hover:not([data-disabled]) {
      border-color: var(--border-secondary-color);
    }
    &[data-state='checked'] {
      background-color: var(--fg-secondary-color);
      border-color: var(--fg-secondary-color);
    }
  }

  &.is-color-tertiary {
    &:hover:not([data-disabled]) {
      border-color: var(--border-secondary-color);
    }
    &[data-state='checked'] {
      background-color: var(--fg-tertiary-color);
      border-color: var(--fg-tertiary-color);
    }
  }

  &.is-color-success {
    &:hover:not([data-disabled]) {
      border-color: var(--border-success-color);
    }
    &[data-state='checked'] {
      background-color: var(--fg-success-color);
      border-color: var(--fg-success-color);
    }
  }

  &.is-color-warning {
    &:hover:not([data-disabled]) {
      border-color: var(--border-warning-color);
    }
    &[data-state='checked'] {
      background-color: var(--fg-warning-color);
      border-color: var(--fg-warning-color);
    }
  }

  &.is-color-error {
    &:hover:not([data-disabled]) {
      border-color: var(--border-error-color);
    }
    &[data-state='checked'] {
      background-color: var(--fg-error-color);
      border-color: var(--fg-error-color);
    }
  }

  &[data-state='checked'] {
    transform: scale(1.02);
  }

  &:active:not([data-disabled]) {
    transform: scale(0.98);
  }
}

.kit-checkbox-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
}

.kit-checkbox-icon {
  color: var(--fg-inverted-color);
  font-size: 14px;
  transform: scale(0);
  transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  align-items: center;
  justify-content: center;

  [data-state='checked'] & {
    transform: scale(1);
  }

  [data-state='unchecked'] & {
    transform: scale(0);
  }
}

.kit-checkbox-label {
  color: var(--fg-primary-color);
  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1.4;
  transition: color 0.2s ease-out;
}
</style>
