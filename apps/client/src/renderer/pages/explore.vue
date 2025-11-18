<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NavigationBack } from '~/components/02.shared/navigation-back'
import { ExploreHub } from '~/components/05.modules/explore-hub'
</script>

<template>
  <section class="content-wrapper">
    <div class="wip-banner">
      <Icon icon="mdi:dev-to" />
      <span>Раздел "Что посетить" находится в активной разработке. Некоторые функции могут быть недоступны.</span>
    </div>
    <NavigationBack />
    <ExploreHub />
  </section>
</template>

<style scoped lang="scss">
.content-wrapper {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding: 2rem;
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
