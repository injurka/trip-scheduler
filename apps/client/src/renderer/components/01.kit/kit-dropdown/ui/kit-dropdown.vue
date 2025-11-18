<script setup lang="ts" generic="T extends string | number | symbol | object">
import type { KitDropdownItem } from '../models/types'
import { Icon } from '@iconify/vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'

const props = withDefaults(defineProps<{
  items?: KitDropdownItem<T>[]
  modelValue?: T | null
  sideOffset?: number
  align?: 'start' | 'center' | 'end'
  size?: 'sm' | 'md' | 'lg'
  portalTarget?: HTMLElement
}>(), {
  items: () => [],
  modelValue: null,
  sideOffset: 8,
  align: 'start',
  size: 'md',
  portalTarget: undefined,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: T): void
}>()

const open = defineModel<boolean>('open')

function handleSelect(item: KitDropdownItem<T>) {
  emit('update:modelValue', item.value)
}
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger as-child>
      <slot name="trigger" />
    </DropdownMenuTrigger>

    <DropdownMenuPortal :to="props.portalTarget">
      <DropdownMenuContent
        class="kit-dropdown-content"
        :side-offset="props.sideOffset"
        :align="props.align"
      >
        <!-- Рендер из items, если они переданы -->
        <template v-if="props.items.length > 0">
          <DropdownMenuItem
            v-for="item in props.items"
            :key="String(item.value)"
            class="kit-dropdown-item"
            :class="[`kit-dropdown-item--${size}`, { 'active': modelValue === item.value, 'is-destructive': item.isDestructive }]"
            @click="handleSelect(item)"
          >
            <Icon v-if="item.icon" :icon="item.icon" class="item-icon" />
            <span class="item-label">{{ item.label }}</span>
          </DropdownMenuItem>
        </template>

        <!-- Рендер из слота для кастомного контента -->
        <slot />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style lang="scss">
.kit-dropdown-content {
  padding: 6px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-s);
  box-shadow: var(--shadow-m);
  z-index: 2100;
  min-width: 200px;
}

.kit-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: var(--r-xs);
  cursor: pointer;
  transition: background-color 0.2s ease;
  outline: none;

  // --- Sizing ---
  &--sm {
    padding: 6px 10px;
    font-size: 0.875rem;
    .item-icon {
      font-size: 1rem;
    }
  }
  &--md {
    padding: 8px 12px;
    font-size: 0.95rem;
    .item-icon {
      font-size: 1.1rem;
    }
  }
  &--lg {
    padding: 10px 14px;
    font-size: 1rem;
    .item-icon {
      font-size: 1.2rem;
    }
  }

  &:hover,
  &[data-highlighted] {
    background-color: var(--bg-hover-color);
  }

  &.active {
    font-weight: 600;
    color: var(--fg-accent-color);
  }

  &.is-destructive {
    color: var(--fg-error-color);
    .item-icon {
      color: var(--fg-error-color);
    }
    &:hover,
    &[data-highlighted] {
      background-color: var(--bg-error-color);
      color: var(--fg-error-color);
      .item-icon {
        color: var(--fg-error-color);
      }
    }
  }
}

.item-icon {
  color: var(--fg-secondary-color);
}

.item-label {
  flex-grow: 1;
}

:slotted(.rating-picker) {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 2px;
}
</style>
