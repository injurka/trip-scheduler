<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface DownloadProgress {
  current: number
  total: number
  loadedBytes: number
  isDownloading: boolean
}

const props = defineProps<{
  progress: DownloadProgress
}>()

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0)
    return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}

const downloadPercentage = computed(() => {
  if (!props.progress.total)
    return 0
  return Math.round((props.progress.current / props.progress.total) * 100)
})
</script>

<template>
  <Transition name="slide-down">
    <div v-if="progress.isDownloading" class="download-status-banner">
      <div class="banner-content">
        <div class="banner-info">
          <div class="info-main">
            <Icon icon="mdi:folder-download-outline" class="info-icon spin" />
            <span class="info-title">Скачивание оригиналов</span>
          </div>
          <div class="info-stats">
            <span class="stat-item">{{ progress.current }} / {{ progress.total }} фото</span>
            <span class="stat-separator">•</span>
            <span class="stat-item">{{ formatBytes(progress.loadedBytes) }}</span>
          </div>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" :style="{ width: `${downloadPercentage}%` }" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.download-status-banner {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 12px 16px;
  margin-bottom: 16px;
  box-shadow: var(--s-m);
}

.banner-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.banner-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.info-main {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-accent-color);
  font-weight: 600;
  font-size: 0.95rem;
}

.info-icon {
  font-size: 1.2rem;
}

.info-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  font-family: var(--font-mono);
}

.stat-separator {
  opacity: 0.5;
}

.progress-bar-bg {
  width: 100%;
  height: 6px;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-full);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background-color: var(--fg-accent-color);
  border-radius: var(--r-full);
  transition: width 0.3s ease;
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

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  margin-bottom: -50px;
}
</style>
