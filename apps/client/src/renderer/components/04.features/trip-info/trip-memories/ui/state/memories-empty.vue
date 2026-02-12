<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'

interface Props {
  isViewMode: boolean
}
defineProps<Props>()

const emit = defineEmits<{
  (e: 'upload'): void
  (e: 'addNote'): void
  (e: 'addActivity'): void
}>()
</script>

<template>
  <div class="memories-empty">
    <div class="empty-content">
      <Icon icon="mdi:camera-iris" class="empty-icon" />
      <p class="empty-title">
        В этом дне пока нет воспоминаний
      </p>
      <p v-if="!isViewMode" class="empty-description">
        Загрузите фотографии или добавьте заметки, чтобы создать ленту дня.
      </p>
      <p v-else class="empty-description">
        Автор пока не добавил ничего в этот день.
      </p>

      <div v-if="!isViewMode" class="actions">
        <KitBtn icon="mdi:camera-plus-outline" @click="emit('upload')">
          Загрузить фото
        </KitBtn>
        <div class="secondary-actions">
          <KitBtn variant="outlined" color="secondary" icon="mdi:plus-box-outline" @click="emit('addActivity')">
            Активность
          </KitBtn>
          <KitBtn variant="outlined" color="secondary" icon="mdi:note-plus-outline" @click="emit('addNote')">
            Заметка
          </KitBtn>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.memories-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  padding: 24px;
  margin-top: 16px;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 400px;
  background-color: var(--bg-secondary-color);
  padding: 48px 32px;
  border-radius: var(--r-l);
  border: 2px dashed var(--border-secondary-color);
}

.empty-icon {
  font-size: 4rem;
  color: var(--fg-tertiary-color);
  margin-bottom: 24px;
  opacity: 0.5;
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  margin: 0 0 8px;
}

.empty-description {
  font-size: 1rem;
  color: var(--fg-secondary-color);
  margin: 0 0 32px;
  line-height: 1.5;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.secondary-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  width: 100%;

  .kit-btn {
    flex: 1;
  }
}
</style>
