<script setup lang="ts">
import KitSkeleton from '~/components/01.kit/kit-skeleton/ui/kit-skeleton.vue'
</script>

<template>
  <KitSkeleton
    width="100%"
    height="400px"
    border-radius="0"
    class="trip-map-skeleton"
  />
</template>

<style scoped lang="scss">
.trip-map-skeleton {
  display: block;
}
</style>
