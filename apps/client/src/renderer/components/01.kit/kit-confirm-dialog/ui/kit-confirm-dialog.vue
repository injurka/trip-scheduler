<script setup lang="ts">
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'

interface Props {
  open: boolean
  title: string
  description: string
  confirmText?: string
  type?: 'default' | 'danger'
}

const props = withDefaults(defineProps<Props>(), {
  type: 'default',
})

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <AlertDialogRoot :open="props.open">
    <AlertDialogPortal>
      <AlertDialogOverlay class="dialog-overlay" />
      <AlertDialogContent class="dialog-content-wrapper">
        <AlertDialogTitle class="dialog-title">
          {{ props.title }}
        </AlertDialogTitle>
        <AlertDialogDescription class="dialog-description">
          {{ props.description }}
        </AlertDialogDescription>
        <div class="dialog-actions">
          <AlertDialogCancel
            class="dialog-button cancel"
            @click="emit('cancel')"
          >
            Отмена
          </AlertDialogCancel>
          <AlertDialogAction
            class="dialog-button confirm"
            :class="{ danger: props.type === 'danger' }"
            @click="emit('confirm')"
          >
            {{ props.confirmText }}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style lang="scss">
.dialog-overlay {
  background-color: rgba(var(--bg-header-color), 0.5);
  backdrop-filter: blur(4px);
  position: fixed;
  inset: 0;
  z-index: 2000;

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
  border-radius: var(--r-l);
  box-shadow: var(--s-xl);
  z-index: 2001;
  width: 90vw;
  max-width: 450px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  &:focus {
    outline: none;
  }

  &[data-state='open'] {
    animation: content-show 250ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  &[data-state='closed'] {
    animation: content-hide 200ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
  }
}

.dialog-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--fg-primary-color);
}

.dialog-description {
  font-size: 1rem;
  color: var(--fg-secondary-color);
  line-height: 1.6;
  margin: 4px 0;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.dialog-button {
  all: unset;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-s);
  padding: 10px 16px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-sizing: border-box;

  &.cancel {
    background-color: var(--bg-secondary-color);
    color: var(--fg-secondary-color);
    border: 1px solid var(--border-secondary-color);

    &:hover {
      background-color: var(--bg-hover-color);
      border-color: var(--border-primary-color);
    }
  }

  &.confirm {
    background-color: var(--bg-accent-color);
    color: var(--fg-on-accent-color);
    border: 1px solid transparent;

    &:hover {
      filter: brightness(0.95);
    }

    &.danger {
      background-color: var(--bg-error-color);
      color: var(--fg-error-color);
      border: 1px solid var(--border-error-color);
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

@keyframes content-show {
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

@keyframes content-hide {
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
