<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'

interface Props {
  availableDays: { value: string, label: string }[]
  sortOptions: { value: string, label: string, icon: string }[]
}

const props = defineProps<Props>()

const filterDay = defineModel<string>('filterDay', { required: true })
const filterRating = defineModel<number>('filterRating', { required: true })
const sortOrder = defineModel<string>('sortOrder', { required: true })

const currentFilterLabel = computed(() =>
  props.availableDays.find(d => d.value === filterDay.value)?.label || 'Все дни',
)

// Вычисляем цвет звездочки в зависимости от выбранного значения
const starColor = computed(() => filterRating.value > 0 ? 'var(--c-orange-500)' : 'var(--fg-tertiary-color)')
</script>

<template>
  <div class="filters-header">
    <!-- Левая часть: Фильтр по дате -->
    <div class="left-controls">
      <div class="filter-group">
        <span class="filter-label">День:</span>
        <KitDropdown v-model="filterDay" :items="availableDays">
          <template #trigger>
            <button class="filter-trigger">
              <Icon icon="mdi:calendar-filter-outline" />
              <span>{{ currentFilterLabel }}</span>
              <Icon icon="mdi:chevron-down" class="chevron" />
            </button>
          </template>
        </KitDropdown>
      </div>

      <!-- Разделитель -->
      <div class="divider" />

      <!-- Фильтр по рейтингу (Слайдер) -->
      <div class="filter-group rating-group">
        <span class="filter-label">Рейтинг:</span>
        <div class="rating-slider-container">
          <input
            v-model.number="filterRating"
            type="range"
            min="0"
            max="5"
            step="1"
            class="rating-range"
            :title="filterRating > 0 ? `Рейтинг от ${filterRating}` : 'Любой рейтинг'"
          >
          <div class="rating-value">
            <Icon icon="mdi:star" :style="{ color: starColor }" />
            <span>{{ filterRating > 0 ? `${filterRating}+` : 'Все' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Правая часть: Сортировка -->
    <div class="filter-group">
      <KitDropdown v-model="sortOrder" :items="sortOptions" align="end">
        <template #trigger>
          <button class="icon-trigger" title="Сортировка">
            <Icon icon="mdi:sort" />
          </button>
        </template>
      </KitDropdown>
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

  &:hover::-webkit-slider-thumb {
    background: var(--primary-color);
    transform: scale(1.1);
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
}

@media (max-width: 600px) {
  .divider {
    display: none;
  }
  .filters-header {
    flex-direction: column;
    align-items: stretch;
  }
  .left-controls {
    flex-direction: column;
    align-items: stretch;
  }
  .filter-group {
    justify-content: space-between;
  }
  .rating-range {
    width: 100%;
    flex-grow: 1;
  }
}
</style>
