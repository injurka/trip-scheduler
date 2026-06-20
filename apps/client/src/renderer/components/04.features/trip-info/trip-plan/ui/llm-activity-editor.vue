<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInput } from '~/components/01.kit/kit-input'

interface Props {
  activityTitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  activityTitle: '',
})

const emit = defineEmits<{
  (e: 'generate', payload: { prompt: string }): void
  (e: 'close'): void
}>()

const prompt = ref('')
const isGenerating = ref(false)

function handleSubmit() {
  if (!prompt.value.trim() || isGenerating.value) return
  isGenerating.value = true
  emit('generate', { prompt: prompt.value.trim() })
}

function finishGeneration() {
  isGenerating.value = false
}

defineExpose({ finishGeneration })
</script>

<template>
  <div class="llm-activity-editor">
    <div class="editor-header">
      <Icon icon="mdi:robot-outline" class="magic-icon" />
      <span class="title">ИИ редактирование</span>
      <span v-if="activityTitle" class="activity-name">{{ activityTitle }}</span>
      <button class="close-btn" @click="emit('close')">
        <Icon icon="mdi:close" />
      </button>
    </div>
    <div class="input-row">
      <KitInput
        v-model="prompt"
        placeholder="Например: поменяй время на 15:00–17:00 и добавь описание..."
        class="prompt-input"
        @keydown.enter.prevent="handleSubmit"
      />
      <KitBtn
        class="send-btn"
        :disabled="!prompt.trim() || isGenerating"
        @click="handleSubmit"
      >
        <Icon :icon="isGenerating ? 'mdi:loading' : 'mdi:send'" :class="{ 'spin-icon': isGenerating }" />
      </KitBtn>
    </div>
    <p class="hint">ИИ изменит только эту активность. Вы сможете проверить результат перед применением.</p>
  </div>
</template>

<style scoped lang="scss">
.llm-activity-editor {
  margin: 8px 0 12px;
  padding: 12px 16px;
  border-radius: var(--r-s);
  border: 1px solid var(--fg-accent-color);
  background: linear-gradient(135deg, rgba(var(--fg-accent-color-rgb), 0.04) 0%, rgba(var(--fg-accent-color-rgb), 0.01) 100%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: slideIn 0.2s ease;

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .editor-header {
    display: flex;
    align-items: center;
    gap: 8px;

    .magic-icon {
      color: var(--fg-accent-color);
      font-size: 1.1rem;
      flex-shrink: 0;
    }

    .title {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--fg-accent-color);
    }

    .activity-name {
      font-size: 0.75rem;
      color: var(--fg-secondary-color);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 180px;
    }

    .close-btn {
      margin-left: auto;
      flex-shrink: 0;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--fg-secondary-color);
      display: flex;
      align-items: center;
      padding: 2px;
      border-radius: var(--r-xs);
      transition: color 0.2s, background 0.2s;

      &:hover {
        color: var(--fg-primary-color);
        background: var(--bg-hover-color);
      }
    }
  }

  .input-row {
    display: flex;
    gap: 8px;

    .prompt-input {
      flex: 1;
    }

    .send-btn {
      flex-shrink: 0;
      height: 38px;
      width: 38px;
      padding: 0;
    }
  }

  .hint {
    font-size: 0.72rem;
    color: var(--fg-secondary-color);
    margin: 0;
    opacity: 0.8;
  }
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
