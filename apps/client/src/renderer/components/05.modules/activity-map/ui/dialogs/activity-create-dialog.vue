<script setup lang="ts">
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'

interface Props {
  visible: boolean
  initialCoords: [number, number] | null
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'create', data: any): void
}>()

const form = ref({
  title: '',
  description: '',
  startAt: '',
  endAt: '',
  coords: null as [number, number] | null,
})

function toDateTimeLocal(date: Date): string {
  const d = new Date(date)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

watch(() => props.visible, (isOpen) => {
  if (isOpen) {
    const now = new Date()
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)

    form.value = {
      title: '',
      description: '',
      startAt: toDateTimeLocal(now),
      endAt: toDateTimeLocal(oneHourLater),
      coords: props.initialCoords,
    }
  }
})

function handleSave() {
  if (props.isLoading)
    return

  if (new Date(form.value.endAt) <= new Date(form.value.startAt)) {
    return
  }

  emit('create', form.value)
}

function handleUpdateVisible(value: boolean) {
  if (props.isLoading && !value)
    return

  emit('update:visible', value)
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Новая активность"
    icon="mdi:map-marker-plus"
    :max-width="450"
    @update:visible="handleUpdateVisible"
  >
    <div class="form-content" :class="{ 'is-loading': isLoading }">
      <KitInput
        v-model="form.title"
        label="Название"
        placeholder="Например: Обед"
        required
        :disabled="isLoading"
      />

      <div class="dates-row">
        <KitInput
          v-model="form.startAt"
          type="datetime-local"
          label="Начало"
          required
          :disabled="isLoading"
        />
        <KitInput
          v-model="form.endAt"
          type="datetime-local"
          label="Окончание"
          required
          :disabled="isLoading"
        />
      </div>

      <KitInput
        v-model="form.description"
        type="textarea"
        label="Описание"
        placeholder="Подробности..."
        :disabled="isLoading"
      />

      <div class="form-actions">
        <KitBtn
          variant="text"
          :disabled="isLoading"
          @click="handleUpdateVisible(false)"
        >
          Отмена
        </KitBtn>
        <KitBtn
          :disabled="isLoading"
          :loading="isLoading"
          @click="handleSave"
        >
          <template v-if="isLoading">
            Сохранение...
          </template>
          <template v-else>
            Сохранить
          </template>
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped>
.form-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
  transition: opacity 0.2s;
}

.form-content.is-loading {
  opacity: 0.8;
  pointer-events: none;
}

.dates-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}
</style>
