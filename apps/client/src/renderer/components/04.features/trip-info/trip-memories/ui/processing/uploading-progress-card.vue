<script setup lang="ts">
import type { IProcessingMemory } from '~/components/04.features/trip-info/trip-memories/store'
import { Icon } from '@iconify/vue'

interface Props {
  memory: IProcessingMemory
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'retry'): void
  (e: 'remove'): void
}>()
</script>

<template>
  <div class="uploading-progress-card" :class="`status-${memory.status}`">
    <div class="thumbnail">
      <img :src="memory.previewUrl" alt="preview">
    </div>
    <div class="details">
      <div class="file-info">
        <span class="file-name" :title="memory.file.name">{{ memory.file.name }}</span>
        <span class="file-size">{{ (memory.file.size / 1024 / 1024).toFixed(2) }} MB</span>
      </div>

      <div v-if="memory.status === 'uploading'" class="progress-bar">
        <div class="progress-bar-fill" :style="{ width: `${memory.progress}%` }" />
      </div>

      <div v-if="memory.status === 'error'" class="error-info">
        <Icon icon="mdi:alert-circle-outline" />
        <span>{{ memory.error || 'Неизвестная ошибка' }}</span>
      </div>
    </div>
    <div class="actions">
      <span v-if="memory.status === 'uploading'" class="progress-text">{{ memory.progress }}%</span>
      <button v-if="memory.status === 'uploading'" class="action-btn" title="Отменить" @click="emit('cancel')">
        <Icon icon="mdi:close" />
      </button>
      <button v-if="memory.status === 'error'" class="action-btn retry" title="Повторить" @click="emit('retry')">
        <Icon icon="mdi:refresh" />
      </button>
      <button v-if="memory.status === 'error'" class="action-btn remove" title="Удалить" @click="emit('remove')">
        <Icon icon="mdi:trash-can-outline" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.uploading-progress-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-m);
  border: 1px solid transparent;

  &.status-error {
    background-color: var(--bg-error-color);
    border-color: var(--border-error-color);
    .file-name {
      color: var(--fg-error-color);
    }
  }
}

.thumbnail {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: var(--r-s);
  overflow: hidden;
  background-color: var(--bg-secondary-color);
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.details {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.file-info {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.file-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  flex-shrink: 0;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: var(--border-secondary-color);
  border-radius: var(--r-full);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background-color: var(--fg-accent-color);
  border-radius: var(--r-full);
  transition: width 0.2s linear;
}

.error-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--fg-error-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-text {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &.retry:hover {
    color: var(--fg-success-color);
  }

  &.remove:hover {
    color: var(--fg-error-color);
  }
}
</style>
