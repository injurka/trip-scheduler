<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'

defineEmits(['retry'])
</script>

<template>
  <div class="error-state">
    <Icon icon="mdi:alert-circle-outline" />
    <p>Не удалось загрузить витрину</p>
    <KitBtn
      size="sm"
      variant="outlined"
      icon="mdi:refresh"
      @click="$emit('retry')"
    >
      Повторить
    </KitBtn>
  </div>
</template>

<style scoped lang="scss">
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  text-align: center;
  padding: 60px 20px;
  color: var(--fg-secondary-color);
  background-color: var(--bg-secondary-color);
  border: 1px dashed var(--border-secondary-color);
  border-radius: var(--r-l);

  .iconify {
    font-size: 48px;
    opacity: 0.5;
    color: var(--fg-error-color);
  }
}
</style>
