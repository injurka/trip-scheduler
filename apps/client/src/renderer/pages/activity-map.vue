<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ActivityMap } from '~/components/05.modules/activity-map'
import DayMemoriesPlayer from '~/components/05.modules/activity-map/ui/memories/day-memories-player.vue'
import TrackingToggle from '~/components/05.modules/activity-map/ui/memories/tracking-toggle.vue'
import { useTrackingStore } from '~/shared/store/tracking.store'

const route = useRoute()
const trackingStore = useTrackingStore()

const isMapMode = computed(() => route.query.view === 'map')
const isMemoriesMode = computed(() => route.query.view === 'memories')
const isTrackingSheetOpen = ref(false)

function handleModeChange(mode: 'list' | 'map') {
  // Синхронизация режима просмотра
  void mode
}
</script>

<template>
  <section
    class="content-wrapper"
    :class="{ 'is-map-mode': isMapMode || isMemoriesMode }"
  >
    <template v-if="isMemoriesMode">
      <div class="memories-fullscreen-container">
        <DayMemoriesPlayer
          class="memories-full"
          :day-utc="(route.query.day as string)"
        />

        <!-- Плавающий переключатель панели GPS-трекинга на карте -->
        <div class="floating-tracking-pill">
          <KitBtn
            variant="tonal"
            size="sm"
            class="tracking-hud-btn"
            :class="{ 'is-live': trackingStore.isRunning }"
            @click="isTrackingSheetOpen = !isTrackingSheetOpen"
          >
            <template #prepend>
              <Icon icon="mdi:crosshairs-gps" class="hud-icon" />
            </template>
            <span v-if="trackingStore.isRunning" class="live-dot" />
            {{ trackingStore.isRunning ? 'GPS активен' : 'Трекинг' }}
          </KitBtn>
        </div>

        <!-- Выдвижная карточка управления трекингом поверх карты -->
        <div
          v-if="isTrackingSheetOpen"
          class="tracking-sheet-backdrop"
          @click.self="isTrackingSheetOpen = false"
        >
          <div class="tracking-sheet-card">
            <div class="sheet-header">
              <span class="sheet-title">Управление трекингом</span>
              <button
                class="sheet-close-btn"
                aria-label="Закрыть панель"
                @click="isTrackingSheetOpen = false"
              >
                <Icon icon="mdi:close" />
              </button>
            </div>
            <TrackingToggle />
          </div>
        </div>
      </div>
    </template>
    <ActivityMap
      v-else
      @mode-change="handleModeChange"
    />
  </section>
</template>

<style scoped lang="scss">
.content-wrapper {
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding: 16px;
  max-width: 1400px;
  height: 100%;
  min-height: calc(100vh - 53px);

  &.is-map-mode {
    max-width: 100%;
    padding: 0;
    margin: 0;
    height: calc(100vh - 53px);
    overflow: hidden;
  }
}

.memories-fullscreen-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.memories-full {
  width: 100%;
  height: 100%;
}

.floating-tracking-pill {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 25;

  .tracking-hud-btn {
    background-color: var(--bg-secondary-color);
    backdrop-filter: blur(12px);
    border: 1px solid var(--border-secondary-color);
    box-shadow: var(--s-m);
    border-radius: var(--r-full);

    .hud-icon {
      font-size: 1.1rem;
    }

    &.is-live {
      border-color: var(--border-success-color);
      color: var(--fg-success-color);

      .live-dot {
        width: 6px;
        height: 6px;
        border-radius: var(--r-full);
        background-color: var(--fg-success-color);
        margin-right: 2px;
        animation: pulse 1.5s infinite;
      }
    }
  }
}

.tracking-sheet-backdrop {
  position: absolute;
  inset: 0;
  z-index: 30;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;

  .tracking-sheet-card {
    width: 100%;
    max-width: 520px;
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-l);
    padding: var(--p-m);
    box-shadow: var(--s-xl);
    display: flex;
    flex-direction: column;
    gap: 12px;

    .sheet-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .sheet-title {
        font-size: 1rem;
        font-weight: 600;
        color: var(--fg-primary-color);
      }

      .sheet-close-btn {
        background-color: var(--bg-tertiary-color);
        border: none;
        color: var(--fg-primary-color);
        width: 28px;
        height: 28px;
        border-radius: var(--r-full);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.2s;

        &:hover {
          background-color: var(--bg-hover-color);
        }
      }
    }
  }
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
