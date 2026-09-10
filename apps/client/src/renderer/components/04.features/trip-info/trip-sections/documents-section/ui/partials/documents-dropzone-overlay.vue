<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  folderName: string | null
}>()
</script>

<template>
  <div class="dropzone-overlay">
    <div class="dropzone-content">
      <Icon icon="mdi:cloud-upload-outline" width="64" height="64" class="drop-icon" />
      <h3>Отпустите файлы для загрузки</h3>
      <p>
        {{ folderName ? `В папку: «${folderName}»` : 'В общие документы' }}
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dropzone-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(var(--bg-primary-color-rgb), 0.88);
  backdrop-filter: blur(4px);
  border: 2px dashed var(--fg-accent-color);
  border-radius: var(--r-m);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  pointer-events: none;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.dropzone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  color: var(--fg-accent-color);

  .drop-icon {
    animation: bounce 1s infinite alternate;
  }

  h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
  }
}

@keyframes bounce {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-8px);
  }
}
</style>
