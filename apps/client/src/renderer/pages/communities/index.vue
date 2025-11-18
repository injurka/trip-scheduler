<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NavigationBack } from '~/components/02.shared/navigation-back/index'
import { CommunitiesHub } from '~/components/05.modules/communities-hub'
</script>

<template>
  <section class="content-wrapper">
    <div class="wip-banner">
      <Icon icon="mdi:dev-to" />
      <span>Раздел "Сообщества" находится в активной разработке. Некоторые функции могут быть недоступны.</span>
    </div>
    <NavigationBack />
    <CommunitiesHub />
  </section>
</template>

<style lang="scss" scoped>
.content-wrapper {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.wip-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background-color: var(--bg-warning-color);
  color: var(--fg-warning-color);
  padding: 0.75rem 1rem;
  border-radius: var(--r-m);
  font-size: 0.9rem;
  font-weight: 500;

  .iconify {
    font-size: 1.5rem;
  }
}
</style>
