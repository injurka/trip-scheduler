<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { SUMMARY_DAYS_OPTIONS } from '../models/constants'

interface Props {
  isLoading?: boolean
  isRefreshing?: boolean
  selectedDays?: number
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  isRefreshing: false,
  selectedDays: 14,
})

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'selectDays', days: number): void
}>()
</script>

<template>
  <header class="activity-tracking-header">
    <div class="header-main">
      <div class="title-with-badge">
        <h1 class="activity-title">
          <Icon icon="mdi:map-marker-path" class="title-icon" />
          Трекинг активности
        </h1>
      </div>
      <p class="activity-desc">
        История перемещений, статистика видов транспорта и трекинг в реальном времени
      </p>
    </div>

    <div class="header-actions">
      <!-- Переключатель диапазона дней -->
      <div class="days-selector">
        <KitBtn
          v-for="opt in SUMMARY_DAYS_OPTIONS"
          :key="opt.value"
          size="xs"
          :variant="props.selectedDays === opt.value ? 'solid' : 'tonal'"
          :color="props.selectedDays === opt.value ? 'primary' : 'secondary'"
          @click="emit('selectDays', opt.value)"
        >
          {{ opt.label }}
        </KitBtn>
      </div>

      <KitBtn
        variant="tonal"
        size="sm"
        :disabled="props.isLoading || props.isRefreshing"
        @click="emit('refresh')"
      >
        <template #prepend>
          <Icon icon="mdi:refresh" :class="{ 'spin-icon': props.isLoading || props.isRefreshing }" />
        </template>
        Обновить
      </KitBtn>
    </div>
  </header>
</template>

<style scoped lang="scss">
.activity-tracking-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--p-m);
  flex-wrap: wrap;

  @include media-down(sm) {
    flex-direction: column;
    gap: var(--p-s);
  }

  .header-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .title-with-badge {
    display: flex;
    align-items: center;
    gap: var(--p-s);
  }

  .activity-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--fg-primary-color);

    .title-icon {
      color: var(--fg-accent-color);
      font-size: 1.8rem;
    }
  }

  .activity-desc {
    font-size: 0.88rem;
    margin: 0;
    color: var(--fg-secondary-color);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--p-s);
    flex-wrap: wrap;

    @include media-down(sm) {
      width: 100%;
      justify-content: space-between;
    }
  }

  .days-selector {
    display: flex;
    align-items: center;
    gap: 4px;
    background-color: var(--bg-secondary-color);
    padding: 3px;
    border-radius: var(--r-s);
    border: 1px solid var(--border-secondary-color);
  }
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
