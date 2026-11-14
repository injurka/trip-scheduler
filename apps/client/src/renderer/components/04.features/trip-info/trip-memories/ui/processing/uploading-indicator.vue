<script setup lang="ts">
import type { IProcessingMemory } from '../../types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'

interface Props {
  processingMemories: IProcessingMemory[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'cancel', tempId: string): void
  (e: 'retry', tempId: string): void
  (e: 'remove', tempId: string): void
  (e: 'retryAll'): void
}>()

const currentUpload = computed(() => props.processingMemories.find(m => m.status === 'uploading'))
const queuedUploads = computed(() => props.processingMemories.filter(m => m.status === 'queued'))
const failedUploads = computed(() => props.processingMemories.filter(m => m.status === 'error'))
const totalCount = computed(() => props.processingMemories.length)
const queuedCount = computed(() => queuedUploads.value.length)
const failedCount = computed(() => failedUploads.value.length)
const activeProgressStyle = computed(() => ({
  '--upload-progress': `${currentUpload.value?.progress ?? 0}%`,
}))

function formatPlural(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const abs = Math.abs(n) % 100
  const rem = abs % 10

  if (abs > 10 && abs < 20)
    return many

  if (rem > 1 && rem < 5)
    return few

  if (rem === 1)
    return one

  return many
}
function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0)
    return '0 Б'

  if (bytes < 1024)
    return `${bytes} Б`

  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} КБ`

  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`
}
function handleRetryAll() {
  emit('retryAll')

  for (const item of failedUploads.value) {
    emit('retry', item.tempId)
  }
}
</script>

<template>
  <div class="upload-manager">
    <div class="expanded-box">
      <!-- 1. Header -->
      <div class="manager-header">
        <div class="header-left">
          <div class="header-icon-wrap">
            <Icon icon="mdi:cloud-upload-outline" class="manager-icon" />
          </div>
          <h3 class="manager-title">
            Загрузка медиа
          </h3>
        </div>
        <div class="header-right">
          <span class="badge-pill">
            {{ totalCount }} {{ formatPlural(totalCount, 'файл', 'файла', 'файлов') }}
          </span>
        </div>
      </div>

      <!-- 2. Queue and Error Summary -->
      <div class="manager-stats-row">
        <div class="stat-col">
          <div class="stat-value">
            {{ queuedCount }}
          </div>
          <div class="stat-label">
            В очереди
          </div>
        </div>
        <div class="stat-col" :class="{ 'stat-error': failedCount > 0 }">
          <div class="stat-value">
            {{ failedCount }}
          </div>
          <div class="stat-label">
            Ошибки
          </div>
        </div>
      </div>

      <div class="manager-divider" />

      <!-- 3. Active Upload (most prominent) -->
      <div v-if="currentUpload" class="active-upload-section">
        <div class="active-upload-row">
          <div class="active-thumbnail">
            <video
              v-if="currentUpload.file.type.startsWith('video/')"
              :src="currentUpload.previewUrl"
              muted
              playsinline
            />
            <img
              v-else-if="currentUpload.previewUrl"
              :src="currentUpload.previewUrl"
              :alt="currentUpload.file.name"
            >
            <Icon v-else icon="mdi:image-outline" class="fallback-icon" />
          </div>

          <div class="active-details">
            <KitTooltip :text="currentUpload.file.name" class="active-name-tooltip">
              <span class="active-filename">{{ currentUpload.file.name }}</span>
            </KitTooltip>
            <span class="active-meta">
              {{ currentUpload.uploadedImage ? 'Обработка' : 'Загрузка' }} · {{ formatFileSize(currentUpload.file.size) }}
            </span>
          </div>

          <div class="active-actions">
            <span class="active-progress-text">{{ currentUpload.progress }}%</span>
            <KitTooltip text="Отменить">
              <button
                class="action-icon-btn cancel-btn"
                type="button"
                @click="emit('cancel', currentUpload!.tempId)"
              >
                <Icon icon="mdi:close" />
              </button>
            </KitTooltip>
          </div>
        </div>

        <div class="active-progress-track">
          <div class="active-progress-fill" :style="activeProgressStyle" />
        </div>
      </div>

      <!-- 4. Queue Section -->
      <div v-if="queuedCount > 0" class="queue-section">
        <div class="section-header">
          <span class="section-title">Ожидают загрузки</span>
          <span class="section-subtitle">{{ queuedCount }} {{ formatPlural(queuedCount, 'файл', 'файла', 'файлов') }}</span>
        </div>

        <!-- Expanded Queue Grid -->
        <div class="queue-expanded-box">
          <div class="queue-expanded-grid">
            <div
              v-for="item in queuedUploads"
              :key="item.tempId"
              class="queue-expanded-item"
            >
              <KitTooltip :text="`${item.file.name} (${formatFileSize(item.file.size)})`" class="queue-thumb-tooltip">
                <div class="queue-thumb-box">
                  <video
                    v-if="item.file.type.startsWith('video/')"
                    :src="item.previewUrl"
                    muted
                    playsinline
                  />
                  <img
                    v-else-if="item.previewUrl"
                    :src="item.previewUrl"
                    :alt="item.file.name"
                  >
                  <Icon v-else icon="mdi:image-outline" class="fallback-icon" />
                </div>
              </KitTooltip>
              <button
                class="queue-remove-btn"
                type="button"
                title="Удалить из очереди"
                @click.stop="emit('remove', item.tempId)"
              >
                <Icon icon="mdi:close" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. Error Section -->
      <div v-if="failedCount > 0" class="errors-section">
        <div class="section-header">
          <div class="errors-title-wrap">
            <Icon icon="mdi:alert-circle-outline" class="error-icon" />
            <span class="section-title">Ошибки загрузки · {{ failedCount }}</span>
          </div>
        </div>

        <div class="errors-list">
          <div
            v-for="item in failedUploads"
            :key="item.tempId"
            class="error-card"
          >
            <div class="error-card-thumb">
              <video
                v-if="item.file.type.startsWith('video/')"
                :src="item.previewUrl"
                muted
                playsinline
              />
              <img
                v-else-if="item.previewUrl"
                :src="item.previewUrl"
                :alt="item.file.name"
              >
              <Icon v-else icon="mdi:image-outline" class="error-fallback-icon" />
            </div>

            <div class="error-card-details">
              <KitTooltip :text="item.file.name" class="error-name-tooltip">
                <span class="error-card-name">{{ item.file.name }}</span>
              </KitTooltip>
              <span class="error-card-msg">{{ item.error || 'Сетевая ошибка' }}</span>
            </div>

            <div class="error-card-actions">
              <KitTooltip text="Повторить">
                <button
                  class="action-icon-btn retry-btn"
                  type="button"
                  @click="emit('retry', item.tempId)"
                >
                  <Icon icon="mdi:refresh" />
                </button>
              </KitTooltip>
              <KitTooltip text="Удалить">
                <button
                  class="action-icon-btn remove-btn"
                  type="button"
                  @click="emit('remove', item.tempId)"
                >
                  <Icon icon="mdi:trash-can-outline" />
                </button>
              </KitTooltip>
            </div>
          </div>
        </div>
      </div>

      <!-- 6. Bottom Controls -->
      <div v-if="failedCount > 0" class="manager-footer-controls">
        <button
          v-if="failedCount > 0"
          class="footer-btn retry-all-btn"
          type="button"
          @click="handleRetryAll"
        >
          <span>Повторить ошибки</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.upload-manager {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l, 16px);
  overflow: hidden;
  transition: all 0.25s ease;
  width: 100%;
  box-sizing: border-box;
}

// Expanded View
.expanded-box {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  @media (max-width: 768px) {
    padding: 16px;
    gap: 16px;
  }
}

// 1. Header
.manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-left {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;

  .manager-icon {
    font-size: 1.45rem;
    color: var(--fg-accent-color);
  }
}

.manager-title {
  overflow-wrap: anywhere;
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  letter-spacing: -0.01em;
}

.badge-pill {
  flex-shrink: 0;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: var(--r-full);
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid var(--border-secondary-color);
}

// 2. Stats Summary
.manager-stats-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  text-align: center;
}

.stat-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px 0;

  &.stat-error .stat-value {
    color: var(--fg-error-color);
  }
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--fg-primary-color);
  letter-spacing: -0.02em;

  @media (max-width: 768px) {
    font-size: 1.35rem;
  }
}

.stat-label {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  margin-top: 4px;
}

.manager-divider {
  width: 100%;
  height: 1px;
  background-color: var(--border-secondary-color);
  opacity: 0.6;
}

// 3. Active Upload
.active-upload-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.active-upload-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.active-thumbnail {
  width: 56px;
  height: 56px;
  border-radius: var(--r-m, 12px);
  overflow: hidden;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  img,
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .fallback-icon {
    font-size: 1.5rem;
    color: var(--fg-secondary-color);
  }

  @media (max-width: 768px) {
    width: 48px;
    height: 48px;
  }
}

.active-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: 4px;
}

.active-name-tooltip {
  min-width: 0;
  width: 100%;

  :deep(.kit-tooltip-trigger) {
    width: 100%;
    display: block;
    overflow: hidden;
  }
}

.active-filename {
  display: block;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.active-meta {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
}

.active-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.active-progress-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.action-icon-btn {
  all: unset;
  width: 28px;
  height: 28px;
  border-radius: var(--r-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: var(--bg-tertiary-color);
    color: var(--fg-primary-color);
  }

  &.cancel-btn {
    font-size: 1.15rem;

    &:hover {
      color: var(--fg-error-color);
    }
  }

  &.retry-btn:hover {
    color: var(--fg-accent-color);
  }

  &.remove-btn:hover {
    color: var(--fg-error-color);
  }
}

.active-progress-track {
  width: 100%;
  height: 4px;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-full);
  overflow: hidden;
}

.active-progress-fill {
  width: var(--upload-progress, 0%);
  height: 100%;
  background-color: var(--fg-accent-color);
  border-radius: var(--r-full);
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

// 4. Queue Section
.queue-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.section-subtitle {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
}

.queue-thumb-tooltip {
  display: block;
}

.queue-thumb-box {
  width: 52px;
  height: 52px;
  border-radius: var(--r-m, 12px);
  overflow: hidden;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;

  img,
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .fallback-icon {
    font-size: 1.3rem;
    color: var(--fg-secondary-color);
  }

  @media (max-width: 768px) {
    width: 44px;
    height: 44px;
    border-radius: var(--r-s, 8px);
  }
}

.queue-expanded-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.queue-expanded-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding-right: 4px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  }
}

.queue-expanded-item {
  position: relative;

  &:hover .queue-remove-btn {
    opacity: 1;
    pointer-events: auto;
  }
}

.queue-remove-btn {
  all: unset;
  position: absolute;
  top: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  border-radius: var(--r-full);
  background-color: var(--bg-error-color);
  color: var(--fg-error-color);
  border: 1px solid var(--border-error-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;

  @media (max-width: 768px) {
    opacity: 0.85;
    pointer-events: auto;
  }
}

// 5. Error Section
.errors-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.errors-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;

  .error-icon {
    font-size: 1.15rem;
    color: var(--fg-error-color);
  }
}

.errors-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
}

.error-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m, 12px);
  overflow: hidden;
}

.error-card-thumb {
  width: 40px;
  height: 40px;
  border-radius: var(--r-s, 8px);
  overflow: hidden;
  background-color: var(--bg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  img,
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .error-fallback-icon {
    font-size: 1.2rem;
    color: var(--fg-secondary-color);
  }
}

.error-card-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.error-name-tooltip {
  min-width: 0;
  width: 100%;

  :deep(.kit-tooltip-trigger) {
    width: 100%;
    display: block;
    overflow: hidden;
  }
}

.error-card-name {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-primary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.error-card-msg {
  font-size: 0.8rem;
  color: var(--fg-error-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.error-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

// 6. Bottom Controls
.manager-footer-controls {
  display: flex;
  gap: 12px;
  margin-top: 4px;

  @media (max-width: 480px) {
    flex-direction: column;
    gap: 8px;
  }
}

.footer-btn {
  all: unset;
  flex: 1;
  height: 44px;
  border-radius: var(--r-m, 12px);
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--fg-primary-color);
  cursor: pointer;
  transition: all 0.2s;
  box-sizing: border-box;

  &:hover {
    background-color: var(--bg-hover-color);
    border-color: var(--border-primary-color);
  }

  &.retry-all-btn {
    border-color: var(--border-secondary-color);

    &:hover {
      border-color: var(--fg-accent-color);
      color: var(--fg-accent-color);
    }
  }
}

@keyframes pulse-glow {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.95);
  }
}
</style>
