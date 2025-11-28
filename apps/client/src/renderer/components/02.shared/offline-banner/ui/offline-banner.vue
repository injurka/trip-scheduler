<script setup lang="ts">
import { useOnline } from '@vueuse/core'
import { computed } from 'vue'
import { useDataTimestamp } from '~/shared/composables/use-data-timestamp'

const isOnline = useOnline()
const { lastDataTimestamp } = useDataTimestamp()

const formattedDate = computed(() => {
  if (!lastDataTimestamp.value)
    return null

  const date = new Date(lastDataTimestamp.value)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  if (isToday) {
    return `${timeStr}`
  }
  else {
    const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    return `${dateStr} в ${timeStr}`
  }
})
</script>

<template>
  <Transition name="slide-down">
    <div v-if="!isOnline" class="offline-banner">
      <div class="banner-content">
        <div class="main-info">
          <span>Нет соединения</span>
        </div>

        <div v-if="formattedDate" class="cache-badge">
          <svg class="badge-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z" />
          </svg>
          <span>Обновлено: {{ formattedDate }}</span>
        </div>
        <div v-else class="cache-badge">
          <span>Из кеша</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.offline-banner {
  position: relative;
  width: 100%;
  z-index: 9999;
  background-color: var(--fg-warning-color);
  color: var(--bg-primary-color);
  display: flex;
  justify-content: center;
  padding: 6px 16px;
  padding-top: calc(6px + env(safe-area-inset-top));
}

.banner-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  max-width: 1200px;
  flex-wrap: wrap;
  width: 100%;
}

.main-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 0.95rem;
  white-space: nowrap;
}

.cache-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  background-color: rgba(255, 255, 255, 0.2);
  padding: 2px 10px;
  border-radius: 12px;
  white-space: nowrap;
}

.icon {
  width: 1.2rem;
  height: 1.2rem;
  flex-shrink: 0;
}

.badge-icon {
  width: 0.9rem;
  height: 0.9rem;
  opacity: 0.9;
  flex-shrink: 0;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  max-height: 100px;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

@media (max-width: 600px) {
  .banner-content {
    justify-content: space-between;
  }
}
</style>
