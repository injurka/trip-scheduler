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
  (e: 'createMark'): void
}>()

const dateRange = defineModel<DateRange>('dateRange', { required: true })
</script>

<template>
  <div class="activity-list-view">
    <header class="toolbar">
      <div class="toolbar-group">
        <KitBtn icon="mdi:map-search-outline" @click="emit('switchToMap')">
          Посмотреть на карте
        </KitBtn>
        <div class="filters">
          <ActivityFilters v-model:date-range="dateRange" />
        </div>
      </div>

      <KitBtn variant="text" icon="mdi:plus" @click="emit('createMark')">
        Создать метку
      </KitBtn>
    </header>

    <div class="list-content">
      <div v-if="activities.length === 0" class="empty-state">
        <Icon icon="mdi:map-marker-off-outline" />
        <p>Активностей не найдено</p>
      </div>

      <div v-else class="activities-grid">
        <div v-for="act in activities" :key="act.id" class="activity-card" :class="`status-${act.status}`">
          <div class="card-status-line" />
          <div class="card-content">
            <div class="card-header">
              <div class="badge" :class="`badge-${act.status}`">
                <Icon v-if="act.isStatic" icon="mdi:map-marker" />
                <Icon v-else-if="act.status === 'active'" icon="mdi:fire" />
                <Icon v-else-if="act.status === 'upcoming'" icon="mdi:calendar-clock" />
                <Icon v-else icon="mdi:check-all" />
                <span>{{ act.isStatic ? 'Место' : (act.status === 'active' ? 'Идёт сейчас' : (act.status === 'upcoming' ? 'Ожидается' : 'Завершено')) }}</span>
              </div>
              <button class="delete-btn" @click="emit('delete', act.id)">
                <Icon icon="mdi:close" />
              </button>
            </div>

            <h3 class="card-title">
              {{ act.title }}
            </h3>

            <div class="card-meta">
              <span v-if="act.date" class="meta-item">
                <Icon icon="mdi:calendar-blank" /> {{ act.date }}
              </span>
              <span v-if="act.durationHours > 0" class="meta-item">
                <Icon icon="mdi:clock-outline" /> {{ act.durationHours }} ч.
              </span>
            </div>
            <p v-if="act.description" class="card-desc">
              {{ act.description }}
            </p>
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
  justify-content: space-between;
  gap: 16px;
  background-color: var(--bg-secondary-color);
  padding: 16px;
  border-radius: var(--r-l);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    flex-direction: column;
    align-items: stretch;
  }
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 16px;

  @include media-down(sm) {
    flex-wrap: wrap;
  }
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
  position: relative;
  display: flex;
  transition: all 0.2s;
  overflow: hidden;

  &:hover {
    border-color: var(--border-primary-color);
    transform: translateY(-2px);
    box-shadow: var(--s-m);
  }

  .card-status-line {
    width: 4px;
    flex-shrink: 0;
  }

  &.status-active {
    border-color: rgba(244, 63, 94, 0.4);
    background-color: rgba(244, 63, 94, 0.05);
    .card-status-line {
      background-color: #f43f5e;
    }
  }
  &.status-upcoming .card-status-line {
    background-color: #3b82f6;
  }
  &.status-past .card-status-line {
    background-color: #9ca3af;
  }
  &.status-static .card-status-line {
    background-color: #10b981;
  }
}

.card-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-grow: 1;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 4px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--r-full);
  font-size: 0.75rem;
  font-weight: 600;

  &.badge-active {
    background-color: #f43f5e;
    color: white;
    animation: pulse 2s infinite;
  }
  &.badge-upcoming {
    background-color: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }
  &.badge-past {
    background-color: rgba(156, 163, 175, 0.15);
    color: #9ca3af;
  }
  &.badge-static {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }
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

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.4);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(244, 63, 94, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(244, 63, 94, 0);
  }
}
</style>
