<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface Props {
  label?: string
  icon?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'textarea'
  name?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  error?: string | null
  size?: 'sm' | 'md' | 'lg'
}

defineOptions({
  inheritAttrs: false,
})

withDefaults(defineProps<Props>(), {
  label: '',
  icon: undefined,
  type: 'text',
  name: undefined,
  placeholder: '',
  disabled: false,
  required: false,
  error: null,
  size: 'md',
})

const model = defineModel<string | number | null>()

const id = `kit-input-${Math.random().toString(36).substring(2, 9)}`
</script>

<template>
  <div class="kit-input-group" :class="{ 'has-error': !!error }">
    <label v-if="label" :for="id">{{ label }}</label>
    <div class="kit-input-wrapper">
      <Icon v-if="icon" :icon="icon" class="input-icon-prefix" />
      <textarea
        v-if="type === 'textarea'"
        :id="id"
        v-model="model"
        :name="name"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :class="[
          `kit-input-${size}`,
          { 'has-prefix-icon': !!icon, 'has-append-icon': $slots.append },
        ]"
        v-bind="$attrs"
        rows="3"
      />
      <input
        v-else
        :id="id"
        v-model="model"
        :type="type"
        :name="name"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :class="[
          `kit-input-${size}`,
          { 'has-prefix-icon': !!icon, 'has-append-icon': $slots.append },
        ]"
        v-bind="$attrs"
      >
      <div v-if="$slots.append" class="input-icon-append">
        <slot name="append" />
      </div>
    </div>
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.kit-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}

.kit-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;

  .input-icon-prefix {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--fg-tertiary-color);
    pointer-events: none;
    z-index: 1;
  }

  input,
  textarea {
    width: 100%;
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-s);
    color: var(--fg-primary-color);
    transition: border-color 0.2s;
    font-family: inherit;
    font-size: 1rem;

    &.has-prefix-icon {
      padding-left: 40px;
    }

    &.has-append-icon {
      padding-right: 40px;
    }

    &:focus {
      outline: none;
      border-color: var(--border-focus-color);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }
  }

  textarea {
    resize: vertical;
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .kit-input-sm {
    min-height: 38px;
    padding: 10px;
    font-size: 0.875rem;
  }

  .kit-input-md {
    min-height: 46px;
    padding: 12px;
    font-size: 1rem;
  }

  .kit-input-lg {
    min-height: 54px;
    padding: 14px;
    font-size: 1.125rem;
  }

  .input-icon-append {
    position: absolute;
    right: 8px;
    display: flex;
    align-items: center;
    height: 100%;
    z-index: 1;

    :deep(.icon-btn) {
      display: flex;
      color: var(--fg-secondary-color);
      padding: 4px;
      border-radius: 50%;

      &:hover {
        color: var(--fg-primary-color);
        background-color: rgba(var(--fg-primary-color-rgb), 0.1);
      }
    }
  }
}

.has-error {
  label {
    color: var(--fg-error-color);
  }
  input,
  textarea {
    border-color: var(--border-error-color) !important;
  }
}

.error-message {
  font-size: 0.8rem;
  color: var(--fg-error-color);
  margin-top: 2px;
}
</style>
