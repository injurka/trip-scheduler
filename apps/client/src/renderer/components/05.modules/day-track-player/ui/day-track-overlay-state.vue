<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'

defineProps<{
  isLoading: boolean
  loadError: string | null
  selectedDay: string
}>()

const emit = defineEmits<{
  (e: 'retry', day: string): void
}>()
</script>

<template>
  <!-- Оверлей загрузки -->
  <div v-if="isLoading" class="memories-overlay">
    <div class="overlay-card">
      <Icon icon="mdi:loading" class="spin overlay-icon" />
      <span>Загрузка данных дня…</span>
    </div>
  </div>

  <!-- Оверлей ошибки -->
  <div v-else-if="loadError" class="memories-overlay">
    <div class="overlay-card is-error">
      <Icon icon="mdi:alert-circle-outline" class="overlay-icon" />
      <span>{{ loadError }}</span>
      <KitBtn size="xs" variant="outlined" @click="emit('retry', selectedDay)">
        Повторить
      </KitBtn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.memories-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  z-index: 15;

  .overlay-card {
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    padding: 16px 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: var(--s-l);
    color: var(--fg-primary-color);

    .overlay-icon {
      font-size: 1.5rem;
    }

    &.is-error {
      color: #ef5350;
      flex-direction: column;
    }
  }
}

.spin {
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
