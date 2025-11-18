<script setup lang="ts">
import { NavigationBack } from '~/components/02.shared/navigation-back/index'

const route = useRoute()
const communityId = computed(() => route.params.id)
</script>

<template>
  <section class="content-wrapper">
    <NavigationBack />
    <h1>Страница Сообщества</h1>
    <p>ID Сообщества: {{ communityId }}</p>
    <p>Эта страница находится в разработке.</p>
  </section>
</template>

<style lang="scss" scoped>
.content-wrapper {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem;
}
h1 {
  font-size: 2rem;
  font-weight: 700;
}
p {
  color: var(--fg-secondary-color);
}
</style>
