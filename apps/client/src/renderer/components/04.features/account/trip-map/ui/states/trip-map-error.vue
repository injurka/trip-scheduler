<script setup lang="ts">
import KitBtn from '~/components/01.kit/kit-btn/ui/kit-btn.vue'

defineProps<{
  message?: string
}>()

defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="trip-map-error">
    <span class="trip-map-error-icon">⚠️</span>
    <p class="trip-map-error-text">
      {{ message || 'Не удалось загрузить карту' }}
    </p>

    <KitBtn
      variant="outlined"
      color="primary"
      size="sm"
      icon="mdi:refresh"
      @click="$emit('retry')"
    >
      Повторить
    </KitBtn>
  </div>
</template>

<style scoped lang="scss">
.trip-map-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  text-align: center;
}

.trip-map-error-icon {
  font-size: 2.5rem;
  line-height: 1;
  opacity: 0.4;
}

.trip-map-error-text {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--fg-secondary-color);
}
</style>
