<script setup lang="ts">
import { NavigationBack } from '~/components/02.shared/navigation-back/index'
import { TripsHub } from '~/components/05.modules/trips-hub'

const hasFetchError = ref(false)
</script>

<template>
  <section
    class="content-wrapper"
    :class="{ 'has-error': hasFetchError }"
  >
    <NavigationBack />
    <TripsHub @update:has-error="hasFetchError = $event" />
  </section>
</template>

<style lang="scss" scoped>
.content-wrapper {
  transition: background-color 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  margin: 0 auto;

  &.has-error {
    background: transparent;
  }
}
</style>
