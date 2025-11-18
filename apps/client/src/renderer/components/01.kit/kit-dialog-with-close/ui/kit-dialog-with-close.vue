<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'

interface Props {
  maxWidth?: number
  title?: string
  icon?: string
}

const { maxWidth = 700, title, icon } = defineProps<Props>()

const visible = defineModel<boolean>('visible', { required: true })

const maxWidthPx = computed(() => `${maxWidth}px`)
</script>

<template>
  <DialogRoot v-model:open="visible">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" />
      <DialogContent
        class="dialog-content-wrapper"
        :style="{ maxWidth: maxWidthPx }"
        @pointer-down-outside="(event) => {
          const originalEvent = event.detail.originalEvent
          const target = originalEvent.target as HTMLElement
          if (originalEvent.offsetX > target.clientWidth || originalEvent.offsetY > target.clientHeight)
            event.preventDefault()
        }"
      >
        <div class="dialog-header">
          <slot v-if="$slots.header" name="header" />
          <template v-else>
            <div class="title-container">
              <Icon v-if="icon" :icon="icon" class="title-icon" />
              <DialogTitle class="dialog-title">
                {{ title }}
              </DialogTitle>
            </div>
          </template>
          <DialogClose as-child>
            <button class="close-button">
              <Icon icon="mdi:close" />
            </button>
          </DialogClose>
        </div>
        <div class="dialog-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="dialog-footer">
          <slot name="footer" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style lang="scss" scoped>
.dialog-overlay {
  background-color: rgba(0, 0, 0, 0.4);
  position: fixed;
  inset: 0;
  z-index: 1000;

  &[data-state='open'] {
    animation: overlay-show 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  &[data-state='closed'] {
    animation: overlay-hide 200ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
  }
}

.dialog-content-wrapper {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 8px;
  box-shadow: var(--s-m);
  z-index: 1001;
  width: 90vw;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 90vh;

  &:focus {
    outline: none;
  }

  &[data-state='open'] {
    animation: content-warp-in 250ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  &[data-state='closed'] {
    animation: content-warp-out 200ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
  }

  @include media-down(sm) {
    padding: 12px;
  }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.title-container {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--fg-primary-color);
}

.title-icon {
  font-size: 1.25rem;
}

.dialog-title {
  font-size: 1.125rem;
  font-weight: 600;
}

.close-button {
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

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }
}

.dialog-body {
  flex-grow: 1;
  overflow-y: auto;
}

.dialog-footer {
  flex-shrink: 0;
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid var(--border-secondary-color);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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

@keyframes content-warp-in {
  from {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.9) rotateX(10deg) skewX(3deg);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotateX(0) skewX(0);
    filter: blur(0);
  }
}
@keyframes content-warp-out {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotateX(0) skewX(0);
    filter: blur(0);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.85) rotateX(10deg) skewX(4deg);
    filter: blur(8px);
  }
}
</style>
