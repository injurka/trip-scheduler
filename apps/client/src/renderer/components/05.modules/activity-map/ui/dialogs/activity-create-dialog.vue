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
  duration: '',
  coords: null as [number, number] | null,
})

watch(() => props.visible, (isOpen) => {
  if (isOpen) {
    form.value = {
      title: '',
      description: '',
      duration: '',
      coords: props.initialCoords,
    }
  }
})

function handleSave() {
  if (props.isLoading)
    return
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
    :max-width="400"
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
      <KitInput
        v-model="form.duration"
        label="Длительность"
        placeholder="Например: 1 час"
        icon="mdi:clock-outline"
        :disabled="isLoading"
      />
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

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}
</style>
