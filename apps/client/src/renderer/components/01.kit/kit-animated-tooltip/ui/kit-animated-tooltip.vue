<script setup lang="ts">
import { useEventListener, useMediaQuery } from '@vueuse/core'
import { computed, ref } from 'vue'

interface Props {
  name: string
  offset?: number
}

const props = withDefaults(defineProps<Props>(), {
  offset: 8,
})

const isHoverable = useMediaQuery('(hover: hover) and (pointer: fine)')
const isHovered = ref(false)
const mouseX = ref<number>(0)

const rotation = computed<number>(() => (mouseX.value / 100) * 20)
const translation = computed<number>(() => (mouseX.value / 100) * -10)
const tooltipStyle = computed(() => {
  return {
    bottom: `calc(100% + ${props.offset}px)`,
    transform: `translateX(-50%) translateX(${translation.value}px) rotate(${rotation.value}deg)`,
  }
})

function hide() {
  isHovered.value = false
}

function handlePointerEnter(event: PointerEvent) {
  if (event.pointerType === 'touch' || !isHoverable.value)
    return

  isHovered.value = true
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  mouseX.value = event.clientX - rect.left - rect.width / 2
}

function handlePointerMove(event: PointerEvent) {
  if (event.pointerType === 'touch' || !isHovered.value)
    return

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  mouseX.value = event.clientX - rect.left - rect.width / 2
}

function handlePointerLeave(event: PointerEvent) {
  if (event.pointerType === 'touch')
    return

  hide()
}

function handlePointerDown(event: PointerEvent) {
  if (event.pointerType === 'touch') {
    hide()
  }
}

useEventListener(
  window,
  'scroll',
  () => {
    if (isHovered.value)
      hide()
  },
  { capture: true, passive: true },
)

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isHovered.value)
    hide()
})

useEventListener(window, 'blur', () => {
  if (isHovered.value)
    hide()
})

useEventListener(window, 'popstate', () => {
  if (isHovered.value)
    hide()
})

useEventListener(window, 'hashchange', () => {
  if (isHovered.value)
    hide()
})
</script>

<template>
  <div
    class="kit-animated-tooltip"
    @pointerenter="handlePointerEnter"
    @pointerleave="handlePointerLeave"
    @pointermove="handlePointerMove"
    @pointerdown="handlePointerDown"
  >
    <transition name="tooltip">
      <div
        v-if="isHovered"
        :style="tooltipStyle"
        class="tooltip-container"
      >
        <div class="tooltip-gradient-top" />
        <div class="tooltip-gradient-bottom" />
        <div class="tooltip-name">
          {{ name }}
        </div>
      </div>
    </transition>

    <slot />
  </div>
</template>

<style scoped lang="scss">
.kit-animated-tooltip {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tooltip-container {
  position: absolute;
  left: 50%;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  border-radius: var(--r-m);
  background-color: var(--bg-tertiary-color);
  padding: 8px 16px;
  font-size: 0.75rem;
  box-shadow: var(--s-l);
  transform-origin: bottom center;
}

.tooltip-gradient-top {
  position: absolute;
  right: 50%;
  transform: translateX(50%);
  bottom: -2px;
  z-index: 30;
  height: 2px;
  width: 40%;
  margin-right: 0.25rem;
  background-image: linear-gradient(to right, transparent, var(--bg-hover-color), transparent);
}

.tooltip-gradient-bottom {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: -2px;
  z-index: 30;
  height: 2px;
  margin-left: 0.25rem;
  width: 40%;
  background-image: linear-gradient(to right, transparent, var(--bg-highlight-color), transparent);
}

.tooltip-name {
  position: relative;
  z-index: 30;
  font-size: 1rem;
  font-weight: 700;
  color: var(--fg-primary-color);
}

.tooltip-enter-active,
.tooltip-leave-active {
  transition:
    opacity 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275),
    transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px) scale(0.6);
}
</style>
