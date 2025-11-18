<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
} from 'reka-ui'

interface Props {
  side?: 'left' | 'right' | 'top' | 'bottom'
  class?: string
  width?: string
}

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<Props>(), {
  side: 'left',
  width: '340px',
})
const visible = defineModel<boolean>('open', { required: true })
</script>

<template>
  <DialogRoot v-model:open="visible">
    <DialogPortal>
      <DialogOverlay class="drawer-overlay" />
      <DialogContent
        class="drawer-content-wrapper"
        :class="[`drawer--${side}`, props.class]"
        :style="{ width: props.width }"
        @pointer-down-outside="(event) => {
          const originalEvent = event.detail.originalEvent
          const target = originalEvent.target as HTMLElement
          if (originalEvent.offsetX > target.clientWidth || originalEvent.offsetY > target.clientHeight)
            event.preventDefault()
        }"
      >
        <slot />
        <DialogClose as-child>
          <button class="close-button" aria-label="Закрыть">
            <Icon icon="mdi:close" />
          </button>
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style lang="scss">
.drawer-overlay {
  background-color: rgba(0, 0, 0, 0.4);
  position: fixed;
  inset: 0;
  z-index: 1000;

  &[data-state='open'] {
    animation: overlay-show 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  &[data-state='closed'] {
    animation: overlay-hide 300ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
  }

  @include media-down(sm) {
    display: none;
  }
}

.drawer-content-wrapper {
  position: fixed;
  background-color: var(--bg-primary-color);
  z-index: 1001;
  box-shadow: var(--s-xl);
  display: flex;
  flex-direction: column;

  &:focus {
    outline: none;
  }

  &.drawer--left {
    top: 0;
    bottom: 0;
    left: 0;
    max-width: 80vw;
    border-right: 1px solid var(--border-secondary-color);
    &[data-state='open'] {
      animation: slide-in-from-left 300ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    &[data-state='closed'] {
      animation: slide-out-to-left 250ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
    }
  }

  &.drawer--right {
    top: 0;
    bottom: 0;
    right: 0;
    max-width: 80vw;
    border-left: 1px solid var(--border-secondary-color);
    &[data-state='open'] {
      animation: slide-in-from-right 300ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    &[data-state='closed'] {
      animation: slide-out-to-right 250ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
    }
  }

  &.drawer--top {
    top: 0;
    left: 0;
    right: 0;
    height: auto;
    max-height: 80vh;
    border-bottom: 1px solid var(--border-secondary-color);
    &[data-state='open'] {
      animation: slide-in-from-top 300ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    &[data-state='closed'] {
      animation: slide-out-to-top 250ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
    }
  }

  &.drawer--bottom {
    bottom: 0;
    left: 0;
    right: 0;
    height: auto;
    max-height: 80vh;
    border-top: 1px solid var(--border-secondary-color);
    &[data-state='open'] {
      animation: slide-in-from-bottom 300ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    &[data-state='closed'] {
      animation: slide-out-to-bottom 250ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
    }
  }
}

.close-button {
  position: absolute;
  top: 16px;
  right: 16px;
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--fg-secondary-color);
  border-radius: var(--r-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  font-size: 1.2rem;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }
}

@include media-down(sm) {
  .drawer-content-wrapper {
    &.drawer--left,
    &.drawer--right {
      width: 100%;
      max-width: 100%;
    }
  }
}

@keyframes overlay-show {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes overlay-hide {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes slide-in-from-left {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}
@keyframes slide-out-to-left {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-100%);
  }
}

@keyframes slide-in-from-right {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
@keyframes slide-out-to-right {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(100%);
  }
}

@keyframes slide-in-from-top {
  from {
    transform: translateY(-100%);
  }
  to {
    transform: translateY(0);
  }
}
@keyframes slide-out-to-top {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-100%);
  }
}

@keyframes slide-in-from-bottom {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
@keyframes slide-out-to-bottom {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(100%);
  }
}
</style>
