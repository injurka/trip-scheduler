<script setup lang="ts" generic="T extends string | number">
import type { KitRadioOption } from '../models/types'
import { Icon } from '@iconify/vue'
import { RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from 'reka-ui'

withDefaults(defineProps<{
  options: KitRadioOption<T>[]
  disabled?: boolean
  orientation?: 'vertical' | 'horizontal'
}>(), {
  disabled: false,
  orientation: 'vertical',
})

const model = defineModel<T>({ required: true })
</script>

<template>
  <RadioGroupRoot
    v-model="model"
    class="kit-radio-group"
    :class="[`is-${orientation}`, { 'is-disabled': disabled }]"
    :disabled="disabled"
    :orientation="orientation"
  >
    <RadioGroupItem
      v-for="option in options"
      :key="String(option.value)"
      :value="option.value as string"
      class="kit-radio-item"
    >
      <div class="item-main-content">
        <Icon v-if="option.icon" :icon="option.icon" class="item-icon" />
        <div class="item-text">
          <span class="item-label">{{ option.label }}</span>
          <span v-if="option.description" class="item-description">{{ option.description }}</span>
        </div>
      </div>

      <div class="item-radio-circle">
        <RadioGroupIndicator class="item-radio-indicator" />
      </div>
    </RadioGroupItem>
  </RadioGroupRoot>
</template>

<style scoped lang="scss">
.kit-radio-group {
  display: flex;
  gap: 12px;

  &.is-vertical {
    flex-direction: column;
  }

  &.is-horizontal {
    flex-direction: row;
    flex-wrap: wrap;

    .kit-radio-item {
      flex: 1;
      min-width: 200px;
    }
  }

  &.is-disabled {
    opacity: 0.6;
    pointer-events: none;
  }
}

.kit-radio-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--border-accent-color);
  }

  &[data-state='checked'] {
    background: rgba(var(--bg-accent-overlay-color-rgb), 0.2);
    border-color: rgba(var(--bg-accent-overlay-color-rgb), 0.8);

    .item-icon {
      color: var(--fg-accent-color);
    }

    .item-radio-circle {
      border-color: var(--fg-accent-color);
    }
  }
}

.item-main-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
}

.item-icon {
  font-size: 1.5rem;
  color: var(--fg-secondary-color);
  flex-shrink: 0;
  margin-top: 2px;
  transition: color 0.2s ease;
}

.item-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-label {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--fg-primary-color);
  line-height: 1.2;
}

.item-description {
  font-size: 0.85rem;
  color: var(--fg-tertiary-color);
  line-height: 1.4;
}

.item-radio-circle {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--border-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: border-color 0.2s ease;
}

.item-radio-indicator {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--fg-accent-color);
  animation: scale-in 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

@keyframes scale-in {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
