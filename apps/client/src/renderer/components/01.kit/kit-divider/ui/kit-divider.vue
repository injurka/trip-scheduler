<script lang="ts" setup>
interface Props {
  isLoading?: boolean
}

withDefaults(defineProps<Props>(), {
  isLoading: false,
})
</script>

<template>
  <div class="divider" :class="{ isLoading }">
    <slot />
  </div>
</template>

<style lang="scss" scoped>
.divider {
  position: relative;
  display: flex;
  align-items: center;
  text-align: center;
  color: var(--fg-secondary-color);
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 2px;
  font-weight: 500;
  width: 100%;

  &::before,
  &::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid var(--border-secondary-color);
  }

  &::before {
    margin-right: 0.5em;
  }

  &::after {
    margin-left: 0.5em;
  }

  &.isLoading {
    &::before,
    &::after {
      border-bottom: none;
      height: 1px;
      background-color: var(--border-secondary-color);
      background-image: linear-gradient(to right, var(--bg-accent-overlay-color), var(--bg-accent-overlay-color));
      background-repeat: no-repeat;
    }

    &::before {
      animation: wave-left 2.5s infinite ease-in-out;
    }

    &::after {
      animation: wave-right 2.5s infinite ease-in-out;
    }
  }
}

@keyframes wave-left {
  0% {
    background-size: 0% 100%;
    background-position: left;
  }
  50% {
    background-size: 100% 100%;
    background-position: left;
  }
  100% {
    background-size: 0% 100%;
    background-position: right;
  }
}

@keyframes wave-right {
  0% {
    background-size: 0% 100%;
    background-position: right;
  }
  50% {
    background-size: 100% 100%;
    background-position: right;
  }
  100% {
    background-size: 0% 100%;
    background-position: left;
  }
}
</style>
