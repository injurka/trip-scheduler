<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{ isOwner: boolean }>()
</script>

<template>
  <div class="empty-state">
    <Icon icon="mdi:image-off-outline" />
    <p v-if="isOwner">
      В вашей витрине пока нет фото.
    </p>
    <p v-else>
      В витрине этого пользователя пока нет фото.
    </p>
  </div>
</template>

<style scoped lang="scss">
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--fg-secondary-color);
  background-color: var(--bg-secondary-color);
  border: 1px dashed var(--border-secondary-color);
  border-radius: var(--r-l);

  .iconify {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }
}
</style>
