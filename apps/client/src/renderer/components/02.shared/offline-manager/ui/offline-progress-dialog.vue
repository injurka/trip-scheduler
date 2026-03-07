<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { useOfflineStore } from '~/shared/store/offline.store'

const offlineStore = useOfflineStore()
const isMinimized = ref(false)

const activeDownloadId = computed(() => {
  const ids = Object.keys(offlineStore.isDownloading)
  return ids.find(id => offlineStore.isDownloading[id])
})

const isVisible = computed(() => !!activeDownloadId.value && !isMinimized.value)

watch(activeDownloadId, (newVal) => {
  if (!newVal) {
    isMinimized.value = false
  }
})

const progress = computed(() => {
  if (!activeDownloadId.value)
    return 0
  return offlineStore.getDownloadProgress(activeDownloadId.value)
})

const tripTitle = computed(() => {
  if (!activeDownloadId.value)
    return 'Путешествие'
  const saved = offlineStore.savedTrips[activeDownloadId.value]
  if (saved)
    return saved.title

  return 'Загрузка данных...'
})

function handleRunInBackground() {
  isMinimized.value = true
}
</script>

<template>
  <KitDialogWithClose
    :visible="isVisible"
    title="Сохранение оффлайн"
    icon="mdi:cloud-download-outline"
    :max-width="450"
    :close-on-overlay-click="false"
    @update:visible="val => { if (!val) handleRunInBackground() }"
  >
    <div class="progress-content">
      <div class="info">
        <h4 class="trip-name">
          {{ tripTitle }}
        </h4>
        <p class="status-text">
          Кэширование изображений и данных...
        </p>
      </div>

      <div class="progress-bar-wrapper">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${progress}%` }" />
        </div>
        <span class="progress-value">{{ progress }}%</span>
      </div>

      <div class="warning-box">
        <Icon icon="mdi:information-outline" />
        <p>Пожалуйста, не закрывайте приложение до завершения загрузки.</p>
      </div>

      <div class="actions">
        <KitBtn variant="text" size="sm" @click="handleRunInBackground">
          Свернуть в фон
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.progress-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 16px 0;
}

.info {
  text-align: center;
  .trip-name {
    margin: 0 0 8px;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
  .status-text {
    margin: 0;
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
  }
}

.progress-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-track {
  flex-grow: 1;
  height: 8px;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--fg-accent-color);
  transition: width 0.3s ease;
  border-radius: var(--r-full);
}

.progress-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  min-width: 40px;
  text-align: right;
}

.warning-box {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background-color: rgba(var(--fg-info-color-rgb), 0.1);
  padding: 12px;
  border-radius: var(--r-s);
  color: var(--fg-info-color);

  .iconify {
    font-size: 1.2rem;
    flex-shrink: 0;
    margin-top: 2px;
  }

  p {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.4;
  }
}

.actions {
  display: flex;
  justify-content: center;
  margin-top: -8px;
}
</style>
