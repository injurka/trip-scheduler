<script setup lang="ts" generic="T extends string | number">
import type { ViewSwitcherItem } from '../models/types'
import { Icon } from '@iconify/vue'
import { useResizeObserver } from '@vueuse/core'

const props = withDefaults(defineProps<{
  items: ViewSwitcherItem<T>[]
  disabled?: boolean
  fullWidth?: boolean
}>(), {
  disabled: false,
  fullWidth: false,
})

const emit = defineEmits<{
  (e: 'change', value: T): void
}>()

const model = defineModel<T>({ required: true })

const switcherRef = ref<HTMLElement | null>(null)
const buttonRefs = ref<Record<string | number, HTMLElement>>({})

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
  gliderStyle.value.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
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
        gliderStyle.value.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
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
      class="kit-view-switcher-button"
      :class="{ 'is-active': model === item.id }"
      :disabled="disabled"
      @click="handleItemClick(item.id)"
    >
      <Icon
        v-if="item.icon"
        width="18"
        height="18"
        :icon="item.icon"
        class="kit-view-switcher-icon"
      />
      <span v-if="item.label" class="kit-view-switcher-label">{{ item.label }}</span>
    </button>
  </div>
</template>

<style lang="scss">
.kit-view-switcher {
  position: relative;
  display: inline-flex;
  align-items: center;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-s);
  padding: 4px;
  border: 1px solid var(--border-secondary-color);
  user-select: none;
  transition: opacity 0.2s ease-out;
  height: 46px;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;

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
}

.kit-view-switcher-glider {
  position: absolute;
  top: 4px;
  left: 0;
  height: calc(100% - 8px);
  background-color: var(--bg-primary-color);
  border-radius: var(--r-xs);
  box-shadow: var(--s-s);
  z-index: 1;
  opacity: 0;
  pointer-events: none;
}

.kit-view-switcher-button {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  background-color: transparent;
  border: none;
  border-radius: var(--r-xs);
  cursor: pointer;
  transition:
    color 0.2s ease,
    font-weight 0.2s ease;
  white-space: nowrap;
  min-height: 36px;
  flex-shrink: 0;

  // full-width: buttons share space evenly, but still no text wrap
  .is-full-width & {
    flex: 1 0 0;
    min-width: 0;
    justify-content: center;
  }

  &:disabled {
    cursor: not-allowed;
  }

  &.is-active {
    color: var(--fg-accent-color);
    font-weight: 600;
  }

  &:not(.is-active):hover:not(:disabled) {
    color: var(--fg-primary-color);
  }
}

.kit-view-switcher-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.kit-view-switcher-label {
  transition: color 0.3s ease;
  white-space: nowrap;
}

// ── Mobile: icon-only mode ─────────────────────────────────────
@include media-down(sm) {
  .kit-view-switcher {
    width: 100%;
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    justify-content: flex-start;

    .kit-view-switcher-button {
      flex: 1 0 80px;
      min-width: 80px;
      justify-content: center;
      padding: 8px 10px;

      .kit-view-switcher-label {
        display: none; // icons only on mobile
      }
    }
  }
}
</style>
