<script setup lang="ts">
import { NavigationBack } from '~/components/02.shared/navigation-back'
import { ActivityTracking } from '~/components/05.modules/activity-tracking'
</script>

<template>
  <section class="activity-tracking-page content-wrapper">
    <NavigationBack />
    <ActivityTracking />
  </section>
</template>

<style scoped lang="scss">
.activity-tracking-page {
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--p-m);
}
</style>
