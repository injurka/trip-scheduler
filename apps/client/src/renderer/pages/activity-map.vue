<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useScrollLock } from '@vueuse/core'
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { useDialogHistory } from '~/components/01.kit/kit-dialog-with-close/composables/use-dialog-history'
import { ActivityMap } from '~/components/05.modules/activity-map'
import DayMemoriesPlayer from '~/components/05.modules/activity-map/ui/memories/day-memories-player.vue'
import { TrackingControlCard } from '~/components/05.modules/activity-tracking'
import { useTrackingStore } from '~/shared/store/tracking.store'

const route = useRoute()
const router = useRouter()
const trackingStore = useTrackingStore()

const isMemoriesOpen = ref(route.query.view === 'memories')
const isTrackingSheetOpen = ref(false)

// Блокировка фонового скролла пока открыт просмотрщик воспоминаний
const isScrollLocked = useScrollLock(typeof document !== 'undefined' ? document.body : null)

watch(isMemoriesOpen, (open) => {
  isScrollLocked.value = open
  if (!open && route.query.view === 'memories') {
    router.replace({
      query: {
        ...route.query,
        view: undefined,
        day: undefined,
      },
    })
  }
}, { immediate: true })

watch(() => route.query.view, (view) => {
  if (view === 'memories') {
    isMemoriesOpen.value = true
  }
  else if (isMemoriesOpen.value) {
    isMemoriesOpen.value = false
  }
})

// Поддержка закрытия по свайпу "назад" и кнопке Back без смены роута
useDialogHistory('activity-memories-player', isMemoriesOpen)

function handleCloseMemories() {
  isMemoriesOpen.value = false
}

function handleModeChange(mode: 'list' | 'map') {
  void mode
}
</script>

<template>
  <section
    class="content-wrapper is-map-mode"
  >
    <ActivityMap
      @mode-change="handleModeChange"
    />

    <!-- Drawer полноэкранного просмотра воспоминаний -->
    <Transition name="memories-drawer">
      <div
        v-if="isMemoriesOpen"
        class="memories-fullscreen-container"
      >
        <DayMemoriesPlayer
          class="memories-full"
          :day-utc="(route.query.day as string)"
          @close="handleCloseMemories"
          @back="handleCloseMemories"
        >
          <template #top-actions>
            <KitBtn
              variant="tonal"
              size="sm"
              class="tracking-hud-btn"
              :class="{ 'is-live': trackingStore.isRunning }"
              title="Управление трекингом"
              @click="isTrackingSheetOpen = true"
            >
              <template #prepend>
                <Icon icon="mdi:crosshairs-gps" class="hud-icon" />
              </template>
              <span v-if="trackingStore.isRunning" class="live-dot" />
              {{ trackingStore.isRunning ? 'GPS активен' : 'Трекинг' }}
            </KitBtn>
          </template>
        </DayMemoriesPlayer>
      </div>
    </Transition>

    <!-- Диалог управления трекингом -->
    <KitDialogWithClose
      v-model:visible="isTrackingSheetOpen"
      title="Управление трекингом"
      icon="mdi:crosshairs-gps"
      :max-width="500"
    >
      <TrackingControlCard />
    </KitDialogWithClose>
  </section>
</template>

<style scoped lang="scss">
.content-wrapper {
  position: relative;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  overflow: hidden;

  &.is-map-mode {
    max-width: 100%;
    padding: 0;
    margin: 0;
    flex: 1;
    height: 100%;
    max-height: 100%;
    overflow: hidden;
  }
}

.memories-fullscreen-container {
  position: absolute;
  inset: 0;
  z-index: 20;
  width: 100%;
  height: 100%;
  max-height: 100%;
  background-color: var(--bg-primary-color);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.memories-full {
  width: 100%;
  height: 100%;
}

.tracking-hud-btn {
  background-color: var(--bg-secondary-color);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-secondary-color);
  box-shadow: var(--s-m);
  border-radius: var(--r-full);
  transform: none !important;

  &:hover,
  &:active,
  &:focus {
    transform: none !important;
  }

  .hud-icon {
    font-size: 1.1rem;
  }

  &.is-live {
    border-color: var(--border-success-color);
    color: var(--fg-success-color);

    .live-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: var(--r-full);
      background-color: var(--fg-success-color);
      margin-right: 4px;
      animation: pulse 1.5s infinite;
    }
  }
}

.memories-drawer-enter-active,
.memories-drawer-leave-active {
  transition:
    transform 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.2s ease;
}

.memories-drawer-enter-from,
.memories-drawer-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
  100% {
    opacity: 1;
  }
}
</style>
