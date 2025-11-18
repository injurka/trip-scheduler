<script setup lang="ts" generic="T extends string | number | symbol | object">
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import { Icon } from '@iconify/vue'
import { onClickOutside } from '@vueuse/core'

withDefaults(defineProps<{
  modelValue: T
  items: KitDropdownItem<T>[]
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

function selectItem(item: KitDropdownItem<T>) {
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
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-m);
  padding: 6px;
  overflow: hidden;
  box-shadow: var(--s-l);

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
  border-radius: var(--r-s);
  font-size: 14px;
  font-weight: 500;
  color: var(--fg-primary-color);
  text-align: left;
  cursor: pointer;
  border: none;
  background-color: transparent;
  transition: all 0.2s ease;

  .item-icon {
    font-size: 18px;
    color: var(--fg-secondary-color);
    transition: color 0.2s ease;
  }

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
    .item-icon {
      color: var(--fg-primary-color);
    }
  }

  &.is-active {
    background-color: var(--bg-accent-overlay-color);
    color: var(--fg-accent-color);
    .item-icon {
      color: var(--fg-accent-color);
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
