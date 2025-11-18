<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useSlots } from 'vue'

interface Props {
  icon?: string
  variant?: 'solid' | 'outlined' | 'text' | 'subtle'
  color?: 'primary' | 'secondary'
  disabled?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'solid',
  color: 'primary',
  disabled: false,
  size: 'md',
})

const slots = useSlots()

// Определяем, является ли кнопка иконочной (иконка есть, а слота по умолчанию нет)
const isIconOnly = computed(() => props.icon && !slots.default)

const componentClasses = computed(() => [
  'kit-btn',
  `kit-btn--${props.variant}`,
  `kit-btn--color-${props.color}`,
  `kit-btn--size-${props.size}`,
  { 'kit-btn--icon-only': isIconOnly.value },
])
</script>

<template>
  <button
    :class="componentClasses"
    :disabled="props.disabled"
    type="button"
  >
    <span class="kit-btn-content">
      <Icon v-if="props.icon" :icon="props.icon" class="kit-btn-icon" />
      <slot />
    </span>
  </button>
</template>

<style lang="scss">
.kit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  user-select: none;
  border: 1px solid transparent;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease-in-out;
  box-shadow: var(--s-s);

  & * {
    pointer-events: none;
  }

  &:not(.kit-btn--text):not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: var(--s-l);
  }

  &:not(.kit-btn--text):not(:disabled):active {
    transform: translateY(0px);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    transform: none;
    box-shadow: var(--s-s);
  }

  &--size-xs {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    border-radius: var(--r-3xs, 4px);
    &.kit-btn--icon-only {
      padding: 0.375rem;
    }
    .kit-btn-icon {
      font-size: 1rem;
    }
  }

  &--size-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    border-radius: var(--r-2xs);
    &.kit-btn--icon-only {
      padding: 0.5rem;
    }
    .kit-btn-icon {
      font-size: 1.125rem;
    }
  }

  &--size-md {
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem;
    border-radius: var(--r-2xs);
    &.kit-btn--icon-only {
      padding: 0.625rem;
    }
    .kit-btn-icon {
      font-size: 1.25rem;
    }
  }

  &--size-lg {
    padding: 0.875rem 1.75rem;
    font-size: 1rem;
    border-radius: var(--r-s);
    &.kit-btn--icon-only {
      padding: 0.75rem;
    }
    .kit-btn-icon {
      font-size: 1.375rem;
    }
  }

  &--solid {
    &.kit-btn--color-primary {
      background-color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
      color: var(--fg-inverted-color);

      &:not(:disabled):hover {
        background-color: var(--bg-action-hover-color);
        border-color: var(--bg-action-hover-color);
      }
    }
    &.kit-btn--color-secondary {
      background-color: var(--bg-tertiary-color);
      color: var(--fg-primary-color);

      &:not(:disabled):hover {
        background-color: var(--bg-hover-color);
      }
    }
  }

  &--outlined {
    background-color: transparent;
    box-shadow: none;

    &.kit-btn--color-primary {
      border-color: var(--fg-accent-color);
      color: var(--fg-accent-color);

      &:not(:disabled):hover {
        background-color: var(--bg-disabled-color);
      }
    }
    &.kit-btn--color-secondary {
      border-color: var(--border-secondary-color);
      color: var(--fg-secondary-color);

      &:not(:disabled):hover {
        background-color: var(--bg-hover-color);
        color: var(--fg-primary-color);
        border-color: var(--border-primary-color);
      }
    }
  }

  &--text {
    background-color: transparent;
    box-shadow: none;
    border-color: transparent;

    &.kit-btn--color-primary {
      color: var(--fg-accent-color);

      &:not(:disabled):hover {
        background-color: var(--bg-disabled-color);
      }
    }
    &.kit-btn--color-secondary {
      color: var(--fg-secondary-color);

      &:not(:disabled):hover {
        background-color: var(--bg-hover-color);
        color: var(--fg-primary-color);
      }
    }
  }

  &--subtle {
    background-color: transparent;
    box-shadow: none;
    border-style: dashed;
    border-width: 2px;
    font-weight: 500;

    &.kit-btn--color-primary {
      border-color: var(--fg-accent-color);
      color: var(--fg-accent-color);

      &:not(:disabled):hover {
        background-color: var(--bg-disabled-color);
      }
    }

    &.kit-btn--color-secondary {
      border-color: var(--border-secondary-color);
      color: var(--fg-secondary-color);

      &:not(:disabled):hover {
        background-color: var(--bg-hover-color);
        color: var(--fg-primary-color);
        border-color: var(--border-primary-color);
      }
    }
  }

  &-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &.kit-btn--icon-only {
    .kit-btn-content {
      gap: 0;
    }
  }
}
</style>
