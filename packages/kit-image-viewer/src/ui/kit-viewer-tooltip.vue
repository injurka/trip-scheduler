<script setup lang="ts">
import { arrow, autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { useMediaQuery } from '@vueuse/core'
import { computed, onUnmounted, ref, useSlots } from 'vue'

interface Props {
  text?: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'top',
  disabled: false,
})

const slots = useSlots()

const referenceRef = ref<HTMLElement | null>(null)
const floatingRef = ref<HTMLElement | null>(null)
const arrowRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)

const isHoverable = useMediaQuery('(hover: hover)')

const { x, y, strategy, middlewareData, placement: finalPlacement } = useFloating(referenceRef, floatingRef, {
  placement: props.placement,
  whileElementsMounted: autoUpdate,
  middleware: [
    offset(8),
    flip(),
    shift({ padding: 8 }),
    arrow({ element: arrowRef }),
  ],
  open: isVisible,
})

let timeout: ReturnType<typeof setTimeout>

function show() {
  if (props.disabled || (!props.text && !slots.content) || !isHoverable.value)
    return
  clearTimeout(timeout)
  timeout = setTimeout(() => {
    isVisible.value = true
  }, 200)
}

function hide() {
  clearTimeout(timeout)
  isVisible.value = false
}

const floatingStyle = computed(() => {
  const isPositioned = x.value != null && y.value != null

  return {
    position: strategy.value,
    top: isPositioned ? `${y.value}px` : '0',
    left: isPositioned ? `${x.value}px` : '0',
    width: 'max-content',
    visibility: isPositioned ? ('visible' as const) : ('hidden' as const),
  }
})

const arrowStyle = computed(() => {
  if (!middlewareData.value.arrow)
    return {}
  const { x: arrowX, y: arrowY } = middlewareData.value.arrow
  const staticSide = {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right',
  }[finalPlacement.value.split('-')[0]]

  return {
    left: arrowX != null ? `${arrowX}px` : '',
    top: arrowY != null ? `${arrowY}px` : '',
    [staticSide as string]: '-4px',
  }
})

onUnmounted(() => {
  hide()
})
</script>

<template>
  <div
    class="kit-viewer-tooltip-wrapper"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
    @click="hide"
  >
    <div ref="referenceRef" class="kit-viewer-tooltip-trigger">
      <slot />
    </div>

    <Teleport to="body">
      <Transition name="tooltip-fade">
        <div
          v-if="isVisible"
          ref="floatingRef"
          class="kit-viewer-tooltip-floating"
          :data-placement="finalPlacement"
          :style="floatingStyle"
          role="tooltip"
        >
          <slot name="content">
            {{ text }}
          </slot>
          <div ref="arrowRef" class="kit-viewer-tooltip-arrow" :style="arrowStyle" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.kit-viewer-tooltip-wrapper {
  display: inline-flex;
}

.kit-viewer-tooltip-trigger {
  display: inline-flex;
}

.kit-viewer-tooltip-floating {
  z-index: var(--z-tooltip, 10000);
  background-color: var(--bg-tertiary-color, #2a2a2a);
  color: var(--fg-primary-color, #ffffff);
  padding: 6px 12px;
  border-radius: var(--r-s, 8px);
  font-size: 0.85rem;
  font-weight: 500;
  box-shadow: var(--s-l, 0 4px 16px rgba(0, 0, 0, 0.4));
  pointer-events: none;
  max-width: 250px;
  white-space: normal;
  text-align: center;
  border: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.15));
  transform-origin: center;
}

.kit-viewer-tooltip-arrow {
  position: absolute;
  width: 8px;
  height: 8px;
  background-color: var(--bg-tertiary-color, #2a2a2a);
  transform: rotate(45deg);
}

.kit-viewer-tooltip-floating[data-placement^='top'] .kit-viewer-tooltip-arrow {
  border-bottom: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.15));
  border-right: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.15));
}

.kit-viewer-tooltip-floating[data-placement^='bottom'] .kit-viewer-tooltip-arrow {
  border-top: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.15));
  border-left: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.15));
}

.kit-viewer-tooltip-floating[data-placement^='left'] .kit-viewer-tooltip-arrow {
  border-top: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.15));
  border-right: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.15));
}

.kit-viewer-tooltip-floating[data-placement^='right'] .kit-viewer-tooltip-arrow {
  border-bottom: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.15));
  border-left: 1px solid var(--border-secondary-color, rgba(255, 255, 255, 0.15));
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
