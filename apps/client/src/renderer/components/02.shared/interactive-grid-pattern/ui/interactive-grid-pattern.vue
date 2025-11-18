<script lang="ts" setup>
import type { HTMLAttributes } from 'vue'

interface InteractiveGridPatternProps {
  className?: HTMLAttributes['class']
  width?: number
  height?: number
  squares?: [number, number]
}

const props = withDefaults(defineProps<InteractiveGridPatternProps>(), {
  width: 40,
  height: 40,
  squares: () => [24, 24],
})

const horizontal = computed(() => props.squares[0])
const vertical = computed(() => props.squares[1])
const totalSquares = computed(() => horizontal.value * vertical.value)
const hoveredSquare = ref<number | null>(null)

const gridWidth = computed(() => props.width * horizontal.value)
const gridHeight = computed(() => props.height * vertical.value)

function getX(index: number) {
  return (index % horizontal.value) * props.width
}

function getY(index: number) {
  return Math.floor(index / horizontal.value) * props.height
}

function handleMouseEnter(index: number) {
  hoveredSquare.value = index
}

function handleMouseLeave() {
  hoveredSquare.value = null
}
</script>

<template>
  <svg
    :width="gridWidth"
    :height="gridHeight"
    class="interactive-grid-svg" :class="[className]"
    @mouseleave="handleMouseLeave"
  >
    <defs>
      <linearGradient id="hover-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="var(--bg-hover-color)" />
        <stop offset="100%" stop-color="var(--bg-accent-color)" />
      </linearGradient>
    </defs>

    <rect
      v-for="(_, index) in totalSquares"
      :key="index"
      :x="getX(index)"
      :y="getY(index)"
      :width="width"
      :height="height"
      class="grid-square" :class="[{ 'is-hovered': hoveredSquare === index }]"
      @mouseenter="handleMouseEnter(index)"
    />
  </svg>
</template>

<style scoped lang="scss">
.interactive-grid-svg {
  position: absolute;
  inset: 0;
  height: 100%;
  width: 100%;
}

.grid-square {
  stroke: var(--bg-hover-color);
  fill: transparent;
  transition: fill 0.1s ease-in-out;

  &.is-hovered {
    fill: url(#hover-gradient);
  }
}

.interactive-grid-svg:not(:hover) .grid-square {
  transition: fill 1s ease-in-out;
}
</style>
