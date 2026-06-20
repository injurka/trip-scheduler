<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'

const props = defineProps<{
  hideCanvasRef?: boolean
  isExternalGenerating?: boolean
}>()

const emit = defineEmits<{
  (e: 'generate', payload: { prompt: string, useDaysContext: boolean, useCanvasAsRef: boolean }): void
}>()

const prompt = ref('')
const useDaysContext = ref(false)
const useCanvasAsRef = ref(false)
const isGenerating = ref(false)

const isDisabled = computed(() => isGenerating.value || !!props.isExternalGenerating)

function handleSubmit() {
  if (!prompt.value.trim() || isDisabled.value)
    return
  isGenerating.value = true
  emit('generate', { prompt: prompt.value, useDaysContext: useDaysContext.value, useCanvasAsRef: useCanvasAsRef.value })
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSubmit()
  }
}

defineExpose({
  useDaysContext,
  finishGeneration: () => {
    isGenerating.value = false
    prompt.value = ''
  },
})
</script>

<template>
  <div class="llm-assistant-bar" :class="{ 'is-generating': isGenerating, 'is-disabled': isExternalGenerating && !isGenerating }">
    <!-- Animated background glow -->
    <div class="glow-orb glow-orb--1" />
    <div class="glow-orb glow-orb--2" />

    <div class="bar-inner">
      <!-- Header -->
      <div class="assistant-header">
        <div class="header-icon-wrap">
          <Icon icon="mdi:creation" class="magic-icon" />
        </div>
        <div class="header-text">
          <span class="title">AI Помощник</span>
          <span class="subtitle">Опишите что нужно изменить</span>
        </div>
        <div v-if="isGenerating" class="generating-badge">
          <span class="badge-dot" />
          Генерирует...
        </div>
      </div>

      <!-- Input area -->
      <div class="input-wrap" :class="{ 'is-focused': !!prompt }">
        <textarea
          v-model="prompt"
          class="prompt-textarea"
          placeholder="Например: Добавь утреннюю прогулку по набережной..."
          rows="2"
          :disabled="isDisabled"
          @keydown="handleKeydown"
        />
        <button
          class="send-btn"
          :class="{ 'is-ready': !!prompt.trim() && !isDisabled }"
          :disabled="!prompt.trim() || isDisabled"
          @click="handleSubmit"
        >
          <Icon
            :icon="isGenerating ? 'mdi:loading' : 'mdi:arrow-up'"
            :class="{ 'spin-icon': isGenerating }"
          />
        </button>
      </div>

      <!-- Options -->
      <div class="options-row">
        <label class="option-chip" :class="{ active: useDaysContext }">
          <input v-model="useDaysContext" type="checkbox" class="option-input">
          <Icon icon="mdi:calendar-multiple" class="option-icon" />
          <span>Контекст дней</span>
        </label>
        <label v-if="!hideCanvasRef" class="option-chip" :class="{ active: useCanvasAsRef }">
          <input v-model="useCanvasAsRef" type="checkbox" class="option-input">
          <Icon icon="mdi:note-text-outline" class="option-icon" />
          <span>Текст Полотна</span>
        </label>
        <span class="hint-text">Enter — отправить · Shift+Enter — перенос</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.llm-assistant-bar {
  position: relative;
  margin-bottom: 16px;
  border-radius: var(--r-m);
  overflow: hidden;
  isolation: isolate;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(
      135deg,
      rgba(var(--fg-accent-color-rgb), 0.5),
      rgba(var(--fg-accent-color-rgb), 0.1) 40%,
      rgba(var(--fg-accent-color-rgb), 0.05) 60%,
      rgba(var(--fg-accent-color-rgb), 0.3)
    );
    -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: borderRotate 6s linear infinite;
    background-size: 200% 200%;
    pointer-events: none;
  }

  &.is-disabled {
    opacity: 0.5;
    pointer-events: none;
    filter: grayscale(0.3);
    transition:
      opacity 0.2s ease,
      filter 0.2s ease;
  }

  &.is-generating::before {
    animation-duration: 1.5s;
    background: linear-gradient(
      135deg,
      rgba(var(--fg-accent-color-rgb), 0.9),
      rgba(var(--fg-accent-color-rgb), 0.3) 50%,
      rgba(var(--fg-accent-color-rgb), 0.9)
    );
    background-size: 200% 200%;
  }
}

// Ambient glow orbs
.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  pointer-events: none;
  z-index: 0;

  &--1 {
    width: 120px;
    height: 120px;
    top: -30px;
    right: 20px;
    background: rgba(var(--fg-accent-color-rgb), 0.12);
    animation: floatOrb 8s ease-in-out infinite;
  }

  &--2 {
    width: 80px;
    height: 80px;
    bottom: -20px;
    left: 40px;
    background: rgba(var(--fg-accent-color-rgb), 0.07);
    animation: floatOrb 11s ease-in-out infinite reverse;
  }
}

.bar-inner {
  position: relative;
  z-index: 1;
  background: linear-gradient(
    145deg,
    rgba(var(--bg-secondary-color-rgb, 30, 30, 35), 0.95),
    rgba(var(--bg-primary-color-rgb, 20, 20, 25), 0.98)
  );
  backdrop-filter: blur(12px);
  border-radius: var(--r-m);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

// ── Header ────────────────────────────────────────────────────
.assistant-header {
  display: flex;
  align-items: center;
  gap: 10px;

  .header-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--r-s);
    background: linear-gradient(135deg, rgba(var(--fg-accent-color-rgb), 0.25), rgba(var(--fg-accent-color-rgb), 0.08));
    border: 1px solid rgba(var(--fg-accent-color-rgb), 0.2);
    flex-shrink: 0;

    .magic-icon {
      font-size: 1rem;
      color: var(--fg-accent-color);
    }
  }

  .header-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-width: 0;

    .title {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--fg-primary-color);
      line-height: 1.2;
    }

    .subtitle {
      font-size: 0.72rem;
      color: var(--fg-tertiary-color, var(--fg-secondary-color));
      opacity: 0.7;
      line-height: 1.2;
    }
  }

  .generating-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--fg-accent-color);
    background: rgba(var(--fg-accent-color-rgb), 0.1);
    border: 1px solid rgba(var(--fg-accent-color-rgb), 0.25);
    padding: 3px 8px;
    border-radius: var(--r-full);
    white-space: nowrap;
    flex-shrink: 0;

    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--fg-accent-color);
      animation: pulse 1.2s ease-in-out infinite;
    }
  }
}

// ── Input ─────────────────────────────────────────────────────
.input-wrap {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: rgba(var(--bg-primary-color-rgb, 15, 15, 20), 0.6);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 8px 8px 8px 12px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:focus-within {
    border-color: rgba(var(--fg-accent-color-rgb), 0.5);
    box-shadow: 0 0 0 3px rgba(var(--fg-accent-color-rgb), 0.08);
  }

  .prompt-textarea {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    font-family: inherit;
    font-size: 0.875rem;
    color: var(--fg-primary-color);
    line-height: 1.5;
    min-height: 42px;
    max-height: 120px;

    &::placeholder {
      color: var(--fg-secondary-color);
      opacity: 0.6;
    }

    &:disabled {
      opacity: 0.5;
    }
  }

  .send-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--r-s);
    border: 1px solid var(--border-secondary-color);
    background: var(--bg-secondary-color);
    color: var(--fg-secondary-color);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.2s ease;
    font-size: 1rem;

    &.is-ready {
      background: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
      color: var(--fg-inverted-color);
      box-shadow: 0 2px 8px rgba(var(--fg-accent-color-rgb), 0.35);

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(var(--fg-accent-color-rgb), 0.45);
      }

      &:active {
        transform: translateY(0);
      }
    }

    &:disabled:not(.is-ready) {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}

// ── Options ───────────────────────────────────────────────────
.options-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;

  .option-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px 3px 7px;
    border-radius: var(--r-full);
    border: 1px solid var(--border-secondary-color);
    background: transparent;
    color: var(--fg-secondary-color);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;

    .option-input {
      display: none;
    }

    .option-icon {
      font-size: 0.85rem;
      transition: color 0.15s ease;
    }

    &:hover {
      border-color: rgba(var(--fg-accent-color-rgb), 0.4);
      color: var(--fg-primary-color);
    }

    &.active {
      background: rgba(var(--fg-accent-color-rgb), 0.12);
      border-color: rgba(var(--fg-accent-color-rgb), 0.45);
      color: var(--fg-accent-color);

      .option-icon {
        color: var(--fg-accent-color);
      }
    }
  }

  .hint-text {
    margin-left: auto;
    font-size: 0.68rem;
    color: var(--fg-secondary-color);
    opacity: 0.5;
    white-space: nowrap;
  }
}

// ── Animations ────────────────────────────────────────────────
@keyframes borderRotate {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes floatOrb {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(10px, -8px) scale(1.05);
  }
  66% {
    transform: translate(-6px, 6px) scale(0.95);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.spin-icon {
  animation: spin 1s linear infinite;
}
</style>
