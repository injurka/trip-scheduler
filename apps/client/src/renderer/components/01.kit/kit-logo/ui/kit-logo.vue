<script setup lang="ts">
import { computed, useId } from 'vue'

interface Props {
  text?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const props = withDefaults(defineProps<Props>(), {
  text: 'TripScheduler',
  size: 'md',
})

const generatedId = useId()
const symbolId = computed(() => `kit-logo-symbol-${generatedId.replace(/:/g, '')}`)

const viewBox = computed(() => {
  const len = props.text.length
  const width = Math.max(900, len * 82)

  return `0 0 ${width} 180`
})
</script>

<template>
  <div class="kit-logo-wrapper" :class="`kit-logo--${props.size}`">
    <svg
      :viewBox="viewBox"
      class="kit-logo-svg"
      role="img"
      :aria-label="props.text"
    >
      <defs>
        <symbol :id="symbolId">
          <text
            text-anchor="middle"
            x="50%"
            y="75%"
            class="logo-text-inner"
          >
            {{ props.text }}
          </text>
          <text
            text-anchor="middle"
            x="50.3%"
            y="75%"
            class="logo-text-inner"
          >
            {{ props.text }}
          </text>
        </symbol>
      </defs>

      <g class="g-ants">
        <use :href="`#${symbolId}`" class="text-copy text-copy-1" />
        <use :href="`#${symbolId}`" class="text-copy text-copy-2" />
        <use :href="`#${symbolId}`" class="text-copy text-copy-3" />
        <use :href="`#${symbolId}`" class="text-copy text-copy-4" />
        <use :href="`#${symbolId}`" class="text-copy text-copy-5" />
      </g>
    </svg>
  </div>
</template>

<style lang="scss" scoped>
.kit-logo-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  user-select: none;
  filter: drop-shadow(0 4px 16px rgba(255, 136, 86, 0.18));

  &.kit-logo--sm {
    max-width: 340px;
  }

  &.kit-logo--md {
    max-width: 520px;
  }

  &.kit-logo--lg {
    max-width: 720px;
  }

  &.kit-logo--xl {
    max-width: 860px;
  }
}

.kit-logo-svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.logo-text-inner {
  font-family: 'Onest', Montserrat, sans-serif;
  font-size: 7.8em;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.text-copy {
  fill: none;
  stroke: var(--fg-accent-color);
  stroke-dasharray: 6% 29%;
  stroke-width: 4.5px;
  stroke-dashoffset: 0%;
  stroke-linecap: round;
  stroke-linejoin: round;
  animation: stroke-offset 6s infinite linear;
}

.text-copy-1 {
  stroke: var(--fg-accent-color);
  animation-delay: -1.2s;
}

.text-copy-2 {
  stroke: var(--border-accent-color);
  animation-delay: -2.4s;
}

.text-copy-3 {
  stroke: var(--fg-action-color);
  animation-delay: -3.6s;
}

.text-copy-4 {
  stroke: var(--fg-highlight-color);
  animation-delay: -4.8s;
}

.text-copy-5 {
  stroke: var(--fg-primary-color);
  animation-delay: -6s;
}

// Dark theme colors
:root[data-theme='dark'] .kit-logo-wrapper,
[data-theme='dark'] .kit-logo-wrapper {
  .text-copy-1 {
    stroke: #ff8856;
  }
  .text-copy-2 {
    stroke: #fca36e;
  }
  .text-copy-3 {
    stroke: #ffaa80;
  }
  .text-copy-4 {
    stroke: #dab180;
  }
  .text-copy-5 {
    stroke: #ffe0b2;
  }
}

// Light theme colors
:root[data-theme='light'] .kit-logo-wrapper,
[data-theme='light'] .kit-logo-wrapper {
  .text-copy-1 {
    stroke: #e16032;
  }
  .text-copy-2 {
    stroke: #f37a51;
  }
  .text-copy-3 {
    stroke: #fb923c;
  }
  .text-copy-4 {
    stroke: #ea580c;
  }
  .text-copy-5 {
    stroke: #c2410c;
  }
}

@keyframes stroke-offset {
  100% {
    stroke-dashoffset: -35%;
  }
}
</style>
