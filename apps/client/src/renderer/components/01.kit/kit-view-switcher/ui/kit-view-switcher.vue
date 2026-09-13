<script setup lang="ts" generic="T extends string | number">
import type { ViewSwitcherItem } from '../models/types'
import { Icon } from '@iconify/vue'
import { useResizeObserver } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  items: ViewSwitcherItem<T>[]
  disabled?: boolean
  fullWidth?: boolean
  size?: 'sm' | 'md' | 'lg'
}>(), {
  disabled: false,
  fullWidth: false,
  size: 'md',
})

const emit = defineEmits<{
  (e: 'change', value: T): void
}>()

const model = defineModel<T>({ required: true })

const switcherRef = ref<HTMLElement | null>(null)
const buttonRefs = ref<Record<string | number, HTMLElement>>({})

const iconSize = computed(() => {
  switch (props.size) {
    case 'sm':
      return 15
    case 'lg':
      return 18
    case 'md':
    default:
      return 16
  }
})

const gliderStyle = ref({
  opacity: 0,
  width: '0px',
  transform: 'translateX(0px)',
  transition: 'none',
})

let isPointerDown = false
let startPointerX = 0
let startScrollLeft = 0
let isDragging = false

function handlePointerDown(e: PointerEvent) {
  const switcherEl = switcherRef.value
  if (!switcherEl || props.disabled)
    return
  isPointerDown = true
  isDragging = false
  startPointerX = e.pageX
  startScrollLeft = switcherEl.scrollLeft
}

function handlePointerMove(e: PointerEvent) {
  if (!isPointerDown)
    return
  const switcherEl = switcherRef.value
  if (!switcherEl)
    return

  const deltaX = e.pageX - startPointerX
  if (Math.abs(deltaX) > 5) {
    isDragging = true
    switcherEl.scrollLeft = startScrollLeft - deltaX
  }
}

function handlePointerUp() {
  isPointerDown = false
}

function handleItemClick(itemId: T) {
  if (props.disabled || isDragging)
    return

  model.value = itemId
  emit('change', itemId)
}

function updateGliderPosition() {
  const switcherEl = switcherRef.value
  if (!switcherEl)
    return

  const activeButton = buttonRefs.value[model.value]
  if (!activeButton) {
    gliderStyle.value.opacity = 0
    return
  }

  const offsetLeft = activeButton.offsetLeft
  const width = activeButton.offsetWidth

  gliderStyle.value = {
    ...gliderStyle.value,
    opacity: 1,
    width: `${width}px`,
    transform: `translateX(${offsetLeft}px)`,
  }
}

function scrollActiveButtonIntoView(button: HTMLElement) {
  const switcherEl = switcherRef.value
  if (!switcherEl)
    return

  const buttonLeft = button.offsetLeft
  const buttonRight = buttonLeft + button.offsetWidth
  const scrollLeft = switcherEl.scrollLeft
  const clientWidth = switcherEl.clientWidth

  if (buttonLeft < scrollLeft) {
    switcherEl.scrollTo({ left: Math.max(0, buttonLeft - 12), behavior: 'smooth' })
  }
  else if (buttonRight > scrollLeft + clientWidth) {
    switcherEl.scrollTo({ left: buttonRight - clientWidth + 12, behavior: 'smooth' })
  }
}

watch(model, () => {
  gliderStyle.value.transition = 'all 0.25s cubic-bezier(0.2, 0, 0, 1)'
  updateGliderPosition()
  const activeButton = buttonRefs.value[model.value]
  if (activeButton) {
    scrollActiveButtonIntoView(activeButton)
  }
}, { flush: 'post' })

useResizeObserver(switcherRef, () => {
  gliderStyle.value.transition = 'none'
  updateGliderPosition()
})

onMounted(() => {
  updateGliderPosition()

  nextTick(() => {
    setTimeout(() => {
      if (gliderStyle.value) {
        gliderStyle.value.transition = 'all 0.25s cubic-bezier(0.2, 0, 0, 1)'
      }
      const activeButton = buttonRefs.value[model.value]
      if (activeButton) {
        scrollActiveButtonIntoView(activeButton)
      }
    }, 50)
  })
})
</script>

<template>
  <div
    ref="switcherRef"
    class="kit-view-switcher"
    :class="{
      'is-disabled': disabled,
      'is-full-width': fullWidth,
      [`is-size-${size}`]: true,
    }"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerUp"
  >
    <div class="kit-view-switcher-glider" :style="gliderStyle" />

    <button
      v-for="item in items"
      :key="item.id"
      :ref="el => (buttonRefs[item.id] = el as HTMLElement)"
      type="button"
      class="kit-view-switcher-button"
      :class="{
        'is-active': model === item.id,
        'is-icon-only': !item.label,
      }"
      :disabled="disabled"
      @click="handleItemClick(item.id)"
    >
      <Icon
        v-if="item.icon"
        :width="iconSize"
        :height="iconSize"
        :icon="item.icon"
        class="kit-view-switcher-icon"
      />
      <span v-if="item.label" class="kit-view-switcher-label">{{ item.label }}</span>
    </button>
  </div>
</template>

<style lang="scss">
.kit-view-switcher {
  --kvs-height: 36px;
  --kvs-padding: 3px;
  --kvs-radius: var(--r-s, 8px);
  --kvs-font-size: 0.8125rem;
  --kvs-btn-padding: 0 14px;
  --kvs-gap: 6px;

  position: relative;
  display: inline-flex;
  align-items: center;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--kvs-radius);
  padding: var(--kvs-padding);
  border: 1px solid var(--border-secondary-color);
  user-select: none;
  transition:
    opacity 0.2s ease-out,
    border-color 0.2s ease;
  height: var(--kvs-height);
  box-sizing: border-box;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.08);

  &::-webkit-scrollbar {
    display: none;
  }

  &.is-disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  &.is-full-width {
    display: flex;
    width: 100%;
  }

  &.is-size-sm {
    --kvs-height: 30px;
    --kvs-padding: 2.5px;
    --kvs-radius: var(--r-xs, 6px);
    --kvs-font-size: 0.75rem;
    --kvs-btn-padding: 0 10px;
    --kvs-gap: 5px;
  }

  &.is-size-md {
    --kvs-height: 36px;
    --kvs-padding: 3px;
    --kvs-radius: var(--r-s, 8px);
    --kvs-font-size: 0.8125rem;
    --kvs-btn-padding: 0 14px;
    --kvs-gap: 6px;
  }

  &.is-size-lg {
    --kvs-height: 42px;
    --kvs-padding: 4px;
    --kvs-radius: var(--r-s, 8px);
    --kvs-font-size: 0.875rem;
    --kvs-btn-padding: 0 18px;
    --kvs-gap: 8px;
  }
}

.kit-view-switcher-glider {
  position: absolute;
  top: var(--kvs-padding);
  left: 0;
  height: calc(100% - (var(--kvs-padding) * 2));
  background-color: var(--bg-primary-color);
  border-radius: calc(var(--kvs-radius) - 2px);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.18),
    0 1px 2px rgba(0, 0, 0, 0.1);
  border: 1px solid color-mix(in srgb, var(--border-primary-color) 60%, transparent);
  z-index: 1;
  opacity: 0;
  pointer-events: none;
  box-sizing: border-box;
}

.kit-view-switcher-button {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--kvs-gap);
  padding: var(--kvs-btn-padding);
  font-size: var(--kvs-font-size);
  font-weight: 500;
  color: var(--fg-secondary-color);
  background-color: transparent;
  border: none;
  border-radius: calc(var(--kvs-radius) - 2px);
  cursor: pointer;
  transition: color 0.15s ease;
  white-space: nowrap;
  min-height: 0;
  height: 100%;
  flex-shrink: 0;
  outline: none;

  .is-full-width & {
    flex: 1 0 0;
    min-width: 0;
    justify-content: center;
  }

  &.is-icon-only {
    padding: 0 8px;
  }

  &:disabled {
    cursor: not-allowed;
  }

  &:hover:not(:disabled):not(.is-active) {
    color: var(--fg-primary-color);
  }

  &.is-active {
    color: var(--fg-primary-color);

    .kit-view-switcher-icon {
      color: var(--fg-accent-color);
    }
  }
}

.kit-view-switcher-icon {
  flex-shrink: 0;
  transition: color 0.15s ease;
}

.kit-view-switcher-label {
  white-space: nowrap;
  letter-spacing: -0.01em;
}

// ── Mobile: clean handling ─────────────────────────────────────
@include media-down(sm) {
  .kit-view-switcher {
    &.is-full-width {
      .kit-view-switcher-button {
        padding: 0 6px;

        .kit-view-switcher-label {
          display: none;
        }
      }
    }
  }
}
</style>
