<script setup lang="ts">
import type { DateRange } from '../../models/types'
import type { ActivityItem } from '../activity-map.vue'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import ActivityFilters from '../controls/activity-filters.vue'

interface IProps {
  activities: ActivityItem[]
}

defineProps<IProps>()

const emit = defineEmits<{
  (e: 'delete', id: string): void
  (e: 'switchToMap'): void
}>()

const dateRange = defineModel<DateRange>('dateRange', { required: true })
</script>

<template>
  <div class="activity-list-view">
    <header class="toolbar">
      <KitBtn
        icon="mdi:map-search-outline"
        @click="emit('switchToMap')"
      >
        Посмотреть на карте
      </KitBtn>

      <div class="filters">
        <ActivityFilters v-model:date-range="dateRange" />
      </div>
    </header>

    <div class="list-content">
      <div v-if="activities.length === 0" class="empty-state">
        <Icon icon="mdi:map-marker-off-outline" />
        <p>Активностей не найдено</p>
      </div>

      <div v-else class="activities-grid">
        <div v-for="act in activities" :key="act.id" class="activity-card">
          <div class="card-content">
            <h3 class="card-title">
              {{ act.title }}
            </h3>
            <div class="card-meta">
              <span v-if="act.date" class="meta-item">
                <Icon icon="mdi:calendar-blank" /> {{ act.date }}
              </span>
              <span v-if="act.duration" class="meta-item">
                <Icon icon="mdi:clock-outline" /> {{ act.duration }}
              </span>
            </div>
            <p v-if="act.description" class="card-desc">
              {{ act.description }}
            </p>
          </div>
          <div class="card-actions">
            <button class="delete-btn" @click="emit('delete', act.id)">
              <Icon icon="mdi:close" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.activity-list-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  background-color: var(--bg-secondary-color);
  padding: 16px;
  border-radius: var(--r-l);
  border: 1px solid var(--border-secondary-color);
}

.activities-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.activity-card {
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  transition: all 0.2s;

  &:hover {
    border-color: var(--border-primary-color);
    transform: translateY(-2px);
  }
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-title {
  margin: 0;
  font-size: 1.1rem;
  color: var(--fg-primary-color);
}

.card-meta {
  display: flex;
  gap: 12px;
  font-size: 0.85rem;
  color: var(--fg-secondary-color);

  .meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.card-desc {
  margin: 0;
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  line-height: 1.4;
}

.delete-btn {
  color: var(--fg-tertiary-color);
  cursor: pointer;
  background: none;
  border: none;
  &:hover {
    color: var(--fg-error-color);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--fg-tertiary-color);
  gap: 12px;
  font-size: 1.2rem;
  .iconify {
    font-size: 3rem;
  }
}
</style>
