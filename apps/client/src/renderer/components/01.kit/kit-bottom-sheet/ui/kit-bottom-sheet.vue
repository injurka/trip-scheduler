<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref, useId } from 'vue'
import { useDialogHistory } from '~/components/01.kit/kit-dialog-with-close/composables/use-dialog-history'

interface Props {
  title?: string
  icon?: string
  modelValue: boolean
  closeOnBackdrop?: boolean
  maxHeight?: string
  maxWidth?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  icon: '',
  closeOnBackdrop: true,
  maxHeight: '85dvh',
  maxWidth: '600px',
})
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const dialogId = useId()

const startY = ref(0)
const dragY = ref(0)
const isDragging = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

// Keyboard-Aware: шторка не выше реально видимой области над клавиатурой
const sheetMaxHeight = computed(() => `min(${props.maxHeight}, calc(var(--visible-height, 100dvh) - 12px))`)

function close() {
  emit('update:modelValue', false)
}
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

useDialogHistory(dialogId, visible)
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
          maxHeight: sheetMaxHeight,
          maxWidth: props.maxWidth,
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

        <div v-if="props.title || props.icon || $slots.header" class="kit-bottom-sheet-header">
          <slot name="header">
            <div class="kit-bottom-sheet-title-wrap">
              <Icon v-if="props.icon" :icon="props.icon" class="kit-bottom-sheet-icon" />
              <span class="kit-bottom-sheet-title">{{ props.title }}</span>
            </div>
          </slot>
          <button class="kit-bottom-sheet-close" aria-label="Закрыть" @click="close">
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
  // Keyboard-Aware: нижний край — граница видимой области, а не физического экрана
  bottom: var(--keyboard-inset-height, 0px);
  left: 0;
  right: 0;
  margin: 0 auto;
  width: 100%;
  background: var(--bg-primary-color);
  border-radius: var(--r-l) var(--r-l) 0 0;
  border-top: 1px solid var(--border-primary-color);
  border-inline: 1px solid var(--border-primary-color);
  box-shadow: var(--shadow-xl);
  z-index: 2100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  padding-bottom: var(--safe-area-inset-bottom);

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

  &-title-wrap {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &-icon {
    font-size: 1.25rem;
    color: var(--color-primary-500, #f97316);
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
    min-height: 0;
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
