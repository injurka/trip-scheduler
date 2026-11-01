<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { BackgroundEffects } from '~/components/02.shared/background-effects'
import { InteractiveGridPattern } from '~/components/02.shared/interactive-grid-pattern'
import OnboardingView from './onboarding-view.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('onboarding-open')
  }
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('keydown', handleKeyDown)
    document.body.classList.remove('onboarding-open')
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      class="onboarding-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Онбординг TripScheduler"
    >
      <div class="modal-backdrop-decorations">
        <InteractiveGridPattern
          :squares="[30, 30]"
          :width="40"
          :height="40"
          class="grid-pattern-bg"
        />
        <BackgroundEffects />
      </div>

      <div class="onboarding-scroll-viewport">
        <OnboardingView :is-modal="true" @close="emit('close')" />
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.onboarding-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  background-color: rgba(var(--bg-primary-color-rgb), 0.94);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  overflow: hidden;
  animation: fadeInModal 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.modal-backdrop-decorations {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

.grid-pattern-bg {
  opacity: 0.25;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  mask-image: radial-gradient(circle 800px at 50% 20%, white, transparent);
  -webkit-mask-image: radial-gradient(circle 800px at 50% 20%, white, transparent);
}

.onboarding-scroll-viewport {
  position: relative;
  z-index: 2;
  flex: 1;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;

  /* Кастомный красивый скроллбар */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: var(--border-primary-color);
    border-radius: 9999px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: var(--fg-accent-color);
  }
}

@keyframes fadeInModal {
  from {
    opacity: 0;
    transform: scale(0.985);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>

<style lang="scss">
body.onboarding-open {
  overflow: hidden !important;
}
</style>
