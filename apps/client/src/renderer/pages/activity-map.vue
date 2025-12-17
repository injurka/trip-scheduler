<script setup lang="ts">
import { NavigationBack } from '~/components/02.shared/navigation-back'
import { ActivityMap } from '~/components/05.modules/activity-map'
</script>

<template>
  <section class="content-wrapper">
    <NavigationBack />
    <ActivityMap />
  </section>
</template>

<style scoped lang="scss">
.content-wrapper {
  width: 100%;
  height: 100vh;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding: 16px;
  max-width: 1400px;
}
</style>
