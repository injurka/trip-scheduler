<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useOnline } from '@vueuse/core'
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

  const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })

  return `${dateStr} в ${timeStr}`
})
</script>

<template>
  <Transition name="slide-down">
    <div v-if="!isOnline" class="offline-banner">
      <div class="banner-content">
        <div class="main-info">
          <span class="connection-label">Нет соединения</span>
          <Icon
            class="connection-icon"
            icon="mdi:wifi-off"
            role="img"
            aria-label="Нет соединения"
          />
        </div>

        <div class="read-only-badge">
          <Icon class="badge-icon" icon="mdi:lock" />
          <span>Режим чтения</span>
        </div>

        <div v-if="formattedDate" class="cache-badge">
          <Icon class="badge-icon" icon="mdi:clock-outline" />
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
  flex: 0 0 auto;
  width: 100%;
  height: var(--offline-banner-height, 40px);
  box-sizing: border-box;
  z-index: 9999;
  background-color: var(--fg-warning-color);
  color: var(--bg-primary-color);
  display: flex;
  justify-content: center;
  padding: 8px 16px;
}

.banner-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px 12px;
  max-width: 1200px;
  flex-wrap: nowrap;
  overflow: hidden;
  width: 100%;
}

.main-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 0.95rem;
  line-height: 1.4;
}

.connection-icon {
  display: none;
}

.read-only-badge,
.cache-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  background-color: rgba(255, 255, 255, 0.2);
  padding: 2px 10px;
  border-radius: 12px;
  min-width: 0;
  max-width: 100%;
  line-height: 1.4;
  overflow-wrap: anywhere;
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
  max-height: var(--offline-banner-height, 40px);
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
  .offline-banner {
    padding: 6px 8px;
  }

  .banner-content {
    gap: 4px;
  }

  .main-info {
    flex: 0 0 auto;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .connection-label {
    display: none;
  }

  .connection-icon {
    display: block;
    width: 1.25rem;
    height: 1.25rem;
  }

  .read-only-badge,
  .cache-badge {
    flex: 0 1 auto;
    padding: 2px 6px;
    gap: 4px;
    font-size: 0.6875rem;
    white-space: nowrap;
    overflow: hidden;
  }

  .read-only-badge span,
  .cache-badge span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
