<script setup lang="ts">
import { ErrorPlaceholder } from '~/components/02.shared/error-placeholder'
import { useConnectivity } from '~/shared/lib/connectivity'

interface Props {
  error: unknown
}

defineProps<Props>()

defineEmits<{
  (e: 'retry'): void
}>()

const { isOnline } = useConnectivity()
</script>

<template>
  <div class="memories-error">
    <ErrorPlaceholder
      v-if="!isOnline"
      title="Недоступно офлайн"
      message="Воспоминания не были сохранены для работы без подключения к сети"
    />
    <ErrorPlaceholder
      v-else
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
