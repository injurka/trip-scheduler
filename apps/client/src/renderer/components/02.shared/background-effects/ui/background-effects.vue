<script lang="ts" setup>
import { Icon, loadIcons } from '@iconify/vue'
import { onMounted } from 'vue'

const travelIcons = [
  'mdi:airplane',
  'mdi:map-marker-outline',
  'mdi:compass-outline',
  'mdi:wallet-travel',
  'mdi:camera-outline',
  'mdi:food-fork-drink',
  'mdi:bed',
  'mdi:car',
  'mdi:train',
  'mdi:beach',
  'mdi:ticket-confirmation-outline',
  'mdi:passport',
  'mdi:briefcase-outline',
  'mdi:earth',
  'mdi:sun-compass',
  'mdi:sunglasses',
  'mdi:ship-wheel',
  'mdi:flag-variant-outline',
]

function getRandomIcon() {
  return travelIcons[Math.floor(Math.random() * travelIcons.length)]
}

const symbols = Array.from({ length: 40 }, () => ({
  icon: getRandomIcon(),
  top: Math.random() * 100,
  left: Math.random() * 100,
  delay: Math.random() * 1,
  duration: 10 + Math.random() * 15,
  size: 1 + Math.random() * 0.8,
}))

onMounted(() => {
  loadIcons(travelIcons)
})
</script>

<template>
  <div class="background-effects">
    <div
      v-for="(symbol, index) in symbols"
      :key="index"
      class="symbol"
      :style="{
        top: `${symbol.top}%`,
        left: `${symbol.left}%`,
        animationDelay: `${symbol.delay}s`,
        animationDuration: `${symbol.duration}s`,
        fontSize: `${symbol.size}rem`,
      }"
    >
      <Icon :icon="symbol.icon" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.background-effects {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
  background: linear-gradient(to center, var(--bg-primary-color), var(--bg-tertiary-color));
  z-index: -1;

  .symbol {
    position: absolute;
    color: var(--fg-secondary-color);
    animation: floatEffect linear infinite;
    user-select: none;
    opacity: 0;
    will-change: transform, opacity;
  }
}

@keyframes floatEffect {
  0% {
    opacity: 0;
    transform: translateY(20px) rotate(0deg);
  }
  5%,
  95% {
    opacity: 0.2;
  }
  50% {
    opacity: 0.4;
    transform: translateY(-40px) rotate(180deg);
  }
  100% {
    opacity: 0;
    transform: translateY(-80px) rotate(360deg);
  }
}
</style>
