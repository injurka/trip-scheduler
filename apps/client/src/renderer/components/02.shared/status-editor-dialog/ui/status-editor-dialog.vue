<script setup lang="ts">
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { useAuthStore } from '~/shared/store/auth.store'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const authStore = useAuthStore()
const user = computed(() => authStore.user)

const statusText = ref('')
const statusEmoji = ref('')

const emojis = [
  '🙂',
  '😀',
  '🎉',
  '🌴',
  '💼',
  '💻',
  '✈️',
  '🏖️',
  '⛰️',
  '🏠',
  '☕',
  '😴',
]

watch(() => props.visible, (isVisible) => {
  if (isVisible && user.value) {
    statusText.value = user.value.statusText || ''
    statusEmoji.value = user.value.statusEmoji || ''
  }
})

async function handleSave() {
  await authStore.updateStatus({
    statusText: statusText.value.trim() || null,
    statusEmoji: statusEmoji.value || null,
  })
  emit('update:visible', false)
}

function clearStatus() {
  statusText.value = ''
  statusEmoji.value = ''
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Укажите ваш статус"
    icon="mdi:emoticon-happy-outline"
    :max-width="400"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="status-editor">
      <div class="current-status-preview">
        <span v-if="statusEmoji" class="emoji">{{ statusEmoji }}</span>
        <span v-if="statusText" class="text">{{ statusText }}</span>
        <span v-if="!statusEmoji && !statusText" class="placeholder">Ваш статус</span>
      </div>

      <KitInput
        v-model="statusText"
        label="Сообщение статуса"
        placeholder="Например, 'В отпуске'"
        maxlength="100"
      />

      <div class="emoji-picker">
        <label>Выберите эмодзи</label>
        <div class="emoji-grid">
          <button
            v-for="emoji in emojis"
            :key="emoji"
            class="emoji-option"
            :class="{ 'is-active': statusEmoji === emoji }"
            @click="statusEmoji = emoji"
          >
            {{ emoji }}
          </button>
        </div>
      </div>

      <div class="form-actions">
        <KitBtn variant="text" color="secondary" @click="clearStatus">
          Очистить
        </KitBtn>
        <div class="spacer" />
        <KitBtn variant="outlined" color="secondary" @click="emit('update:visible', false)">
          Отмена
        </KitBtn>
        <KitBtn @click="handleSave">
          Сохранить
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.status-editor {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.current-status-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: var(--r-m);
  background-color: var(--bg-tertiary-color);
  min-height: 48px;

  .emoji {
    font-size: 1.25rem;
  }
  .text {
    font-weight: 500;
  }
  .placeholder {
    color: var(--fg-secondary-color);
  }
}

.emoji-picker {
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}

.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.emoji-option {
  font-size: 1.25rem;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid transparent;
  background-color: var(--bg-secondary-color);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: scale(1.1);
  }
  &.is-active {
    border-color: var(--fg-accent-color);
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-secondary-color);
}

.spacer {
  flex-grow: 1;
}
</style>
