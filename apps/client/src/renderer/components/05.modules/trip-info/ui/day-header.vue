<script setup lang="ts">
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'

const store = useModuleStore(['plan', 'ui'])

const { getSelectedDay: selectedDay, currentDayIndex } = storeToRefs(store.plan)
const { isViewMode } = storeToRefs(store.ui)

const dayNumber = computed(() => currentDayIndex.value + 1)

function updateDayDetails(details: { title?: string, description?: string, meta?: any[] }) {
  store.plan.updateDayDetails(selectedDay.value!.id, details)
}

function handleDescriptionBlur(newDesc: string) {
  updateDayDetails({ description: newDesc })
}

function handleTitleBlur(newTitle: string) {
  updateDayDetails({ title: newTitle })
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
</style>
