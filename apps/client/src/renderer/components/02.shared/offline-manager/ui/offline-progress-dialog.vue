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

const downloadStatus = computed(() => {
  if (!activeDownloadId.value)
    return null
  return offlineStore.getDownloadStatus(activeDownloadId.value)
})

const progress = computed(() => {
  if (!activeDownloadId.value)
    return 0
  return offlineStore.getDownloadProgress(activeDownloadId.value)
})

const isCompleted = computed(() => progress.value >= 100 && downloadStatus.value?.stage === 'completed')

const tripTitle = computed(() => {
  if (!activeDownloadId.value)
    return 'Путешествие'
  const saved = offlineStore.savedTrips[activeDownloadId.value]
  if (saved)
    return saved.title

  return 'Загрузка данных...'
})

const statusText = computed(() => {
  if (downloadStatus.value?.statusText)
    return downloadStatus.value.statusText
  return 'Кэширование изображений и данных...'
})

function handleRunInBackground() {
  isMinimized.value = true
}
</script>

<template>
  <KitDialogWithClose
    :visible="isVisible"
    title="Сохранение оффлайн"
    :icon="isCompleted ? 'mdi:check-circle-outline' : 'mdi:cloud-download-outline'"
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
          {{ statusText }}
        </p>
      </div>

      <div class="progress-bar-wrapper">
        <div class="progress-track">
          <div
            class="progress-fill"
            :class="{ 'is-complete': isCompleted }"
            :style="{ width: `${progress}%` }"
          />
        </div>
        <span class="progress-value">{{ progress }}%</span>
      </div>

      <div v-if="downloadStatus && downloadStatus.total > 0" class="files-counter">
        <Icon icon="mdi:image-multiple-outline" class="counter-icon" />
        <span>{{ downloadStatus.loaded }} из {{ downloadStatus.total }} файлов сохранено</span>
      </div>

      <div v-if="!isCompleted" class="warning-box">
        <Icon icon="mdi:information-outline" />
        <p>Пожалуйста, не закрывайте приложение до завершения загрузки.</p>
      </div>

      <div v-else class="success-box">
        <Icon icon="mdi:check-circle-outline" />
        <p>Путешествие готово к использованию без интернета!</p>
      </div>

      <div class="actions">
        <KitBtn variant="text" size="sm" @click="handleRunInBackground">
          {{ isCompleted ? 'Закрыть' : 'Свернуть в фон' }}
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.progress-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 12px 0 4px;
}

.info {
  text-align: center;
  .trip-name {
    margin: 0 0 6px;
    font-size: 1.15rem;
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

  &.is-complete {
    background-color: var(--fg-success-color);
  }
}

.progress-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  min-width: 44px;
  text-align: right;
}

.files-counter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  margin-top: -8px;

  .counter-icon {
    font-size: 1rem;
  }
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

.success-box {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background-color: rgba(var(--fg-success-color-rgb), 0.1);
  padding: 12px;
  border-radius: var(--r-s);
  color: var(--fg-success-color);

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
}
</style>
