<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Time } from '@internationalized/date'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTimeField } from '~/components/01.kit/kit-time-field'

interface Props {
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', title: string, time: Time): void
}>()

const title = ref('')
const time = shallowRef(new Time(0, 0))

const canSave = computed(() => title.value.trim().length > 0)

watch(() => props.visible, (val) => {
  if (val) {
    title.value = ''
    time.value = new Time(0, 0)
  }
})

function handleSave() {
  if (!canSave.value)
    return
  emit('save', title.value.trim(), time.value)
  emit('update:visible', false)
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Новая активность"
    icon="mdi:plus-box-outline"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="modal-body">
      <div class="section name-section">
        <label class="field-label">
          <Icon icon="mdi:text-short" class="field-icon" />
          <span>Название</span>
        </label>
        <KitInput
          v-model="title"
          placeholder="Например: Обед в ресторане..."
          autofocus
          @keydown.enter="handleSave"
        />
      </div>

      <div class="separator" />

      <div class="section time-row">
        <div class="field-label">
          <Icon icon="mdi:clock-start" class="field-icon" />
          <span>Время начала</span>
        </div>
        <KitTimeField v-model="time" />
      </div>
    </div>

    <div class="modal-footer">
      <KitBtn variant="text" color="secondary" @click="emit('update:visible', false)">
        Отмена
      </KitBtn>
      <KitBtn :disabled="!canSave" @click="handleSave">
        <Icon icon="mdi:check" />
        Добавить
      </KitBtn>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.modal-body {
  display: flex;
  flex-direction: column;
}

.section {
  padding: 16px 24px;
}

.name-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 20px;
}

.separator {
  height: 1px;
  background-color: var(--border-secondary-color);
}

.time-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 14px;
  padding-bottom: 14px;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

.field-icon {
  font-size: 1.1rem;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
  border-top: 1px solid var(--border-secondary-color);
}
</style>
