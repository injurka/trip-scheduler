<script setup lang="ts">
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'

const store = useModuleStore(['plan', 'ui'])

const { getSelectedDay: selectedDay } = storeToRefs(store.plan)
const { isViewMode } = storeToRefs(store.ui)

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
</template>

<style scoped lang="scss">
.day-header {
  position: relative;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-2xs) var(--r-2xs) var(--r-l) var(--r-l);
  padding: 32px;
  margin-bottom: 32px;
  margin-top: 16px;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: linear-gradient(90deg, var(--fg-accent-color), transparent);
    opacity: 0.7;
  }
}

.day-title,
.day-description {
  width: 100%;

  :deep(.milkdown) {
    > div {
      padding: 8px 12px;
      margin: -8px -12px;
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
  margin-bottom: 1rem;

  :deep() {
    .ProseMirror {
      h1,
      p {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--fg-primary-color);
        line-height: 1.2;
        letter-spacing: -0.025em;
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
      font-size: 0.9rem;
      margin: 0;
    }
  }
}

@include media-down(sm) {
  .day-header {
    padding: 24px;
  }
}
</style>
