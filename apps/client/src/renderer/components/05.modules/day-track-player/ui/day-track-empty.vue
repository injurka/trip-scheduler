<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'

defineProps<{
  selectedDay: string
  todayUtc: string
}>()

const emit = defineEmits<{
  (e: 'goToToday'): void
  (e: 'goToList'): void
}>()
</script>

<template>
  <div class="empty-track-overlay">
    <div class="empty-card">
      <div class="empty-icon-wrap">
        <Icon icon="mdi:map-marker-off-outline" class="icon" />
      </div>
      <h3>Нет маршрута за этот день</h3>
      <p>В этот день координаты не сохранялись или устройство находилось в покое.</p>
      <div class="empty-actions">
        <KitBtn
          v-if="selectedDay !== todayUtc"
          variant="tonal"
          size="sm"
          @click="emit('goToToday')"
        >
          Перейти к сегодняшнему дню
        </KitBtn>
        <KitBtn
          variant="outlined"
          size="sm"
          @click="emit('goToList')"
        >
          К списку активности
        </KitBtn>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.empty-track-overlay {
  position: absolute;
  inset: 70px 14px 14px 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;

  .empty-card {
    pointer-events: auto;
    background-color: var(--bg-secondary-color);
    backdrop-filter: blur(14px);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-l);
    padding: 24px;
    max-width: 380px;
    text-align: center;
    box-shadow: var(--s-l);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;

    .empty-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: var(--r-full);
      background-color: var(--bg-tertiary-color);
      display: flex;
      align-items: center;
      justify-content: center;

      .icon {
        font-size: 1.8rem;
        opacity: 0.6;
      }
    }

    h3 {
      font-size: 1.05rem;
      font-weight: 600;
      margin: 0;
      color: var(--fg-primary-color);
    }

    p {
      font-size: 0.82rem;
      line-height: 1.4;
      margin: 0;
      color: var(--fg-secondary-color);
    }

    .empty-actions {
      display: flex;
      gap: 8px;
      margin-top: 6px;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>
