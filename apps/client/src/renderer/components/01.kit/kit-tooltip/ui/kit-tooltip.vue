<script setup lang="ts">
interface Props {
  name: string
}

defineProps<Props>()

const isHovered = ref(false)
const tooltipX = ref(0)
const tooltipY = ref(0)

function handleMouseEnter(event: MouseEvent) {
  isHovered.value = true
  tooltipX.value = event.clientX
  tooltipY.value = event.clientY
}

function handleMouseMove(event: MouseEvent) {
  if (!isHovered.value)
    return
  tooltipX.value = event.clientX
  tooltipY.value = event.clientY
}

function handleMouseLeave() {
  isHovered.value = false
}

const tooltipStyle = computed(() => {
  return {
    top: `${tooltipY.value}px`,
    left: `${tooltipX.value}px`,
  }
})
</script>

<template>
  <div
    class="kit-tooltip-wrapper"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @mousemove="handleMouseMove"
  >
    <slot />

    <Teleport to="body">
      <transition name="tooltip-fade">
        <div
          v-if="isHovered && name"
          :style="tooltipStyle"
          class="tooltip-container"
        >
          {{ name }}
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.kit-tooltip-wrapper {
  display: inline-flex;
}

.tooltip-container {
  position: fixed;
  z-index: 100;
  white-space: nowrap;
  border-radius: var(--r-m);
  background-color: var(--bg-tertiary-color);
  color: var(--fg-primary-color);
  padding: 6px 12px;
  font-size: 0.875rem;
  font-weight: 600;
  box-shadow: var(--s-l);
  pointer-events: none;
  line-height: 1.4;
  border: 1px solid var(--border-secondary-color);
  transform: translate(-50%, calc(-100% - 12px));
  will-change: top, left;
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.1s ease-in-out;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
}
</style>
