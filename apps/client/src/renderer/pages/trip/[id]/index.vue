<script setup lang="ts">
import { TripInfo } from '~/components/05.modules/trip-info'
</script>

<template>
  <section class="content-wrapper-inner">
    <TripInfo />
  </section>
</template>

<style lang="scss" scoped>
.content-wrapper-inner {
  display: flex;
  flex-grow: 1;
  width: 100%;
}
</style>
