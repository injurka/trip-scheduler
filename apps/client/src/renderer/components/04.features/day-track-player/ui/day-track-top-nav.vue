<script setup lang="ts">
import type { ViewMode } from '../models/types'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'

withDefaults(defineProps<{
  selectedDay: string
  todayUtc: string
  headerDayTitle: string
  viewMode: ViewMode
  totalPointsCount: number
  displayPointsCount: number
  isFitDisabled: boolean
  showTodayButton?: boolean
}>(), {
  showTodayButton: true,
})

const emit = defineEmits<{
  (e: 'changeDay', offset: number): void
  (e: 'goToToday'): void
  (e: 'update:viewMode', mode: ViewMode): void
  (e: 'fitBounds'): void
  (e: 'close'): void
}>()
</script>

<template>
  <!-- Верхняя плавающая панель навигации по дням -->
  <div class="top-nav-bar">
    <div class="day-picker-group">
      <button
        class="day-arrow-btn"
        aria-label="Предыдущий день"
        @click="emit('changeDay', -1)"
      >
        <Icon icon="mdi:chevron-left" />
      </button>

      <div class="day-current">
        <Icon icon="mdi:calendar-month-outline" class="cal-icon" />
        <span class="day-text">{{ headerDayTitle }}</span>
        <span v-if="selectedDay === todayUtc" class="today-chip">Сегодня</span>
      </div>

      <button
        class="day-arrow-btn"
        aria-label="Следующий день"
        :disabled="selectedDay >= todayUtc"
        @click="emit('changeDay', 1)"
      >
        <Icon icon="mdi:chevron-right" />
      </button>
    </div>

    <div class="top-actions">
      <!-- Переключатель режима: Маршрут / Точки Безье -->
      <div class="view-mode-tabs">
        <button
          class="mode-tab-btn"
          :class="{ 'is-active': viewMode === 'route' }"
          title="Отображать сегменты маршрута с классификацией"
          @click="emit('update:viewMode', 'route')"
        >
          <Icon icon="mdi:map-marker-path" class="tab-icon" />
          <span class="tab-label">Маршрут</span>
        </button>
        <button
          class="mode-tab-btn"
          :class="{ 'is-active': viewMode === 'points' }"
          :title="totalPointsCount !== displayPointsCount ? `Отображается ${displayPointsCount} точек на карте (из ${totalPointsCount} исходных)` : 'Отображать все точки активности, соединенные кривой Безье'"
          @click="emit('update:viewMode', 'points')"
        >
          <Icon icon="mdi:vector-bezier" class="tab-icon" />
          <span class="tab-label">Точки (Безье)</span>
          <span v-if="displayPointsCount > 0" class="points-pill">{{ displayPointsCount }}</span>
        </button>
      </div>

      <KitBtn
        v-if="showTodayButton && selectedDay !== todayUtc"
        variant="subtle"
        size="xs"
        @click="emit('goToToday')"
      >
        Сегодня
      </KitBtn>

      <KitBtn
        variant="tonal"
        size="sm"
        icon="mdi:crosshairs-gps" title="Центрировать трек на карте"
        aria-label="Центрировать трек на карте"
        :disabled="isFitDisabled"
        @click="emit('fitBounds')"
      />

      <slot name="top-actions" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.top-nav-bar {
  position: absolute;
  top: 14px;
  left: 14px;
  right: 14px;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  pointer-events: none;

  > * {
    pointer-events: auto;
  }

  .day-picker-group {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: var(--bg-secondary-color);
    backdrop-filter: blur(12px);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-full);
    padding: 4px;
    box-shadow: var(--s-m);
    height: 38px;

    .day-arrow-btn {
      width: 28px;
      height: 28px;
      border-radius: var(--r-full);
      border: none;
      background: var(--bg-tertiary-color);
      color: var(--fg-primary-color);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.2s;

      &:hover:not(:disabled) {
        background: var(--bg-hover-color);
      }

      &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
    }

    .day-current {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 6px;

      .cal-icon {
        font-size: 1.1rem;
        color: var(--fg-accent-color);
      }

      .day-text {
        font-size: 0.88rem;
        font-weight: 600;
        color: var(--fg-primary-color);
        text-transform: capitalize;
      }

      .today-chip {
        padding: 1px 6px;
        border-radius: var(--r-full);
        font-size: 0.68rem;
        font-weight: 600;
        background: var(--bg-success-color);
        color: var(--fg-success-color);
      }
    }
  }

  .top-actions {
    display: flex;
    align-items: center;
    gap: 8px;

    .view-mode-tabs {
      display: inline-flex;
      align-items: center;
      background-color: var(--bg-secondary-color);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-secondary-color);
      border-radius: var(--r-full);
      padding: 3px;
      box-shadow: var(--s-m);
      height: 38px;

      .mode-tab-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: var(--r-full);
        border: none;
        background: transparent;
        color: var(--fg-secondary-color);
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        height: 100%;

        .tab-icon {
          font-size: 1rem;
        }

        .points-pill {
          padding: 0 5px;
          border-radius: 10px;
          background: rgba(59, 130, 246, 0.25);
          color: #60a5fa;
          font-size: 0.68rem;
          font-weight: 700;
        }

        &:hover:not(.is-active) {
          color: var(--fg-primary-color);
          background: var(--bg-hover-color);
        }

        &.is-active {
          background: var(--fg-accent-color);
          color: var(--fg-inverted-color);
          box-shadow: var(--s-xs);

          .points-pill {
            background: rgba(var(--fg-inverted-color-rgb, 255, 255, 255), 0.25);
            color: var(--fg-inverted-color);
          }
        }
      }
    }
  }
}

@media (max-width: 640px) {
  .top-nav-bar {
    top: 8px;
    left: 8px;
    right: 8px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;

    .day-picker-group {
      width: 100%;
      justify-content: space-between;
      height: 36px;
      padding: 3px 6px;

      .day-current {
        flex: 1;
        justify-content: center;
        min-width: 0;
        gap: 5px;

        .day-text {
          font-size: 0.82rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .today-chip {
          display: none;
        }
      }
    }

    .top-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 6px;

      .view-mode-tabs {
        flex: 1;
        height: 36px;
        min-width: 0;

        .mode-tab-btn {
          flex: 1;
          justify-content: center;
          padding: 4px 6px;

          .tab-label {
            display: inline;
            font-size: 0.74rem;
          }

          .points-pill {
            display: none;
          }
        }
      }
    }
  }
}
</style>
