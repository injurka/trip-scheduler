<script setup lang="ts">
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { Memory } from '~/shared/types/models/memory'
import { Icon } from '@iconify/vue'
import { useEventListener, useScrollLock } from '@vueuse/core'
import { toRef, watch } from 'vue'
import DayTrackPlayer from './day-track-player.vue'

const props = withDefaults(defineProps<{
  open?: boolean
  dayUtc?: string
  mode?: 'track' | 'memories'
  /** Даты дней поездки (YYYY-MM-DD) — ограничивают навигацию по дням в плеере */
  dayDates?: string[]
  showTodayButton?: boolean
  memories?: Memory[]
  galleryImages?: ImageViewerImage[]
}>(), {
  open: false,
  mode: 'track',
  dayDates: () => [],
  showTodayButton: true,
  memories: () => [],
  galleryImages: () => [],
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:open', val: boolean): void
  (e: 'dayChange', day: string): void
}>()

const isBodyScrollLocked = useScrollLock(typeof document !== 'undefined' ? document.body : null)
const isHtmlScrollLocked = useScrollLock(typeof document !== 'undefined' ? document.documentElement : null)

watch(toRef(props, 'open'), (isOpen) => {
  isBodyScrollLocked.value = isOpen
  isHtmlScrollLocked.value = isOpen
}, { immediate: true })

function handleClose() {
  emit('close')
  emit('update:open', false)
}

useEventListener(typeof window !== 'undefined' ? window : null, 'keydown', (e: KeyboardEvent) => {
  if (props.open && e.key === 'Escape') {
    handleClose()
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="track-drawer">
      <div
        v-if="open"
        class="track-drawer-overlay tracking-drawer-overlay track-route-overlay"
        @click.self="handleClose"
        @touchmove.self.prevent
      >
        <div class="track-drawer-sheet tracking-drawer-sheet track-route-sheet">
          <button
            class="track-route-close"
            type="button"
            aria-label="Закрыть маршрут"
            title="Закрыть"
            @click="handleClose"
          >
            <Icon icon="mdi:close" />
          </button>
          <DayTrackPlayer
            class="track-player-embedded"
            :day-utc="dayUtc"
            :mode="mode"
            :day-dates="dayDates"
            :show-back-button="false"
            :show-today-button="showTodayButton"
            :memories="memories"
            :gallery-images="galleryImages"
            @close="handleClose"
            @back="handleClose"
            @day-change="emit('dayChange', $event)"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.track-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.track-drawer-sheet {
  position: relative;
  width: 100vw;
  max-width: 1400px;
  height: 88dvh;
  max-height: calc(100dvh - var(--safe-area-inset-top, 0px) - 56px);
  background-color: var(--bg-primary-color);
  border-radius: var(--r-xl, 20px) var(--r-xl, 20px) 0 0;
  border: 1px solid var(--border-secondary-color);
  border-bottom: none;
  box-shadow: var(--s-xl, 0 20px 40px rgba(0, 0, 0, 0.4));
  display: flex;
  flex-direction: column;

  .track-route-close {
    position: absolute;
    top: -46px;
    right: 12px;
    z-index: 20;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: var(--bg-primary-color);
    color: var(--fg-primary-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition:
      transform 0.2s ease,
      background-color 0.2s ease,
      color 0.2s ease;

    &:hover {
      background-color: var(--bg-hover-color);
      transform: scale(1.06);
    }

    &:active {
      transform: scale(0.95);
    }
  }

  .track-player-embedded {
    flex: 1;
    min-height: 0;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    overflow: hidden;
  }
}

.track-drawer-enter-active,
.track-drawer-leave-active {
  transition: opacity 0.25s ease;

  .track-drawer-sheet {
    transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
  }
}

.track-drawer-enter-from,
.track-drawer-leave-to {
  opacity: 0;

  .track-drawer-sheet {
    transform: translateY(100%);
  }
}
</style>
