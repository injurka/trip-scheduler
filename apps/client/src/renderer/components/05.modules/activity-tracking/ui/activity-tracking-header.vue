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
  (e: 'openMemories'): void
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

      <div class="right-actions">
        <KitBtn
          variant="tonal"
          size="xs"
          class="refresh-btn"
          :disabled="props.isLoading || props.isRefreshing"
          title="Обновить"
          aria-label="Обновить"
          @click="emit('refresh')"
        >
          <Icon icon="mdi:refresh" :class="{ 'spin-icon': props.isLoading || props.isRefreshing }" />
        </KitBtn>

        <KitBtn
          variant="solid"
          size="xs"
          color="primary"
          class="memories-btn"
          @click="emit('openMemories')"
        >
          <template #prepend>
            <Icon icon="mdi:movie-open-play-outline" />
          </template>
          Воспоминания
        </KitBtn>
      </div>
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
    width: 100%;
    justify-content: space-between;

    @include media-down(sm) {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }

    .right-actions {
      display: flex;
      align-items: center;
      gap: var(--p-s);

      @include media-down(sm) {
        width: 100%;
        gap: 8px;
      }
    }

    .refresh-btn {
      height: 34px;
      width: 34px;
      padding: 0 !important;
      transform: none !important;
      box-shadow: none;
      flex-shrink: 0;

      @include media-down(sm) {
        height: 38px;
        width: 38px;
        border-radius: var(--r-s);
      }

      &:hover,
      &:active,
      &:focus,
      &:focus-visible {
        transform: none !important;
        box-shadow: none;
      }
    }

    .memories-btn {
      height: 34px;
      transform: none !important;

      @include media-down(sm) {
        flex: 1;
        height: 38px;
        border-radius: var(--r-s);
        font-size: 0.85rem;
      }

      &:hover,
      &:active,
      &:focus,
      &:focus-visible {
        transform: none !important;
      }
    }
  }

  .days-selector {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background-color: var(--bg-secondary-color);
    padding: 3px;
    border-radius: var(--r-s);
    border: 1px solid var(--border-secondary-color);
    height: 34px;
    box-sizing: border-box;

    @include media-down(sm) {
      width: 100%;
      height: 38px;
      display: flex;
    }

    :deep(.kit-btn) {
      height: 100%;
      padding: 0 12px;
      font-size: 0.8rem;
      border: none;
      box-shadow: none !important;
      transform: none !important;
      white-space: nowrap;
      transition:
        background-color 0.15s ease,
        color 0.15s ease,
        opacity 0.15s ease;

      @include media-down(sm) {
        flex: 1;
        padding: 0 4px;
        font-size: 0.8125rem;
        justify-content: center;
      }

      &:hover,
      &:active,
      &:focus,
      &:focus-visible {
        transform: none !important;
        box-shadow: none !important;
      }
    }
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
