<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useHead } from '@vueuse/head'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { AppRoutePaths } from '~/shared/constants/routes'

useHead({
  title: 'Страница не найдена (404)',
  meta: [
    { name: 'robots', content: 'noindex' },
  ],
})

const router = useRouter()
</script>

<template>
  <div class="not-found-page">
    <div class="content">
      <div class="error-code">
        404
      </div>
      <h1 class="title">
        Страница потерялась
      </h1>
      <p class="description">
        Похоже, вы свернули не туда. Этой страницы не существует или она была перемещена.
      </p>

      <div class="actions">
        <KitBtn
          variant="solid"
          color="primary"
          size="lg"
          @click="router.push(AppRoutePaths.Root)"
        >
          <Icon icon="mdi:home-outline" />
          На главную
        </KitBtn>

        <KitBtn
          variant="tonal"
          color="secondary"
          size="lg"
          @click="router.back()"
        >
          <Icon icon="mdi:arrow-left" />
          Назад
        </KitBtn>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.not-found-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100%;
  padding: 20px;
  text-align: center;
}

.content {
  max-width: 500px;
}

.error-code {
  font-size: 8rem;
  font-weight: 900;
  line-height: 1;
  color: var(--fg-tertiary-color);
  opacity: 0.3;
  margin-bottom: 1rem;
  font-family: 'Sansation', sans-serif;
}

.title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--fg-primary-color);
  margin-bottom: 1rem;
}

.description {
  font-size: 1.1rem;
  color: var(--fg-secondary-color);
  margin-bottom: 2.5rem;
  line-height: 1.6;
}

.actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}
</style>
