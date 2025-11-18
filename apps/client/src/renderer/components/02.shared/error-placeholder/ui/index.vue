<script setup lang="ts">
import { KitBtn } from '~/components/01.kit/kit-btn'

interface Props {
  title?: string
  message?: string
  imageSrc?: string
  actionText?: string
}

withDefaults(defineProps<Props>(), {
  title: 'Что-то пошло не так',
  message: 'Произошла непредвиденная ошибка. Пожалуйста, попробуйте позже.',
  imageSrc: '/images/smth-wrong.png',
  actionText: '',
})

const emit = defineEmits<{ (e: 'action'): void }>()
</script>

<template>
  <div class="error-placeholder">
    <img
      :src="imageSrc"
      class="image"
      alt=""
      height="180"
      aria-hidden="true"
    >
    <h1 class="title">
      {{ title }}
    </h1>
    <p v-if="message" class="description">
      {{ message }}
    </p>
    <KitBtn
      v-if="actionText"
      variant="outlined"
      color="secondary"
      class="action"
      @click="emit('action')"
    >
      {{ actionText }}
    </KitBtn>
  </div>
</template>

<style scoped lang="scss">
.error-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  height: 100%;
  padding: 16px;
}

.image {
  user-select: none;
  margin-bottom: 16px;
}

.title {
  font-size: 1.75rem;
  font-weight: 600;
  margin-top: 8px;
  color: var(--fg-primary-color);
}

.description {
  margin-top: 12px;
  font-size: 1rem;
  color: var(--fg-secondary-color);
  max-width: 370px;
  line-height: 1.5;
  letter-spacing: 0%;
  text-align: center;
}

.action {
  margin: 24px 0;
  min-width: 220px;

  &:deep(.kit-btn__content) {
    color: var(--fg-accent-color);
  }
}
</style>
