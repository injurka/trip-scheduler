<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface Props {
  text?: string
}

withDefaults(defineProps<Props>(), {
  text: 'Раздел в разработке',
})
</script>

<template>
  <div class="kit-wip-badge">
    <div class="wip-content">
      <div class="icon-wrapper">
        <Icon icon="mdi:hammer-wrench" class="wip-icon" />
      </div>
      <span class="wip-text">{{ text }}</span>
    </div>
    <div class="wip-bg-glow" />
  </div>
</template>

<style scoped lang="scss">
.kit-wip-badge {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  background-color: var(--bg-warning-color);
  border: 1px solid var(--border-warning-color);
  border-radius: var(--r-m);
  overflow: hidden;
  margin-bottom: 16px;
  box-shadow: var(--s-s);
  width: 100%;
  margin-top: 16px;
}

.wip-content {
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 2;
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background-color: rgba(var(--bg-primary-color-rgb), 0.3);
  border-radius: 50%;
  color: var(--fg-warning-color);
}

.wip-icon {
  font-size: 1.2rem;
  animation: wrench-wiggle 2s ease-in-out infinite;
}

.wip-text {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg-warning-color);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  font-family: 'Sansation', sans-serif;
}

.wip-bg-glow {
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transform: skewX(-25deg);
  animation: shine 3s infinite;
  z-index: 1;
}

@keyframes wrench-wiggle {
  0%,
  100% {
    transform: rotate(0deg);
  }
  20% {
    transform: rotate(-15deg);
  }
  40% {
    transform: rotate(10deg);
  }
  60% {
    transform: rotate(-5deg);
  }
}

@keyframes shine {
  100% {
    left: 200%;
  }
}
</style>
