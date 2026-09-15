<script lang="ts" setup>
import { Comment, computed, useSlots } from 'vue'

interface Props {
  isLoading?: boolean
}

withDefaults(defineProps<Props>(), {
  isLoading: false,
})

const slots = useSlots()

const hasContent = computed(() => {
  if (!slots.default)
    return false
  const nodes = slots.default()
  return nodes.some((node) => {
    if (node.type === Comment)
      return false
    if (typeof node.children === 'string' && !node.children.trim())
      return false
    if (Array.isArray(node.children) && node.children.length === 0)
      return false
    return true
  })
})
</script>

<template>
  <div class="divider" :class="{ isLoading, 'has-content': hasContent }">
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

  &::before {
    content: '';
    flex: 1;
    border-bottom: 1px solid var(--border-secondary-color);
  }

  &.has-content {
    &::before {
      margin-right: 0.5em;
    }

    &::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid var(--border-secondary-color);
      margin-left: 0.5em;
    }
  }

  &.isLoading {
    &::before {
      border-bottom: none;
      height: 1px;
      background-color: var(--border-secondary-color);
      background-image: linear-gradient(to right, var(--bg-accent-overlay-color), var(--bg-accent-overlay-color));
      background-repeat: no-repeat;
      animation: wave-left 2.5s infinite ease-in-out;
    }

    &.has-content::after {
      border-bottom: none;
      height: 1px;
      background-color: var(--border-secondary-color);
      background-image: linear-gradient(to right, var(--bg-accent-overlay-color), var(--bg-accent-overlay-color));
      background-repeat: no-repeat;
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
