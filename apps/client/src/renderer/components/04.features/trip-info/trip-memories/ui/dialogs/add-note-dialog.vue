<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Time } from '@internationalized/date'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitTimeField } from '~/components/01.kit/kit-time-field'

interface Props {
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', text: string, time: Time): void
}>()

const text = ref('')
const time = shallowRef(new Time(0, 0))
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const canSave = computed(() => text.value.trim().length > 0)

watch(() => props.visible, (val) => {
  if (val) {
    text.value = ''
    time.value = new Time(0, 0)
    nextTick(() => textareaRef.value?.focus())
  }
})

function handleSave() {
  if (!canSave.value)
    return
  emit('save', text.value.trim(), time.value)
  emit('update:visible', false)
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter')
    handleSave()
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Новая заметка"
    icon="mdi:note-plus-outline"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="modal-body">
      <div class="section">
        <textarea
          ref="textareaRef"
          v-model="text"
          class="note-textarea"
          placeholder="Напишите, что произошло в этот день..."
          rows="5"
          @keydown="handleKeydown"
        />
        <span class="hint">Ctrl + Enter для сохранения</span>
      </div>

      <div class="separator" />

      <div class="section time-row">
        <div class="time-label">
          <Icon icon="mdi:clock-outline" class="time-icon" />
          <span>Время</span>
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
        Сохранить
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

.note-textarea {
  width: 100%;
  resize: none;
  border: 1.5px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 12px 14px;
  font-size: 0.9rem;
  font-family: inherit;
  line-height: 1.65;
  color: var(--fg-primary-color);
  background-color: var(--bg-primary-color);
  box-sizing: border-box;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &::placeholder {
    color: var(--fg-secondary-color);
    opacity: 0.6;
  }

  &:focus {
    outline: none;
    border-color: var(--fg-accent-color);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--fg-accent-color) 12%, transparent);
  }
}

.hint {
  display: block;
  margin-top: 6px;
  font-size: 0.73rem;
  color: var(--fg-secondary-color);
  opacity: 0.55;
  text-align: right;
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

.time-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

.time-icon {
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
