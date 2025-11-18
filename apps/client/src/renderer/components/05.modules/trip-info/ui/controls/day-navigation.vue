<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'

const store = useModuleStore(['plan'])

const { getPreviousDayId, getNextDayId } = storeToRefs(store.plan)
const { selectPreviousDay, selectNextDay } = store.plan

function handleSelectPreviousDay() {
  selectPreviousDay()
}

function handleSelectNextDay() {
  selectNextDay()
}
</script>

<template>
  <div class="day-navigation">
    <button
      class="nav-button"
      :disabled="!getPreviousDayId"
      @click="handleSelectPreviousDay"
    >
      <Icon icon="mdi:chevron-left" />
      <span class="nav-button-text">Предыдущий день</span>
    </button>
    <button
      class="nav-button"
      :disabled="!getNextDayId"
      @click="handleSelectNextDay"
    >
      <span class="nav-button-text">Следующий день</span>
      <Icon icon="mdi:chevron-right" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.day-navigation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 0;
  border-top: 1px solid var(--border-secondary-color);
  margin-top: 64px;
}

.nav-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: transparent;
  color: var(--fg-secondary-color);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:not(:disabled):hover {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .iconify {
    font-size: 1.2rem;
  }
}

@include media-down(sm) {
  .nav-button-text {
    display: none;
  }
}
</style>
