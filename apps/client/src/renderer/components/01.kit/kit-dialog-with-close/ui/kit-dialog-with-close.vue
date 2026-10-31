<script lang="ts" setup>
import type { PointerDownOutsideEvent } from 'reka-ui'
import { Icon } from '@iconify/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, useId, watch } from 'vue'
import { useDialogHistory } from '../composables/use-dialog-history'

interface Props {
  maxWidth?: number
  title?: string
  icon?: string
  persistent?: boolean
  description?: string
  contentClass?: string | Record<string, boolean> | string[]
  fullscreenable?: boolean
  resetFullscreenOnClose?: boolean
}

const {
  maxWidth = 700,
  title,
  icon,
  persistent = false,
  description,
  contentClass,
  fullscreenable = false,
  resetFullscreenOnClose = true,
} = defineProps<Props>()
const emit = defineEmits<{
  (e: 'toggleFullscreen', isFullscreen: boolean): void
}>()
const visible = defineModel<boolean>('visible', { required: true })
const isFullscreen = defineModel<boolean>('fullscreen', { default: false })
const dialogId = useId()

const maxWidthPx = computed(() => `${maxWidth}px`)

watch(visible, (isOpen) => {
  if (!isOpen && resetFullscreenOnClose) {
    isFullscreen.value = false
  }
})

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  emit('toggleFullscreen', isFullscreen.value)
}
function handleHeaderDblClick(event: MouseEvent) {
  if (!fullscreenable)
    return

  const target = event.target as HTMLElement | null

  if (target?.closest('button, a, input, select, textarea, [role="button"]'))
    return

  toggleFullscreen()
}
function handlePointerDownOutside(event: PointerDownOutsideEvent) {
  if (persistent) {
    event.preventDefault()

    return
  }

  const originalEvent = event.detail.originalEvent
  const target = originalEvent.target as HTMLElement

  if (originalEvent.offsetX > target.clientWidth || originalEvent.offsetY > target.clientHeight) {
    event.preventDefault()
  }
}

useDialogHistory(dialogId, visible)
</script>

<template>
  <DialogRoot v-model:open="visible">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" />
      <DialogContent
        class="dialog-content-wrapper"
        :class="[contentClass, { 'is-fullscreen': isFullscreen }]"
        :style="{ maxWidth: isFullscreen ? 'none' : maxWidthPx }"
        @pointer-down-outside="handlePointerDownOutside"
      >
        <div class="dialog-header" @dblclick="handleHeaderDblClick">
          <slot v-if="$slots.header" name="header" />
          <template v-else>
            <div class="title-container">
              <Icon v-if="icon" :icon="icon" class="title-icon" />
              <DialogTitle class="dialog-title">
                {{ title }}
              </DialogTitle>
            </div>
          </template>
          <div class="dialog-actions" :class="{ 'has-header-actions': !!$slots['header-actions'] }">
            <div v-if="$slots['header-actions']" class="dialog-header-actions">
              <slot name="header-actions" />
            </div>
            <button
              v-if="fullscreenable"
              type="button"
              class="header-button fullscreen-button"
              :class="{ 'is-active': isFullscreen }"
              :aria-label="isFullscreen ? 'Свернуть из полноэкранного режима' : 'На весь экран'"
              :title="isFullscreen ? 'Свернуть из полноэкранного режима' : 'На весь экран'"
              @click="toggleFullscreen"
            >
              <Icon :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" />
            </button>
            <DialogClose as-child>
              <button class="header-button close-button" :aria-label="`Закрыть диалог ${title ?? ''}`">
                <Icon icon="mdi:close" />
              </button>
            </DialogClose>
          </div>
        </div>

        <DialogDescription :class="description ? 'dialog-description' : 'sr-only'">
          {{ description ?? title }}
        </DialogDescription>

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
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

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
  top: calc(50% + var(--safe-area-inset-top));
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  box-shadow: var(--s-m);
  z-index: 1001;
  width: 90vw;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 90vh;
  transition:
    max-width 0.2s ease,
    width 0.2s ease,
    height 0.2s ease,
    max-height 0.2s ease,
    border-radius 0.2s ease;

  &:focus {
    outline: none;
  }

  &[data-state='open'] {
    animation: content-warp-in 250ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  &[data-state='closed'] {
    animation: content-warp-out 200ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
  }

  &.is-fullscreen {
    animation: none !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    transform: none !important;
    width: 100vw !important;
    max-width: 100vw !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
    border-radius: 0 !important;
    border: none;
    box-shadow: none;
    padding: 16px 20px;
    padding-top: max(16px, var(--safe-area-inset-top, env(safe-area-inset-top, 0px)));
    padding-bottom: max(16px, var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
    padding-left: max(20px, var(--safe-area-inset-left, env(safe-area-inset-left, 0px)));
    padding-right: max(20px, var(--safe-area-inset-right, env(safe-area-inset-right, 0px)));

    .dialog-header {
      padding-bottom: 2px;
    }

    .dialog-body {
      flex: 1 1 0;
      min-height: 0;
      height: 100%;
    }
  }

  @include media-down(sm) {
    padding: 12px;
    padding-bottom: calc(12px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    transform: none;
    width: 100%;
    max-width: 100% !important;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    max-height: calc(92dvh - var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));

    &[data-state='open'] {
      animation: content-slide-up 300ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    &[data-state='closed'] {
      animation: content-slide-down 200ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
    }

    &.is-fullscreen {
      animation: none !important;
      max-height: 100dvh !important;
      height: 100dvh !important;
      border-top-left-radius: 0 !important;
      border-top-right-radius: 0 !important;
      padding-top: max(12px, var(--safe-area-inset-top, env(safe-area-inset-top, 0px)));
      padding-bottom: max(12px, var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
    }
  }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.dialog-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-shrink: 0;
}

.dialog-actions.has-header-actions {
  gap: 14px;
}

.dialog-header-actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  min-width: max-content;
  white-space: nowrap;
}

.dialog-actions.has-header-actions .header-button,
.dialog-actions.has-header-actions .close-button,
.dialog-actions.has-header-actions .fullscreen-button {
  position: static;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  padding: 0;
  line-height: 1;
}

.title-container {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: var(--fg-primary-color);
}

.title-icon {
  font-size: 1.25rem;
}

.dialog-title {
  font-size: 1.125rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dialog-description {
  font-size: 0.875rem;
  color: var(--fg-secondary-color);
  margin-top: -8px;
}

.header-button,
.close-button,
.fullscreen-button {
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--fg-secondary-color);
  border-radius: var(--r-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    background-color 0.2s,
    color 0.2s;
  font-size: 1.125rem;
  width: 30px;
  height: 30px;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }

  &.is-active {
    color: var(--color-primary-base);
    background-color: var(--bg-hover-color);
  }
}

.dialog-body {
  flex-grow: 1;
  overflow-y: auto;
  min-height: 0;
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

@keyframes content-slide-up {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes content-slide-down {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(100%);
  }
}
</style>
