<script setup lang="ts">
import type { Day } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useDisplay } from '~/shared/composables/use-display'

interface Props {
  days: Day[]
  selectedDayId?: string
  isOpen: boolean
}
defineProps<Props>()
const emit = defineEmits<{
  (e: 'selectDay', dayId: string): void
  (e: 'addNewDay'): void
  (e: 'close'): void
}>()

const { ui } = useModuleStore(['ui'])
const { mdAndDown } = useDisplay()

const { isDaysPanelPinned, isViewMode } = storeToRefs(ui)
const { toggleDaysPanelPinned } = ui

function onSelectDay(dayId: string) {
  emit('selectDay', dayId)
  if (!isDaysPanelPinned.value)
    emit('close')
}

function getShortWeekday(date: string): string {
  return new Date(date).toLocaleDateString('ru-RU', { weekday: 'short' }).toUpperCase()
}
</script>

<template>
  <div
    v-if="(isOpen && !isDaysPanelPinned) || (isOpen && mdAndDown)"
    class="backdrop"
    @click="$emit('close')"
  />

  <aside class="panel" :class="{ open: isOpen, pinned: !mdAndDown && isDaysPanelPinned }">
    <header class="panel-header">
      <div class="header-title">
        <Icon icon="mdi:calendar-month-outline" />
        <h2>Дни путешествия</h2>
      </div>
      <div class="header-buttons">
        <button
          v-if="!mdAndDown"
          class="pin-btn"
          :title="isDaysPanelPinned ? 'Открепить панель' : 'Закрепить панель'"
          @click="toggleDaysPanelPinned"
        >
          <Icon :icon="isDaysPanelPinned ? 'mdi:pin-off' : 'mdi:pin'" />
        </button>
        <button class="close-btn" title="Закрыть" @click="$emit('close')">
          <Icon icon="mdi:close" />
        </button>
      </div>
    </header>

    <div class="panel-content">
      <ul class="days-list">
        <li v-for="(day, index) in days" :key="day.id">
          <button
            class="day-item"
            :class="{ active: selectedDayId === day.id }"
            @click="onSelectDay(day.id)"
          >
            <div class="day-item-main">
              <span class="day-number">{{ index + 1 }}</span>
              <span class="day-title">{{ day.title || `День ${index + 1}` }}</span>
            </div>
            <div class="day-item-meta">
              <span class="day-date">{{ new Date(day.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) }}</span>
              <span class="day-weekday-badge">{{ getShortWeekday(day.date) }}</span>
            </div>
          </button>
        </li>
      </ul>
    </div>

    <footer v-if="!isViewMode" class="panel-footer">
      <button class="add-day-btn" @click="$emit('addNewDay')">
        <Icon icon="mdi:plus" />
        <span>Добавить новый день</span>
      </button>
    </footer>
  </aside>
</template>

<style scoped lang="scss">
.backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 10;
}

.panel {
  position: fixed;
  top: 0;
  left: 0;
  width: 400px;
  height: 100%;
  background-color: var(--bg-primary-color);
  z-index: 11;
  transform: translateX(-100%);
  transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
  display: flex;
  flex-direction: column;
  opacity: 0;

  &.open {
    opacity: 1;
    transform: translateX(0);
    box-shadow: var(--s-xl);
  }

  &.pinned {
    position: fixed;
    transform: none;
    top: 56px;
    height: calc(100% - 56px - 47px);
    opacity: 1;
    box-shadow: none;
    border-right: 1px solid var(--border-secondary-color);

    .close-btn {
      display: none;
    }

    &::before {
      content: '';
      position: absolute;
      width: 8px;
      bottom: -47px;
      right: -1px;
      border-right: 1px solid var(--border-secondary-color);
      height: 47px;
    }
  }

  @include media-down(sm) {
    width: 100%;
  }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-secondary-color);
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.2rem;

  h2 {
    font-size: inherit;
    font-weight: 600;
    margin: 0;
  }

  .iconify {
    font-size: 1.4rem;
    color: var(--fg-secondary-color);
  }
}

.header-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pin-btn,
.close-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--fg-secondary-color);
  font-size: 1.1rem;
  line-height: 1;
  display: flex;
  align-items: center;

  &:hover {
    color: var(--fg-primary-color);
  }
}

.panel-content {
  flex-grow: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.days-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.day-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 10px;
  border: none;
  background-color: transparent;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.2s ease;
  &:hover {
    background-color: var(--bg-hover-color);
  }

  &-main {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex-shrink: 1;
  }

  .day-number {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: var(--r-2xs);
    background-color: var(--bg-secondary-color);
    color: var(--fg-secondary-color);
    font-size: 0.85rem;
    font-weight: 600;
    transition: all 0.2s ease;
    font-family: 'Sansation';
  }

  .day-title {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--fg-primary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: 'Sansation';
  }

  &-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .day-date {
    font-weight: 400;
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    white-space: nowrap;
    font-family: 'Sansation';
  }

  .day-weekday-badge {
    background-color: var(--bg-secondary-color);
    color: var(--fg-secondary-color);
    padding: 3px 8px;
    border-radius: var(--r-xs);
    font-size: 0.7rem;
    font-weight: 800;
    line-height: 1;
    font-family: 'Sansation';
  }

  &.active {
    background-color: var(--bg-accent-color-translucent);

    .day-number {
      background-color: var(--fg-accent-color);
      color: var(--fg-inverted-color);
    }
    .day-title {
      color: var(--fg-accent-color);
      font-weight: 600;
    }
    .day-date,
    .day-weekday-badge {
      color: var(--fg-accent-color);
    }
    .day-weekday-badge {
      background-color: var(--bg-accent-color-translucent-heavy, rgba(0, 122, 255, 0.2));
    }
  }
}

.panel-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-secondary-color);
  flex-shrink: 0;
  z-index: 100;
}

.add-day-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: transparent;
  color: var(--fg-secondary-color);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
  }
}
</style>
