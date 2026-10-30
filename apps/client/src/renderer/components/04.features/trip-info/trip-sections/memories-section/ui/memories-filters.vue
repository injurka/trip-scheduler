<script setup lang="ts">
import type { MemoriesGridSize } from '../composables/use-memories-view'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'

interface Props {
  availableDays: { value: string, label: string }[]
  sortOptions: { value: string, label: string, icon: string }[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'toggleFullscreen'): void
}>()
const filterDay = defineModel<string>('filterDay', { required: true })
const filterRating = defineModel<number>('filterRating', { required: true })
const sortOrder = defineModel<string>('sortOrder', { required: true })
const isFullscreen = defineModel<boolean>('isFullscreen', { default: false })
const gridSize = defineModel<MemoriesGridSize>('gridSize', { default: 'md' })

const isRatingFilterOpen = ref(false)

const currentFilterLabel = computed(() =>
  props.availableDays.find(d => d.value === filterDay.value)?.label || 'Все дни')
const starColor = computed(() => filterRating.value > 0 ? 'var(--c-orange-500)' : 'var(--fg-tertiary-color)')

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  emit('toggleFullscreen')
}
</script>

<template>
  <div class="filters-header" :class="{ 'rating-filter-open': isRatingFilterOpen }">
    <!-- Левая часть: Фильтр по дате -->
    <div class="left-controls">
      <div class="filter-group day-group">
        <span class="filter-label">День:</span>
        <KitDropdown v-model="filterDay" :items="availableDays" class="day-dropdown">
          <template #trigger>
            <button class="filter-trigger">
              <Icon icon="mdi:calendar-filter-outline" class="trigger-icon" />
              <span class="trigger-text">{{ currentFilterLabel }}</span>
              <Icon icon="mdi:chevron-down" class="chevron" />
            </button>
          </template>
        </KitDropdown>
      </div>

      <!-- Разделитель -->
      <div class="divider" />

      <!-- Фильтр по рейтингу (Слайдер) -->
      <div id="memories-rating-filter" class="filter-group rating-group">
        <span class="filter-label">Рейтинг:</span>
        <div class="rating-slider-container">
          <KitTooltip
            :text="filterRating > 0 ? `Рейтинг от ${filterRating}` : 'Любой рейтинг'"
            class="slider-tooltip"
          >
            <input
              v-model.number="filterRating"
              type="range"
              min="0"
              max="5"
              step="1"
              class="rating-range"
            >
          </KitTooltip>
          <div class="rating-value">
            <Icon icon="mdi:star" :style="{ color: starColor }" />
            <span>{{ filterRating > 0 ? `${filterRating}+` : 'Все' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Правая часть: Действия и сортировка -->
    <div class="right-controls">
      <!-- Переключатель масштаба сетки: S / M / L -->
      <div class="filter-group grid-size-group">
        <div class="grid-size-toggle" role="group" aria-label="Масштаб сетки">
          <KitTooltip text="Мелкая сетка (S)">
            <button
              type="button"
              class="size-toggle-btn"
              :class="{ 'is-active': gridSize === 'sm' }"
              aria-label="Мелкая сетка"
              @click="gridSize = 'sm'"
            >
              <Icon icon="mdi:grid" />
            </button>
          </KitTooltip>
          <KitTooltip text="Обычная сетка (M)">
            <button
              type="button"
              class="size-toggle-btn"
              :class="{ 'is-active': gridSize === 'md' }"
              aria-label="Обычная сетка"
              @click="gridSize = 'md'"
            >
              <Icon icon="mdi:view-grid-outline" />
            </button>
          </KitTooltip>
          <KitTooltip text="Крупная сетка (L)">
            <button
              type="button"
              class="size-toggle-btn"
              :class="{ 'is-active': gridSize === 'lg' }"
              aria-label="Крупная сетка"
              @click="gridSize = 'lg'"
            >
              <Icon icon="mdi:square-outline" />
            </button>
          </KitTooltip>
        </div>
      </div>

      <div class="filter-group rating-toggle-group">
        <KitTooltip text="Фильтр по рейтингу">
          <button
            class="icon-trigger"
            :class="{ 'is-active': isRatingFilterOpen || filterRating > 0 }"
            aria-label="Фильтр по рейтингу"
            aria-controls="memories-rating-filter"
            :aria-expanded="isRatingFilterOpen"
            @click="isRatingFilterOpen = !isRatingFilterOpen"
          >
            <Icon icon="mdi:star" />
          </button>
        </KitTooltip>
      </div>

      <div class="filter-group sort-group">
        <KitDropdown v-model="sortOrder" :items="sortOptions" align="end">
          <template #trigger>
            <KitTooltip text="Сортировка">
              <button class="icon-trigger" aria-label="Сортировка">
                <Icon icon="mdi:sort" />
              </button>
            </KitTooltip>
          </template>
        </KitDropdown>
      </div>

      <div class="filter-group fullscreen-group">
        <KitTooltip :text="isFullscreen ? 'Свернуть' : 'На весь экран'">
          <button
            class="icon-trigger"
            :aria-label="isFullscreen ? 'Свернуть' : 'На весь экран'"
            @click="toggleFullscreen"
          >
            <Icon :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" />
          </button>
        </KitTooltip>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.filters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
  flex-wrap: wrap;
  gap: 12px;
}

.left-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.right-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.divider {
  width: 1px;
  height: 24px;
  background-color: var(--border-secondary-color);
  display: block;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  font-weight: 500;
  white-space: nowrap;
}

.filter-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--border-primary-color);
    background-color: var(--bg-hover-color);
  }

  .chevron {
    opacity: 0.5;
    font-size: 1rem;
    flex-shrink: 0;
  }

  .trigger-icon {
    flex-shrink: 0;
  }
}

/* Стилизация слайдера */
.rating-slider-container {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--bg-primary-color);
  padding: 4px 8px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
}

.rating-range {
  -webkit-appearance: none;
  appearance: none;
  width: 80px;
  height: 4px;
  background: var(--bg-tertiary-color);
  border-radius: 2px;
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--fg-secondary-color);
    cursor: pointer;
    transition:
      background 0.2s,
      transform 0.2s;
  }

  &::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border: none;
    border-radius: 50%;
    background: var(--fg-secondary-color);
    cursor: pointer;
  }

  @include hover {
    &::-webkit-slider-thumb {
      background: var(--primary-color);
      transform: scale(1.1);
    }
  }

  &:hover::-moz-range-thumb {
    background: var(--primary-color);
  }
}

.rating-value {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  min-width: 40px;
  justify-content: flex-end;
}

.icon-trigger {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-primary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s;

  &:hover {
    color: var(--fg-primary-color);
    background-color: var(--bg-hover-color);
  }

  &.is-active {
    color: var(--c-orange-500);
  }
}

.grid-size-toggle {
  display: inline-flex;
  align-items: center;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 2px;
  gap: 2px;
  height: 34px;

  .size-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--r-xs);
    border: none;
    background: transparent;
    color: var(--fg-tertiary-color);
    cursor: pointer;
    font-size: 1.15rem;
    transition: all 0.2s;

    &:hover {
      color: var(--fg-primary-color);
      background-color: var(--bg-hover-color);
    }

    &.is-active {
      background-color: var(--bg-secondary-color);
      color: var(--fg-accent-color);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    }
  }
}

.rating-toggle-group {
  display: none;
}

@media (max-width: 600px) {
  .divider {
    display: none;
  }

  .filters-header {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    padding: 8px 10px;
  }

  .left-controls {
    display: contents;
  }

  .day-group {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;

    .filter-label {
      display: none;
    }

    .day-dropdown {
      width: 100%;
    }

    .filter-trigger {
      width: 100%;
      height: 36px;
      padding: 6px 10px;
      justify-content: space-between;

      .trigger-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
        text-align: left;
      }
    }
  }

  .right-controls {
    grid-column: 2;
    grid-row: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: flex-end;

    .icon-trigger {
      width: 36px;
      height: 36px;
    }
  }

  .grid-size-toggle {
    height: 36px;

    .size-toggle-btn {
      width: 26px;
      height: 28px;
      font-size: 1.05rem;
    }
  }

  .rating-toggle-group {
    display: flex;
  }

  .rating-group {
    display: none;
    grid-column: 1 / -1;
    grid-row: 2;
    width: 100%;
    gap: 8px;

    .filter-label {
      font-size: 0.85rem;
      flex-shrink: 0;
    }

    .rating-slider-container {
      flex: 1;
      height: 36px;
      min-width: 0;
      padding: 4px 10px;
    }

    .slider-tooltip {
      display: flex;
      flex: 1;
      align-items: center;
      min-width: 0;

      :deep(.kit-tooltip-trigger) {
        width: 100%;
        display: flex;
        align-items: center;
      }
    }

    .rating-range {
      width: 100%;
      flex-grow: 1;
    }

    .rating-value {
      flex-shrink: 0;
    }
  }

  .filters-header.rating-filter-open .rating-group {
    display: flex;
  }
}
</style>
