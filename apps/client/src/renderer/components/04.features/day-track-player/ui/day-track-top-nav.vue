<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import type { ViewMode } from '../models/types'
import { Icon } from '@iconify/vue'
import { parseDate } from '@internationalized/date'
import { computed } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { CalendarPopover } from '~/components/02.shared/calendar-popover'

const props = withDefaults(defineProps<{
  selectedDay: string
  todayUtc: string
  headerDayTitle: string
  viewMode: ViewMode
  totalPointsCount: number
  displayPointsCount: number
  /** Есть ли у дня GPS-трек: без него переключатели «Маршрут / Исходные точки» бессмысленны */
  hasTrack?: boolean
  /** Даты дней поездки: навигация и календарь ограничиваются ими, если список задан */
  days?: string[]
  showTodayButton?: boolean
  totalPhotosCount?: number
  locatedPhotosCount?: number
  unlocatedPhotosCount?: number
  isPhotosVisible?: boolean
}>(), {
  hasTrack: true,
  days: () => [],
  showTodayButton: true,
  totalPhotosCount: 0,
  locatedPhotosCount: 0,
  unlocatedPhotosCount: 0,
  isPhotosVisible: true,
})

const emit = defineEmits<{
  (e: 'changeDay', offset: number): void
  (e: 'selectDay', day: string): void
  (e: 'goToToday'): void
  (e: 'update:viewMode', mode: ViewMode): void
  (e: 'update:isPhotosVisible', val: boolean): void
  (e: 'close'): void
}>()

const calendarDate = computed<CalendarDate | null>({
  get: () => {
    if (!props.selectedDay)
      return null
    return parseDay(props.selectedDay) ?? null
  },
  set: (val) => {
    if (!val)
      return
    emit('selectDay', val.toString())
  },
})

function parseDay(day?: string): CalendarDate | undefined {
  if (!day)
    return undefined
  try {
    return parseDate(day)
  }
  catch {
    return undefined
  }
}

const maxCalendarDate = computed<CalendarDate | undefined>(() => {
  // Конец списка дней поездки важнее «сегодня»: вне поездки выбирать нечего
  if (props.days.length > 0)
    return parseDay(props.days[props.days.length - 1])
  return parseDay(props.todayUtc)
})

const minCalendarDate = computed<CalendarDate | undefined>(() =>
  props.days.length > 0 ? parseDay(props.days[0]) : undefined,
)

/** Индекс выбранного дня в списке дней поездки (-1 — дата вне списка) */
const dayIndexInDays = computed(() =>
  props.days.length > 0 ? props.days.indexOf(props.selectedDay) : -1,
)

const canGoPrev = computed(() =>
  dayIndexInDays.value >= 0 ? dayIndexInDays.value > 0 : true,
)

const canGoNext = computed(() => {
  if (dayIndexInDays.value >= 0)
    return dayIndexInDays.value < props.days.length - 1
  return props.selectedDay < props.todayUtc
})
</script>

<template>
  <!-- Верхняя плавающая панель навигации по дням -->
  <div class="top-nav-bar">
    <div class="day-picker-group">
      <button
        class="day-arrow-btn"
        aria-label="Предыдущий день"
        :disabled="!canGoPrev"
        @click="emit('changeDay', -1)"
      >
        <Icon icon="mdi:chevron-left" />
      </button>

      <CalendarPopover
        v-model="calendarDate"
        :clearable="false"
        :min-value="minCalendarDate"
        :max-value="maxCalendarDate"
        align="center"
      >
        <template #trigger>
          <button
            type="button"
            class="day-current"
            title="Выбрать день в календаре"
            aria-label="Выбрать день в календаре"
          >
            <Icon icon="mdi:calendar-month-outline" class="cal-icon" />
            <span class="day-text">{{ headerDayTitle }}</span>
            <span v-if="selectedDay === todayUtc" class="today-chip">Сегодня</span>
            <Icon icon="mdi:chevron-down" class="dropdown-icon" />
          </button>
        </template>
        <template #footer="{ close }">
          <KitBtn
            v-if="showTodayButton && selectedDay !== todayUtc"
            variant="text"
            size="sm"
            @click="() => { emit('goToToday'); close?.(); }"
          >
            Сегодня
          </KitBtn>
        </template>
      </CalendarPopover>

      <button
        class="day-arrow-btn"
        aria-label="Следующий день"
        :disabled="!canGoNext"
        @click="emit('changeDay', 1)"
      >
        <Icon icon="mdi:chevron-right" />
      </button>
    </div>

    <div class="top-actions">
      <KitBtn
        v-if="showTodayButton && selectedDay !== todayUtc"
        variant="subtle"
        size="xs"
        @click="emit('goToToday')"
      >
        Сегодня
      </KitBtn>

      <!-- Переключатель режима: Маршрут / Точки Безье (только когда трек есть) -->
      <div v-if="hasTrack" class="view-mode-tabs">
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
          title="Исходные измерения GPS: включая погрешности и дрейф на остановках"
          @click="emit('update:viewMode', 'points')"
        >
          <Icon icon="mdi:vector-bezier" class="tab-icon" />
          <span class="tab-label">Исходные точки</span>
          <span v-if="totalPointsCount > 0" class="points-pill">{{ totalPointsCount }}</span>
        </button>
      </div>

      <!-- Переключатель слоя фотографий (если есть фото) -->
      <button
        v-if="totalPhotosCount && totalPhotosCount > 0"
        class="photos-toggle-btn"
        :class="{ 'is-active': isPhotosVisible }"
        :title="isPhotosVisible
          ? `Скрыть фото (${locatedPhotosCount ?? 0} на карте${unlocatedPhotosCount ? `, ${unlocatedPhotosCount} без геоданных` : ''})`
          : `Показать фото (${locatedPhotosCount ?? 0} на карте${unlocatedPhotosCount ? `, ${unlocatedPhotosCount} без геоданных` : ''})`"
        type="button"
        @click="emit('update:isPhotosVisible', !isPhotosVisible)"
      >
        <Icon icon="mdi:camera-outline" class="toggle-icon" />
        <span class="photos-count-badge">{{ locatedPhotosCount ?? 0 }}</span>
      </button>

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
      padding: 0 8px;
      height: 28px;
      border: none;
      background: transparent;
      border-radius: var(--r-full);
      cursor: pointer;
      font-family: inherit;
      color: inherit;
      transition: background-color 0.2s;

      &:hover {
        background: var(--bg-hover-color);

        .dropdown-icon {
          color: var(--fg-primary-color);
        }
      }

      &:focus-visible {
        outline: 2px solid var(--border-accent-color);
        outline-offset: 1px;
      }

      .cal-icon {
        font-size: 1.1rem;
        color: var(--fg-accent-color);
        flex-shrink: 0;
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

      .dropdown-icon {
        font-size: 1rem;
        color: var(--fg-secondary-color);
        margin-left: -2px;
        transition: color 0.2s;
        flex-shrink: 0;
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

    .photos-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 38px;
      padding: 0 11px;
      background-color: var(--bg-secondary-color);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-secondary-color);
      border-radius: var(--r-full);
      box-shadow: var(--s-m);
      cursor: pointer;
      color: var(--fg-secondary-color);
      font-size: 0.8rem;
      font-weight: 600;
      transition: all 0.2s ease;

      .toggle-icon {
        font-size: 1.05rem;
      }

      .photos-count-badge {
        font-size: 0.72rem;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 10px;
        background: var(--bg-primary-color);
        color: var(--fg-secondary-color);
        transition: all 0.2s ease;
      }

      &:hover {
        background-color: var(--bg-hover-color);
        border-color: var(--border-primary-color);
        color: var(--fg-primary-color);
        transform: scale(1.03);
      }

      &.is-active {
        background: var(--fg-accent-color);
        color: var(--fg-inverted-color);
        border-color: var(--fg-accent-color);
        box-shadow: var(--s-xs);

        .photos-count-badge {
          background: rgba(255, 255, 255, 0.25);
          color: var(--fg-inverted-color);
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

        .dropdown-icon {
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
