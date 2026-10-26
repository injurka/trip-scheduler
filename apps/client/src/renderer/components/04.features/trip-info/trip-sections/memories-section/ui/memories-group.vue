<script setup lang="ts">
import type { GroupedMemory, MemoriesGridSize } from '../composables/use-memories-view'
import type { Day } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { vRipple } from '~/shared/directives/ripple'

interface Props {
  group: GroupedMemory
  matchedDay?: Day
  currentFilterDay?: string
  gridSize?: MemoriesGridSize
}

const props = withDefaults(defineProps<Props>(), {
  currentFilterDay: 'all',
  gridSize: 'md',
})

const emit = defineEmits<{
  (e: 'clickImage', id: string): void
  (e: 'playGroup', firstMemoryId: string): void
  (e: 'toggleFilterDay', date: string): void
  (e: 'goToDayPlan', dayId: string): void
}>()

const isCollapsed = ref(false)

const isDayFiltered = computed(() => props.currentFilterDay === props.group.date)

const starredCount = computed(() => {
  return props.group.items.filter(item => (item.rating ?? 0) >= 4).length
})

const isCustomDayTitle = computed(() => {
  if (!props.matchedDay?.title)
    return false
  return props.matchedDay.title.trim().length > 0
})

function handleToggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

function handlePlayGroup() {
  if (props.group.items.length > 0) {
    emit('playGroup', props.group.items[0].id)
  }
}

function handleToggleFilter() {
  emit('toggleFilterDay', props.group.date)
}

function handleGoToPlan() {
  if (props.matchedDay?.id) {
    emit('goToDayPlan', props.matchedDay.id)
  }
}
</script>

<template>
  <div class="gallery-group" :class="{ 'is-collapsed': isCollapsed }">
    <div class="group-header">
      <div
        class="group-header-chip"
        :class="{ 'is-collapsed': isCollapsed, 'is-active-filter': isDayFiltered }"
      >
        <button
          v-ripple
          type="button"
          class="chip-toggle-btn"
          :title="isCollapsed ? 'Развернуть день' : 'Свернуть день'"
          @click="handleToggleCollapse"
        >
          <Icon
            icon="mdi:chevron-down"
            class="collapse-icon"
            :class="{ 'is-flipped': isCollapsed }"
          />
          <Icon
            :icon="group.date === 'no-date' ? 'mdi:image-outline' : 'mdi:calendar-blank-outline'"
            class="date-icon"
          />
          <span class="group-title">{{ group.title }}</span>

          <span v-if="matchedDay && isCustomDayTitle" class="day-badge" :title="matchedDay.title">
            {{ matchedDay.title }}
          </span>
        </button>

        <span class="count-badge" :title="`Всего фото: ${group.items.length}`">
          {{ group.items.length }}
        </span>

        <KitTooltip v-if="starredCount > 0" :text="`В избранном: ${starredCount} фото`">
          <span class="starred-badge">
            <Icon icon="mdi:star" class="star-icon" />
            {{ starredCount }}
          </span>
        </KitTooltip>

        <div class="chip-divider" />

        <div class="chip-actions">
          <KitTooltip text="Смотреть фото этого дня">
            <button
              v-ripple
              type="button"
              class="action-btn"
              aria-label="Смотреть фото этого дня"
              @click.stop="handlePlayGroup"
            >
              <Icon icon="mdi:play" />
            </button>
          </KitTooltip>

          <KitTooltip :text="isDayFiltered ? 'Показать все дни' : 'Только этот день'">
            <button
              v-ripple
              type="button"
              class="action-btn"
              :class="{ 'is-active': isDayFiltered }"
              :aria-label="isDayFiltered ? 'Сбросить фильтр по дню' : 'Показать только этот день'"
              @click.stop="handleToggleFilter"
            >
              <Icon :icon="isDayFiltered ? 'mdi:filter-check' : 'mdi:filter-outline'" />
            </button>
          </KitTooltip>

          <KitTooltip v-if="matchedDay" :text="`Перейти к плану: ${matchedDay.title || group.title}`">
            <button
              v-ripple
              type="button"
              class="action-btn"
              aria-label="Перейти к плану дня"
              @click.stop="handleGoToPlan"
            >
              <Icon icon="mdi:calendar-arrow-right" />
            </button>
          </KitTooltip>
        </div>
      </div>
    </div>

    <Transition name="group-collapse">
      <div v-show="!isCollapsed" class="photos-grid" :class="`is-size-${gridSize}`">
        <div
          v-for="item in group.items"
          :key="item.id"
          class="photo-card"
          @click="emit('clickImage', item.id)"
        >
          <KitImage
            :src="item.image?.variants?.medium || item.image?.url"
            object-fit="cover"
            class="photo-img"
          />
          <div class="photo-overlay">
            <KitTooltip v-if="item.comment" text="Есть комментарий">
              <span class="overlay-icon">
                <Icon icon="mdi:comment-text-outline" />
              </span>
            </KitTooltip>
            <div v-if="(item.rating ?? 0) > 0" class="overlay-rating">
              <Icon icon="mdi:star" class="rating-star" />
              <span>{{ item.rating }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.gallery-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-header {
  position: sticky;
  top: var(--memories-group-header-top, 16px);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  pointer-events: none;
}

.group-header-chip {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px 5px 12px;
  border-radius: var(--r-full);
  background-color: color-mix(in srgb, var(--bg-secondary-color) 88%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--border-primary-color);
  box-shadow: var(--s-m);
  max-width: 100%;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
    box-shadow: var(--s-l);
  }

  &.is-active-filter {
    border-color: var(--fg-accent-color);
    background-color: color-mix(in srgb, var(--bg-secondary-color) 92%, var(--fg-accent-color) 8%);
  }

  &.is-collapsed {
    opacity: 0.92;
  }
}

.chip-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  color: var(--fg-primary-color);
  padding: 4px 6px;
  margin: -4px 0 -4px -6px;
  border-radius: var(--r-full);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  text-align: left;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
  min-width: 0;

  &:hover {
    background-color: var(--bg-hover-color);
  }

  .collapse-icon {
    font-size: 1.15rem;
    color: var(--fg-secondary-color);
    transition: transform 0.2s ease;
    flex-shrink: 0;

    &.is-flipped {
      transform: rotate(-90deg);
    }
  }

  .date-icon {
    font-size: 1.05rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
  }

  .group-title {
    text-transform: capitalize;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .day-badge {
    font-size: 0.75rem;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: var(--r-full);
    background-color: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border: 1px solid var(--border-secondary-color);
  }
}

.count-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--r-full);
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  flex-shrink: 0;
  line-height: 1.3;
}

.starred-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--r-full);
  background-color: color-mix(in srgb, #f59e0b 15%, transparent);
  color: #f59e0b;
  flex-shrink: 0;

  .star-icon {
    font-size: 0.85rem;
  }
}

.chip-divider {
  width: 1px;
  height: 16px;
  background-color: var(--border-secondary-color);
  flex-shrink: 0;
}

.chip-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--r-full);
  border: 1px solid transparent;
  background-color: transparent;
  color: var(--fg-secondary-color);
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.18s ease;

  &:hover {
    color: var(--fg-primary-color);
    background-color: var(--bg-hover-color);
    border-color: var(--border-secondary-color);
  }

  &.is-active {
    color: var(--fg-accent-color);
    background-color: color-mix(in srgb, var(--fg-accent-color) 12%, transparent);
    border-color: color-mix(in srgb, var(--fg-accent-color) 30%, transparent);
  }
}

.photos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--cell-size, 190px), 1fr));
  gap: var(--grid-gap, 8px);
  grid-auto-rows: var(--cell-size, 190px);
  grid-auto-flow: dense;

  &.is-size-sm {
    --cell-size: 130px;
    --grid-gap: 6px;
  }

  &.is-size-md {
    --cell-size: 190px;
    --grid-gap: 8px;
  }

  &.is-size-lg {
    --cell-size: 290px;
    --grid-gap: 12px;

    .photo-card:nth-child(5n) {
      grid-column: auto;
      grid-row: auto;

      @media (min-width: 1600px) {
        grid-column: span 2;
        grid-row: span 2;
      }
    }
  }
}

.photo-card {
  position: relative;
  border-radius: var(--r-m);
  overflow: hidden;
  cursor: pointer;
  background-color: var(--bg-tertiary-color);
  transition: transform 0.2s;

  &:nth-child(5n) {
    grid-column: span 2;
    grid-row: span 2;
  }

  @include hover {
    & {
      transform: scale(0.98);
      .photo-overlay {
        opacity: 1;
      }
    }
  }
}

.photo-img {
  width: 100%;
  height: 100%;
  display: block;
}

.photo-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, transparent 40%);
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 8px;
}

.overlay-icon {
  color: white;
  font-size: 1.1rem;
}

.overlay-rating {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #fbbf24;
  font-size: 0.8rem;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.45);
  padding: 2px 6px;
  border-radius: var(--r-full);
  margin-left: auto;

  .rating-star {
    font-size: 0.85rem;
  }
}

.group-collapse-enter-active,
.group-collapse-leave-active {
  transition: all 0.25s ease-out;
}

.group-collapse-enter-from,
.group-collapse-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 600px) {
  .group-header {
    padding: 2px 0;
    margin-top: 8px;
  }

  .group-header-chip {
    width: 100%;
    justify-content: space-between;
    padding: 4px 6px 4px 10px;
    gap: 6px;
  }

  .chip-toggle-btn {
    font-size: 0.85rem;
    gap: 6px;
    flex: 1;
    min-width: 0;

    .day-badge {
      display: none;
    }
  }

  .photos-grid {
    &.is-size-sm {
      grid-template-columns: repeat(3, 1fr);
      grid-auto-rows: 110px;
      gap: 4px;
    }

    &.is-size-md {
      grid-template-columns: repeat(2, 1fr);
      grid-auto-rows: 140px;
      gap: 6px;
    }

    &.is-size-lg {
      grid-template-columns: 1fr;
      grid-auto-rows: 230px;
      gap: 10px;
    }

    .photo-card:nth-child(n) {
      grid-column: auto;
      grid-row: auto;
    }
  }
}
</style>
