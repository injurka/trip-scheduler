<script setup lang="ts" generic="T extends string | number | symbol | object">
import type { KitViewerDropdownItem } from '../models/types'
import { Icon } from '@iconify/vue'
import { onClickOutside } from '@vueuse/core'
import { ref } from 'vue'

withDefaults(defineProps<{
  modelValue: T
  items: KitViewerDropdownItem<T>[]
  align?: 'start' | 'end'
  sideOffset?: number
}>(), {
  align: 'start',
  sideOffset: 8,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: T): void
}>()

const dropdownRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

function toggle() {
  isOpen.value = !isOpen.value
}

function selectItem(item: KitViewerDropdownItem<T>) {
  emit('update:modelValue', item.value)
  isOpen.value = false
}

onClickOutside(dropdownRef, () => {
  isOpen.value = false
})
</script>

<template>
  <div ref="dropdownRef" class="viewer-dropdown">
    <div class="trigger-wrapper" @click="toggle">
      <slot name="trigger" />
    </div>

    <Transition name="dropdown-fade">
      <div
        v-if="isOpen"
        class="dropdown-panel"
        :class="[`align-${align}`]"
        :style="{ marginTop: `${sideOffset}px` }"
      >
        <button
          v-for="item in items"
          :key="String(item.value)"
          class="dropdown-item"
          :class="{ 'is-active': item.value === modelValue }"
          @click="selectItem(item)"
        >
          <Icon v-if="item.icon" :icon="item.icon" class="item-icon" />
          <span class="item-label">{{ item.label }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.viewer-dropdown {
  position: relative;
  display: inline-block;
}

.dropdown-panel {
  position: absolute;
  top: 100%;
  z-index: 20;
  min-width: 180px;
  background: var(--bg-tertiary-color, #222222);
  border: 1px solid var(--border-primary-color, rgba(255, 255, 255, 0.15));
  border-radius: var(--r-m, 10px);
  padding: 6px;
  overflow: hidden;
  box-shadow: var(--s-l, 0 8px 24px rgba(0, 0, 0, 0.5));

  &.align-start {
    left: 0;
  }
  &.align-end {
    right: 0;
  }
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  border-radius: var(--r-s, 6px);
  font-size: 14px;
  font-weight: 500;
  color: var(--fg-primary-color, #ffffff);
  text-align: left;
  cursor: pointer;
  border: none;
  background-color: transparent;
  transition: all 0.2s ease;

  .item-icon {
    font-size: 18px;
    color: var(--fg-secondary-color, rgba(255, 255, 255, 0.7));
    transition: color 0.2s ease;
  }

  &:hover {
    background-color: var(--bg-hover-color, rgba(255, 255, 255, 0.1));
    color: var(--fg-primary-color, #ffffff);
    .item-icon {
      color: var(--fg-primary-color, #ffffff);
    }
  }

  &.is-active {
    background-color: var(--bg-accent-overlay-color, rgba(59, 130, 246, 0.2));
    color: var(--fg-accent-color, #3b82f6);
    .item-icon {
      color: var(--fg-accent-color, #3b82f6);
    }
  }
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-5px) scale(0.98);
}
</style>
