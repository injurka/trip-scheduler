<script lang="ts" setup>
function getRandomChar() {
  const rangeStart = 0x4E00
  const rangeEnd = 0x62FF

  return String.fromCodePoint(
    Math.floor(Math.random() * (rangeEnd - rangeStart) + rangeStart),
  )
}

const symbols = Array.from({ length: 40 }, () => ({
  char: getRandomChar(),
  top: Math.random() * 100,
  left: Math.random() * 100,
  delay: Math.random() * 5,
  duration: 5 + Math.random() * 15,
  size: 1 + Math.random() * 0.4,
}))
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
      {{ symbol.char }}
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
    color: var(--fg-seconday-color);
    animation: floatEffect linear infinite;
    user-select: none;
    font-family: 'Arial', sans-serif;
    opacity: 0;
  }
}

@keyframes floatEffect {
  0% {
    opacity: 0;
    transform: translateY(0) rotate(0deg);
  }
  20% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.5;
    transform: translateY(-40px) rotate(180deg);
  }
  80% {
    opacity: 0.3;
  }
  100% {
    opacity: 0;
    transform: translateY(-80px) rotate(360deg);
  }
}
</style>
