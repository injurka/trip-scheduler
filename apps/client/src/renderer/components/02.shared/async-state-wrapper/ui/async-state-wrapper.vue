<script setup lang="ts" generic="T">
import type { Ref } from 'vue'
import { ErrorPlaceholder } from '~/components/02.shared/error-placeholder'

export type AsyncState = 'loading' | 'error' | 'success' | 'empty'

export interface AsyncStateWrapperProps<T = unknown> {
  loading?: boolean
  error?: unknown | null | Ref<unknown | null>
  data?: T | null
  retryHandler?: () => void | Promise<void> | Promise<unknown>
  transition?: string
}

const props = defineProps<AsyncStateWrapperProps<T>>()

const emit = defineEmits<{
  (e: 'retry'): void
}>()

const currentState = computed<AsyncState>(() => {
  if (props.loading)
    return 'loading'

  if (props.error)
    return 'error'

  if (props.data)
    return 'success'

  return 'empty'
})

const previousState = ref<AsyncState | null>(null)

watch(currentState, (_newState, oldState) => {
  previousState.value = oldState
})

const transitionName = computed(() => {
  if (previousState.value === 'loading' && currentState.value === 'success')
    return 'no-transition'

  return props.transition ?? 'faded'
})

function handleRetry() {
  if (props.retryHandler) {
    props.retryHandler()
  }
  emit('retry')
}
</script>

<template>
  <div class="async-state-wrapper">
    <Transition :name="transitionName" mode="out-in" appear>
      <!-- Состояние загрузки (Скелетон) -->
      <div
        v-if="currentState === 'loading'"
        key="loading"
        class="async-state-wrapper-content"
      >
        <slot
          v-if="currentState === 'loading'"
          key="loading"
          name="loading"
        >
          <div>Загрузка...</div>
        </slot>
      </div>

      <!-- Состояние ошибки -->
      <div
        v-else-if="currentState === 'error'"
        key="error"
        class="async-state-wrapper-content"
      >
        <slot
          name="error"
          :error="error"
          :retry="retryHandler"
        >
          <ErrorPlaceholder
            image-src="/images/smth-wrong.png"
            title="Что-то пошло не так"
            message="Произошла ошибка при загрузке данных"
            action-text="Попробовать снова"
            @action="retryHandler"
          />
        </slot>
      </div>

      <!-- Состояние успеха (Контент) -->
      <div
        v-else-if="currentState === 'success' && !!data"
        key="success"
        class="async-state-wrapper-content"
      >
        <slot
          name="success"
          :data="data"
          :retry="handleRetry"
        />
      </div>

      <!-- Пустое состояние -->
      <div v-else key="empty">
        <slot name="empty" />
      </div>
    </Transition>
  </div>
</template>

<style lang="scss">
.async-state-wrapper {
  height: 100%;

  &-content {
    height: 100%;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.no-transition-enter-active,
.no-transition-leave-active {
  transition: none;
}
</style>
