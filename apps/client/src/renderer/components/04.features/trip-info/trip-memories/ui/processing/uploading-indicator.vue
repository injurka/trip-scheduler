<script setup lang="ts">
import type { IProcessingMemory } from '../../types'
import { Icon } from '@iconify/vue'
import UploadingProgressCard from './uploading-progress-card.vue'

interface Props {
  processingMemories: IProcessingMemory[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'cancel', tempId: string): void
  (e: 'retry', tempId: string): void
  (e: 'remove', tempId: string): void
}>()

const currentUpload = computed(() => props.processingMemories.find(m => m.status === 'uploading'))
const queuedUploads = computed(() => props.processingMemories.filter(m => m.status === 'queued'))
const failedUploads = computed(() => props.processingMemories.filter(m => m.status === 'error'))
</script>

<template>
  <div class="upload-indicator-wrapper">
    <div v-if="currentUpload" class="current-upload-section">
      <UploadingProgressCard
        :memory="currentUpload"
        @cancel="emit('cancel', currentUpload!.tempId)"
      />
    </div>

    <div v-if="queuedUploads.length > 0" class="queued-section">
      <div class="queued-header">
        <Icon icon="mdi:timer-outline" />
        <span>В очереди: {{ queuedUploads.length }}</span>
      </div>
      <div class="queued-grid">
        <div
          v-for="item in queuedUploads"
          :key="item.tempId"
          class="queued-item"
        >
          <video
            v-if="item.file.type.startsWith('video/')"
            :src="item.previewUrl"
            muted
            playsinline
          />
          <img v-else :src="item.previewUrl" alt="В очереди">
        </div>
      </div>
    </div>

    <div v-if="failedUploads.length > 0" class="failed-section">
      <div class="failed-header">
        <Icon icon="mdi:alert-circle-outline" />
        <span>Ошибки загрузки: {{ failedUploads.length }}</span>
      </div>
      <div class="failed-grid">
        <UploadingProgressCard
          v-for="item in failedUploads"
          :key="item.tempId"
          :memory="item"
          @retry="emit('retry', item.tempId)"
          @remove="emit('remove', item.tempId)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.upload-indicator-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.current-upload-section,
.queued-section,
.failed-section {
  padding: 16px;
  border-radius: var(--r-m);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
}

.queued-header,
.failed-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  margin-bottom: 12px;
  color: var(--fg-secondary-color);

  white-space: nowrap;

  > .iconify {
    flex-shrink: 0;
  }
}

.failed-header {
  color: var(--fg-error-color);
}

.queued-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(50px, 100%), 1fr));
  gap: 8px;
}

.queued-item {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--r-s);
  overflow: hidden;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-primary-color);

  img,
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.failed-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
  gap: 16px;
}
</style>
