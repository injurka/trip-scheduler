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
const sortOrder = defineModel<string>('sortOrder', { required: true })

const currentFilterLabel = computed(() =>
  props.availableDays.find(d => d.value === filterDay.value)?.label || 'Все дни',
)
</script>

<template>
  <div class="filters-header">
    <div class="filter-group">
      <span class="filter-label">Фильтр:</span>
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
</style>
