<script setup lang="ts">
const props = withDefaults(defineProps<{
  name: string
  offset?: number
}>(), {
  offset: 8, // Расстояние от аватара в пикселях
})

const isHovered = ref(false)
const mouseX = ref<number>(0)

const rotation = computed<number>(() => (mouseX.value / 100) * 20)
const translation = computed<number>(() => (mouseX.value / 100) * -10)

function handleMouseEnter(event: MouseEvent) {
  isHovered.value = true
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  mouseX.value = event.clientX - rect.left - rect.width / 2
}

function handleMouseMove(event: MouseEvent) {
  if (!isHovered.value)
    return

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  mouseX.value = event.clientX - rect.left - rect.width / 2
}

function handleMouseLeave() {
  isHovered.value = false
}

const tooltipStyle = computed(() => {
  return {
    bottom: `calc(100% + ${props.offset}px)`,
    transform: `translateX(-50%) translateX(${translation.value}px) rotate(${rotation.value}deg)`,
  }
})
</script>

<template>
  <div
    class="kit-animated-tooltip"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @mousemove="handleMouseMove"
  >
    <!-- Анимированная подсказка -->
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
