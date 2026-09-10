<script setup lang="ts">
import { WelcomeCard } from '~/components/05.modules/welcome-card'
</script>

<template>
  <section class="root-wrapper">
    <WelcomeCard />
  </section>
</template>

<style lang="scss" scoped>
.root-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 100%;
  background-color: transparent;
}
</style>
