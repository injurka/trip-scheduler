<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface Props {
  title?: string
  modelValue: boolean
  closeOnBackdrop?: boolean
  maxHeight?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  closeOnBackdrop: true,
  maxHeight: '85dvh',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function close() {
  emit('update:modelValue', false)
}

const startY = ref(0)
const dragY = ref(0)
const isDragging = ref(false)

function onTouchStart(e: TouchEvent) {
  startY.value = e.touches[0].clientY
  isDragging.value = true
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value)
    return

  e.preventDefault()
  const delta = e.touches[0].clientY - startY.value
  dragY.value = Math.max(0, delta)
}

function onTouchEnd() {
  if (dragY.value > 120) {
    close()
  }
  dragY.value = 0
  isDragging.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="kit-backdrop-fade">
      <div
        v-if="modelValue"
        class="kit-bottom-sheet-backdrop"
        @click="closeOnBackdrop && close()"
      />
    </Transition>

    <Transition name="kit-sheet-slide">
      <div
        v-if="modelValue"
        class="kit-bottom-sheet"
        :style="{
          maxHeight: props.maxHeight,
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : undefined,
        }"
        role="dialog"
        aria-modal="true"
        :aria-label="props.title || 'Bottom sheet'"
      >
        <div
          class="kit-bottom-sheet-handle-wrap"
          @touchstart.passive="onTouchStart"
          @touchmove="onTouchMove"
          @touchend.passive="onTouchEnd"
        >
          <div class="kit-bottom-sheet-handle" />
        </div>

        <div v-if="props.title || $slots.header" class="kit-bottom-sheet-header">
          <slot name="header">
            <span class="kit-bottom-sheet-title">{{ props.title }}</span>
          </slot>
          <button class="kit-bottom-sheet-close" @click="close">
            <Icon icon="mdi:close" />
          </button>
        </div>

        <div class="kit-bottom-sheet-body">
          <slot />
        </div>

        <div v-if="$slots.footer" class="kit-bottom-sheet-footer">
          <slot name="footer" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.kit-bottom-sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 2090;
}

.kit-bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-primary-color);
  border-radius: var(--r-l) var(--r-l) 0 0;
  border-top: 1px solid var(--border-primary-color);
  z-index: 2100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  padding-bottom: env(safe-area-inset-bottom, 0);

  &-handle-wrap {
    display: flex;
    justify-content: center;
    padding: 12px 0 8px;
    cursor: grab;
    flex-shrink: 0;

    &:active {
      cursor: grabbing;
    }
  }

  &-handle {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--border-primary-color);
  }

  &-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 16px 14px;
    border-bottom: 1px solid var(--border-secondary-color);
    flex-shrink: 0;
  }

  &-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }

  &-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--r-xs);
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--fg-secondary-color);
    font-size: 1.25rem;
    transition:
      background-color 0.2s ease,
      color 0.2s ease;

    &:hover {
      background-color: var(--bg-hover-color);
      color: var(--fg-primary-color);
    }
  }

  &-body {
    overflow-y: auto;
    overscroll-behavior: contain;
    flex: 1;
  }

  &-footer {
    padding: 12px 16px;
    border-top: 1px solid var(--border-secondary-color);
    flex-shrink: 0;
  }
}

// Transitions
.kit-backdrop-fade-enter-active,
.kit-backdrop-fade-leave-active {
  transition: opacity 0.3s ease;
}
.kit-backdrop-fade-enter-from,
.kit-backdrop-fade-leave-to {
  opacity: 0;
}

.kit-sheet-slide-enter-active,
.kit-sheet-slide-leave-active {
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
.kit-sheet-slide-enter-from,
.kit-sheet-slide-leave-to {
  transform: translateY(100%);
}
</style>
