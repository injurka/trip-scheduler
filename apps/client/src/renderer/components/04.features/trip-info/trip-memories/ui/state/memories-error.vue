<script setup lang="ts">
import { ErrorPlaceholder } from '~/components/02.shared/error-placeholder'

interface Props {
  error: unknown
}

defineProps<Props>()

defineEmits<{
  (e: 'retry'): void
}>()
</script>

<template>
  <div class="memories-error">
    <ErrorPlaceholder
      title="Не удалось загрузить воспоминания"
      message="Произошла ошибка при получении данных. Пожалуйста, попробуйте еще раз."
      action-text="Повторить"
      @action="$emit('retry')"
    />
  </div>
</template>

<style scoped>
.memories-error {
  padding: 32px 0;
  min-height: 400px;
}
</style>
