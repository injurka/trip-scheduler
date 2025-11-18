<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { KitEditable } from '~/components/01.kit/kit-editable'

interface Props {
  icon: string
  readonly: boolean
}

defineProps<Props>()
const emit = defineEmits<{ (e: 'delete'): void }>()
const title = defineModel<string>('title', { required: true })
const confirm = useConfirm()

const isDetailsVisible = ref(false)

function showVisibleIfClose() {
  if (!isDetailsVisible.value)
    isDetailsVisible.value = !isDetailsVisible.value
}

async function handleDelete() {
  const isConfirmed = await confirm({
    title: 'Подтвердите удаление',
    description: 'Вы уверены, что хотите удалить это бронирование? Это действие необратимо.',
    confirmText: 'Удалить',
    type: 'danger',
  })
  if (isConfirmed) {
    emit('delete')
  }
}
</script>

<template>
  <div class="booking-card">
    <header class="card-header">
      <div class="title-container">
        <button v-if="!readonly" class="drag-handle" title="Перетащить">
          <Icon icon="mdi:drag-vertical" />
        </button>
        <Icon :icon="icon" class="title-icon" />
        <KitEditable
          v-model="title"
          :readonly="readonly"
          class="card-title"
          placeholder="Введите заголовок"
        />
      </div>
      <div class="card-actions">
        <button v-if="$slots.details" class="details-btn" title="Подробнее" @click="isDetailsVisible = !isDetailsVisible">
          <Icon :icon="isDetailsVisible ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
        </button>
        <button v-if="!readonly" class="delete-btn" title="Удалить" @click="handleDelete">
          <Icon icon="mdi:trash-can-outline" />
        </button>
      </div>
    </header>
    <div class="card-body" @click="showVisibleIfClose">
      <slot />

      <template v-if="$slots.details">
        <Transition name="fade-height">
          <div v-if="isDetailsVisible" class="details-content">
            <slot name="details" />
          </div>
        </Transition>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.booking-card {
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-m);
  border: 1px solid var(--border-primary-color);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: var(--s-m);
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background-color: var(--bg-tertiary-color);
  border-bottom: 1px solid var(--border-secondary-color);
}

.title-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-grow: 1;
  min-width: 0;
}

.title-icon {
  font-size: 1.25rem;
  color: var(--fg-secondary-color);
  flex-shrink: 0;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.card-actions button {
  color: var(--fg-tertiary-color);
  font-size: 1.1rem;
  transition: all 0.2s ease;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }
}

.delete-btn {
  svg {
    color: var(--fg-error-color);
  }
}

.drag-handle {
  color: var(--fg-tertiary-color);
  font-size: 1.1rem;
  cursor: grab;
  &:active {
    cursor: grabbing;
  }
}

.card-body {
  padding: 0.75rem 1rem;
}

.details-content {
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.fade-height-enter-active,
.fade-height-leave-active {
  transition: all 0.3s ease-in-out;
  overflow: hidden;
}
.fade-height-enter-from,
.fade-height-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  margin-top: 0;
}
.fade-height-enter-to,
.fade-height-leave-from {
  opacity: 1;
  max-height: 1000px;
}
</style>
