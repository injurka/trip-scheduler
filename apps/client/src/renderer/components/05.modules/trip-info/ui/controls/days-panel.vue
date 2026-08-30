<script setup lang="ts">
import type { Day } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useDisplay } from '~/shared/composables/use-display'

interface Props {
  days: Day[]
  selectedDayId?: string
  isOpen: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'selectDay', dayId: string): void
  (e: 'addNewDay'): void
  (e: 'addNewDraftDay'): void
  (e: 'close'): void
}>()

const { ui } = useModuleStore(['ui'])
const { mdAndDown } = useDisplay()

const { isDaysPanelPinned, isViewMode } = storeToRefs(ui)
const { toggleDaysPanelPinned } = ui

const calendarDays = computed(() =>
  props.days
    .filter(d => !!d.date)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()),
)

const draftDays = computed(() =>
  props.days.filter(d => !d.date),
)

function onSelectDay(dayId: string) {
  emit('selectDay', dayId)
  if (!isDaysPanelPinned.value)
    emit('close')
}

function getShortWeekday(date: string): string {
  return new Date(date).toLocaleDateString('ru-RU', { weekday: 'short' }).toUpperCase()
}

function getDayActivitiesCount(day: Day): number {
  return day.activities?.length || 0
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
        <KitTooltip v-if="!mdAndDown" :text="isDaysPanelPinned ? 'Открепить панель' : 'Закрепить панель'">
          <button
            class="pin-btn"
            @click="toggleDaysPanelPinned"
          >
            <Icon :icon="isDaysPanelPinned ? 'mdi:pin-off' : 'mdi:pin'" />
          </button>
        </KitTooltip>
        <KitTooltip text="Закрыть">
          <button class="close-btn" @click="$emit('close')">
            <Icon icon="mdi:close" />
          </button>
        </KitTooltip>
      </div>
    </header>

    <div class="panel-content">
      <!-- Календарные дни -->
      <div class="panel-section">
        <div v-if="draftDays.length > 0 || !isViewMode" class="section-header">
          <div class="section-title-label">
            <Icon icon="mdi:calendar-range" />
            <span>Календарный маршрут</span>
          </div>
          <span class="section-count">{{ calendarDays.length }}</span>
        </div>
        <ul class="days-list">
          <li v-for="(day, index) in calendarDays" :key="day.id">
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
                <span class="day-date">{{ new Date(day.date!).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) }}</span>
                <span class="day-weekday-badge">{{ getShortWeekday(day.date!) }}</span>
              </div>
            </button>
          </li>
          <li v-if="calendarDays.length === 0" class="empty-list-notice">
            <span>Календарные дни еще не добавлены</span>
          </li>
        </ul>
      </div>

      <!-- Черновики и варианты маршрутов -->
      <div v-if="draftDays.length > 0 || !isViewMode" class="panel-section drafts-section">
        <div class="section-header">
          <div class="section-title-label">
            <Icon icon="mdi:file-document-edit-outline" />
            <span>Черновики и варианты</span>
          </div>
          <span class="section-count">{{ draftDays.length }}</span>
        </div>
        <ul class="days-list">
          <li v-for="(day, index) in draftDays" :key="day.id">
            <button
              class="day-item day-item--draft"
              :class="{ active: selectedDayId === day.id }"
              @click="onSelectDay(day.id)"
            >
              <div class="day-item-main">
                <span class="day-draft-icon">
                  <Icon icon="mdi:map-marker-path" />
                </span>
                <span class="day-title">{{ day.title || `Черновик ${index + 1}` }}</span>
              </div>
              <div class="day-item-meta">
                <span v-if="getDayActivitiesCount(day) > 0" class="day-activities-count">
                  {{ getDayActivitiesCount(day) }} акт.
                </span>
                <span class="day-draft-badge">Черновик</span>
              </div>
            </button>
          </li>
          <li v-if="draftDays.length === 0" class="empty-list-notice">
            <span>Нет черновиков</span>
          </li>
        </ul>
      </div>
    </div>

    <footer v-if="!isViewMode" class="panel-footer">
      <button class="add-btn add-day-btn" @click="$emit('addNewDay')">
        <Icon icon="mdi:plus" />
        <span>Новый день</span>
      </button>
      <button class="add-btn add-draft-btn" @click="$emit('addNewDraftDay')">
        <Icon icon="mdi:file-document-plus-outline" />
        <span>Черновик</span>
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
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 20px 6px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;

  .section-title-label {
    display: flex;
    align-items: center;
    gap: 6px;

    .iconify {
      font-size: 0.95rem;
    }
  }

  .section-count {
    background-color: var(--bg-secondary-color);
    padding: 2px 6px;
    border-radius: var(--r-full);
    font-size: 0.75rem;
    color: var(--fg-secondary-color);
  }
}

.drafts-section {
  border-top: 1px dashed var(--border-secondary-color);
  padding-top: 12px;
}

.empty-list-notice {
  padding: 8px 20px;
  font-size: 0.8rem;
  color: var(--fg-tertiary-color);
  font-style: italic;
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
  padding: 10px 20px;
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
    gap: 10px;
    min-width: 0;
    flex-shrink: 1;
  }

  .day-number,
  .day-draft-icon {
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

  .day-draft-icon {
    font-size: 1rem;
    color: var(--fg-tertiary-color);
    border: 1px dashed var(--border-secondary-color);
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
    gap: 8px;
    flex-shrink: 0;
  }

  .day-date {
    font-weight: 400;
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    white-space: nowrap;
    font-family: 'Sansation';
  }

  .day-activities-count {
    font-size: 0.75rem;
    color: var(--fg-secondary-color);
    background-color: var(--bg-secondary-color);
    padding: 2px 6px;
    border-radius: var(--r-2xs);
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

  .day-draft-badge {
    background-color: rgba(var(--primary-color-rgb, 100, 116, 139), 0.12);
    color: var(--fg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    padding: 3px 8px;
    border-radius: var(--r-xs);
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
  }

  &.active {
    background-color: var(--bg-hover-color);

    .day-number {
      background-color: var(--fg-accent-color);
      color: var(--fg-inverted-color);
    }
    .day-draft-icon {
      background-color: var(--fg-accent-color);
      color: var(--fg-inverted-color);
      border-color: var(--fg-accent-color);
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
      background-color: rgba(0, 122, 255, 0.2);
    }
    .day-draft-badge {
      color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
      background-color: rgba(0, 122, 255, 0.15);
    }
  }
}

.panel-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-secondary-color);
  flex-shrink: 0;
  z-index: 100;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 12px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  .iconify {
    font-size: 1.1rem;
    color: var(--fg-secondary-color);
  }

  &:hover {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);

    .iconify {
      color: var(--fg-accent-color);
    }
  }
}
</style>
