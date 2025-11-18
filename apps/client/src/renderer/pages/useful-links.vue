<script setup lang="ts">
import { NavigationBack } from '~/components/02.shared/navigation-back'
import { UsefulLinks } from '~/components/05.modules/useful-links'
</script>

<template>
  <section class="content-wrapper">
    <NavigationBack />
    <UsefulLinks />
  </section>
</template>

<style scoped lang="scss">
.content-wrapper {
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}
</style>
