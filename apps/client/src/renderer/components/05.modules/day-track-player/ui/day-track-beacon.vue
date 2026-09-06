<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  isActive: boolean
  activityColor: string
  activityIcon: string
  speedKmh: number | null
}>()
</script>

<template>
  <div class="playback-beacon" :class="{ 'is-active': isActive }">
    <div class="beacon-ripple" :style="{ borderColor: activityColor }" />
    <div class="beacon-core" :style="{ backgroundColor: activityColor }">
      <Icon :icon="activityIcon" class="beacon-icon" />
    </div>
    <div v-if="speedKmh !== null && speedKmh > 0.5" class="beacon-speed-pill">
      {{ speedKmh.toFixed(0) }} км/ч
    </div>
  </div>
</template>

<style scoped lang="scss">
.playback-beacon {
  position: relative;
  width: 32px;
  height: 32px;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 25;

  .beacon-ripple {
    position: absolute;
    inset: -6px;
    border-radius: var(--r-full);
    border: 2.5px solid var(--fg-accent-color);
    animation: beaconRipple 1.6s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
    pointer-events: none;
  }

  .beacon-core {
    width: 28px;
    height: 28px;
    border-radius: var(--r-full);
    background-color: var(--fg-accent-color);
    border: 2px solid #ffffff;
    box-shadow: var(--s-m);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    transition:
      background-color 0.2s ease,
      transform 0.2s ease;

    .beacon-icon {
      font-size: 16px;
    }
  }

  .beacon-speed-pill {
    position: absolute;
    bottom: -22px;
    left: 50%;
    transform: translateX(-50%);
    background-color: var(--bg-secondary-color);
    backdrop-filter: blur(8px);
    border: 1px solid var(--border-secondary-color);
    color: var(--fg-primary-color);
    font-size: 0.68rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: var(--r-full);
    white-space: nowrap;
    box-shadow: var(--s-s);
  }
}

@keyframes beaconRipple {
  0% {
    transform: scale(0.6);
    opacity: 0.95;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
}
</style>
