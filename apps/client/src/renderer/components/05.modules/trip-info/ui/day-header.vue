<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { DayRouteVisualizer } from '~/components/04.features/trip-info/trip-plan'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'

const store = useModuleStore(['plan', 'ui'])

const { getSelectedDay: selectedDay, currentDayIndex } = storeToRefs(store.plan)
const { isViewMode } = storeToRefs(store.ui)

const isVisualizerOpen = ref(false)

const dayNumber = computed(() => currentDayIndex.value + 1)
const activitiesCount = computed(() => selectedDay.value?.activities?.length || 0)

function updateDayDetails(details: { title?: string, description?: string, meta?: any[] }) {
  store.plan.updateDayDetails(selectedDay.value!.id, details)
}

function handleDescriptionBlur(newDesc: string) {
  updateDayDetails({ description: newDesc })
}

function handleTitleBlur(newTitle: string) {
  updateDayDetails({ title: newTitle })
}

function handleScrollToActivity(activityId: string) {
  const el = document.getElementById(`activity-${activityId}`) || document.querySelector(`[data-activity-id="${activityId}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.remove('highlight-pulse')
    void (el as HTMLElement).offsetWidth
    el.classList.add('highlight-pulse')
    setTimeout(() => {
      el.classList.remove('highlight-pulse')
    }, 2000)
  }
}
</script>

<template>
  <div v-if="selectedDay" class="day-header">
    <div class="day-header__accent-bar" />
    <div class="day-header__glow" />

    <div class="day-header__inner">
      <div class="day-header__meta">
        <span class="day-badge">
          <span class="day-badge__label">день</span>
          <span class="day-badge__number">{{ dayNumber }}</span>
        </span>
        <div class="day-header__separator" />

        <KitBtn
          size="xs"
          :variant="isVisualizerOpen ? 'solid' : 'outlined'"
          :color="isVisualizerOpen ? 'primary' : 'secondary'"
          class="visualizer-toggle-btn"
          :title="isVisualizerOpen ? 'Скрыть схему маршрута' : 'Показать интерактивную схему маршрута дня'"
          @click="isVisualizerOpen = !isVisualizerOpen"
        >
          <Icon :icon="isVisualizerOpen ? 'mdi:transit-connection-variant' : 'mdi:map-marker-path'" class="toggle-icon" />
          <span class="toggle-text">Схема дня</span>
          <span v-if="activitiesCount > 0" class="toggle-count">
            {{ activitiesCount }}
          </span>
          <Icon :icon="isVisualizerOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="toggle-chevron" />
        </KitBtn>
      </div>

      <KitInlineMdEditorWrapper
        :key="selectedDay.id"
        v-model="selectedDay.title"
        :readonly="isViewMode"
        :features="{ 'block-edit': false }"
        placeholder="Название дня..."
        class="day-title"
        @blur="handleTitleBlur(selectedDay.title)"
      />
      <KitInlineMdEditorWrapper
        :key="selectedDay.id"
        v-model="selectedDay.description"
        :readonly="isViewMode"
        :features="{ 'block-edit': false }"
        placeholder="Добавьте описание..."
        class="day-description"
        @blur="handleDescriptionBlur(selectedDay.description)"
      />
    </div>

    <!-- Collapsible Day Route Visualizer -->
    <Transition name="expand-visualizer">
      <div v-if="isVisualizerOpen" class="day-route-visualizer-wrapper">
        <DayRouteVisualizer
          :day="selectedDay"
          :readonly="isViewMode"
          @close="isVisualizerOpen = false"
          @scroll-to-activity="handleScrollToActivity"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.day-header {
  position: relative;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-2xs) var(--r-2xs) var(--r-l) var(--r-l);
  margin-bottom: 32px;
  margin-top: 16px;
  overflow: hidden;

  @include media-down(sm) {
    .day-header__inner {
      padding: 20px;
    }
  }
}

.day-header__accent-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: linear-gradient(
    90deg,
    var(--fg-accent-color) 0%,
    color-mix(in srgb, var(--fg-accent-color) 40%, transparent) 60%,
    transparent 100%
  );
  z-index: 1;
}

.day-header__glow {
  pointer-events: none;
  position: absolute;
  top: -40px;
  left: -20px;
  width: 200px;
  height: 140px;
  background: radial-gradient(
    ellipse at 30% 30%,
    color-mix(in srgb, var(--fg-accent-color) 12%, transparent),
    transparent 70%
  );
  z-index: 0;
}

.day-header__inner {
  position: relative;
  z-index: 1;
  padding: 24px 32px 28px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.day-header__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.day-badge {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  background: color-mix(in srgb, var(--fg-accent-color) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--fg-accent-color) 25%, transparent);
  border-radius: 999px;
  padding: 3px 12px 3px 10px;
  line-height: 1;
  flex-shrink: 0;
}

.day-badge__label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--fg-accent-color);
  opacity: 0.75;
}

.day-badge__number {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--fg-accent-color);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.day-header__separator {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--border-secondary-color) 80%, transparent), transparent);
}

.day-title,
.day-description {
  width: 100%;

  :deep(.milkdown) {
    > div {
      padding: 6px 10px;
      margin: -6px -10px;
      border-radius: var(--r-m);
      cursor: text;
      transition: background-color 0.2s ease-in-out;

      &:hover {
        background-color: var(--bg-hover-color);
      }
    }
  }
}

.day-title {
  margin-bottom: 10px;

  :deep() {
    .ProseMirror {
      h1,
      p {
        font-size: 1.55rem;
        font-weight: 700;
        color: var(--fg-primary-color);
        line-height: 1.2;
        letter-spacing: -0.03em;
        margin: 0;
      }
    }
  }
}

.day-description {
  :deep() {
    .ProseMirror p {
      color: var(--fg-secondary-color);
      line-height: 1.7;
      font-size: 0.88rem;
      margin: 0;
    }
  }
}

.visualizer-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  padding: 3px 10px;
  border-radius: 999px;
  flex-shrink: 0;

  .toggle-icon {
    font-size: 0.95rem;
  }

  .toggle-count {
    background: rgba(var(--fg-accent-color-rgb), 0.18);
    color: var(--fg-accent-color);
    border-radius: 999px;
    padding: 0 6px;
    font-size: 0.72rem;
    font-weight: 700;
  }

  &.kit-btn--solid .toggle-count {
    background: rgba(255, 255, 255, 0.25);
    color: #fff;
  }

  .toggle-chevron {
    font-size: 0.85rem;
    margin-left: -2px;
  }
}

.expand-visualizer-enter-active,
.expand-visualizer-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  max-height: 800px;
  opacity: 1;
  overflow: hidden;
}

.expand-visualizer-enter-from,
.expand-visualizer-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-8px);
}
</style>
