<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useTextareaAutosize } from '@vueuse/core'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { useAuthStore } from '~/shared/store/auth.store'

const emit = defineEmits<{
  (e: 'submit', value: string): void
}>()

const authStore = useAuthStore()
const { textarea, input: newCommentText } = useTextareaAutosize()

function handleSubmit() {
  if (!newCommentText.value.trim())
    return

  emit('submit', newCommentText.value)
  newCommentText.value = ''
}
</script>

<template>
  <form class="comment-form" @submit.prevent="handleSubmit">
    <KitAvatar :src="authStore.user?.avatarUrl" :name="authStore.user?.name" :size="32" />
    <div class="input-wrapper">
      <textarea
        ref="textarea"
        v-model="newCommentText"
        placeholder="Оставить комментарий..."
        @keydown.enter.exact.prevent="handleSubmit"
      />
      <button type="submit" :disabled="!newCommentText.trim()">
        <Icon icon="mdi:send" />
      </button>
    </div>
  </form>
</template>

<style scoped lang="scss">
.comment-form {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 8px;
}
.input-wrapper {
  flex-grow: 1;
  display: flex;
  align-items: center;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-m);
  padding: 4px 4px 4px 12px;

  textarea {
    flex-grow: 1;
    border: none;
    background: transparent;
    color: var(--fg-primary-color);
    font-family: inherit;
    font-size: 0.9rem;
    resize: none;
    line-height: 1.5;
    max-height: 120px;
    overflow-y: auto;

    &:focus {
      outline: none;
    }
  }

  button {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--fg-accent-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;

    &:disabled {
      color: var(--fg-tertiary-color);
      cursor: not-allowed;
    }
  }
}
</style>
